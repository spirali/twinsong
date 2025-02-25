use crate::client_messages::ToClientMessage;
use crate::notebook::{KernelId, NotebookId, Run, RunId};
use crate::reactor::process_kernel_message;
use crate::state::AppStateRef;
use anyhow::bail;
use axum::body::Bytes;
use comm::messages::{FromKernelMessage, ToKernelMessage};
use comm::{make_protocol_builder, parse_from_kernel_message, serialize_to_kernel_message, Codec};
use futures_util::stream::{SplitSink, SplitStream, StreamExt};
use futures_util::SinkExt;
use nutype::nutype;
use tokio::net::{TcpListener, TcpStream};
use tokio::process::Child;
use tokio::spawn;
use tokio::sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender};
use tokio::sync::oneshot;
use tokio::task::spawn_local;
use tracing::log;

pub(crate) enum KernelHandleState {
    Init(Vec<ToKernelMessage>),
    Ready(UnboundedSender<ToKernelMessage>),
}

pub(crate) struct KernelCtx {
    pub kernel_id: KernelId,
    pub notebook_id: NotebookId,
    pub run_id: RunId,
}

#[allow(dead_code)] // TODO: After kill sender is used, removed this
pub(crate) struct KernelHandle {
    state: KernelHandleState,
    kill_sender: oneshot::Sender<()>,
    pending_messages: Vec<ToKernelMessage>,
    kernel_ctx: KernelCtx,
}

impl KernelHandle {
    pub fn new(kernel_ctx: KernelCtx, kill_sender: oneshot::Sender<()>) -> Self {
        KernelHandle {
            kill_sender,
            state: KernelHandleState::Init(Vec::new()),
            pending_messages: Vec::new(),
            kernel_ctx,
        }
    }

    pub fn notebook_id(&self) -> NotebookId {
        self.kernel_ctx.notebook_id
    }

    pub fn run_id(&self) -> RunId {
        self.kernel_ctx.run_id
    }

    pub fn is_init(&self) -> bool {
        matches!(self.state, KernelHandleState::Init { .. })
    }

    pub fn set_to_ready(&mut self, sender: UnboundedSender<ToKernelMessage>) {
        match &mut self.state {
            KernelHandleState::Init(pending_mesgs) => {
                let msgs = std::mem::take(pending_mesgs);
                for msg in msgs {
                    let _ = sender.send(msg);
                }
            }
            _ => unreachable!(),
        }
        self.state = KernelHandleState::Ready(sender);
    }

    // pub fn set_failed(&mut self, message: String) {
    //     self.state = KernelHandleState::Failed(message)
    // }

    pub fn send_message(&mut self, message: ToKernelMessage) {
        match &mut self.state {
            KernelHandleState::Init(ref mut pending_msgs) => {
                pending_msgs.push(message);
            }
            KernelHandleState::Ready(sender) => {
                let _ = sender.send(message);
            }
        }
    }
}

pub fn spawn_kernel(
    state_ref: &AppStateRef,
    kernel_ctx: KernelCtx,
    kernel_port: u16,
) -> anyhow::Result<KernelHandle> {
    let program = which::which("python")?;
    let mut cmd = tokio::process::Command::new(program);
    cmd.env("KERNEL_ID", kernel_ctx.kernel_id.to_string())
        .env("KERNEL_CONNECT", format!("127.0.0.1:{}", kernel_port))
        .arg("-m")
        .arg("twinsong.driver")
        .kill_on_drop(true);
    tracing::debug!("Spawning new kernel {:?}", &cmd);
    let child = cmd.spawn()?;

    // TODO: Implement kill switch
    let (sender, _receiver) = oneshot::channel();
    let state_ref = state_ref.clone();
    spawn(async move {
        let _r = kernel_guard(child).await;
        let mut state = state_ref.lock().unwrap();
        if let Ok(kernel) = state.find_kernel_by_id_mut(kernel_ctx.kernel_id) {
            // TODO: Remove kernel from state
            let notebook_id = kernel.notebook_id();
            let run_id = kernel.run_id();
            state
                .find_notebook_by_id_mut(notebook_id)
                .unwrap()
                .send_message(ToClientMessage::KernelCrashed {
                    notebook_id,
                    run_id,
                    message: "Process unexpectedly closed".to_string(),
                })
        }
    });
    Ok(KernelHandle::new(kernel_ctx, sender))
}

async fn kernel_guard(mut child: Child) -> anyhow::Result<()> {
    let status = child.wait().await?;
    tracing::debug!("Kernel stopped: {status:?}");
    if !status.success() {
        bail!("Kernel failed with status: {}", status.code().unwrap_or(0))
    }
    Ok(())
}

pub(crate) async fn init_kernel_manager(state_ref: &AppStateRef) -> anyhow::Result<()> {
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let port = listener.local_addr()?.port();

    let state_ref = state_ref.clone();
    state_ref.lock().unwrap().set_kernel_port(port);

    spawn_local(async move { kernel_manager_main(listener, state_ref).await });

    Ok(())
}

pub(crate) async fn kernel_manager_main(listener: TcpListener, state_ref: AppStateRef) {
    while let Ok((stream, _)) = listener.accept().await {
        tracing::debug!("New kernel connection");
        let state_ref = state_ref.clone();
        tokio::spawn(async move {
            if let Err(e) = handle_connection(stream, state_ref).await {
                tracing::debug!("kernel connection error: {:?}", e);
            }
        });
    }
}

pub(crate) async fn handle_connection(
    stream: TcpStream,
    state_ref: AppStateRef,
) -> anyhow::Result<()> {
    let (sender, mut receiver) = make_protocol_builder().new_framed(stream).split();

    let (c_receiver, kernel_ctx) = if let Some(msg) = receiver.next().await {
        let msg = msg?;
        let msg = parse_from_kernel_message(&msg)?;
        match msg {
            FromKernelMessage::Login { kernel_id } => {
                let kernel_id = KernelId::new(kernel_id);
                tracing::debug!("New kernel connection logged as {kernel_id}");
                let mut state = state_ref.lock().unwrap();
                let kernel = state.find_kernel_by_id_mut(kernel_id)?;
                if !kernel.is_init() {
                    bail!("Kernel {} is not in init state", kernel_id);
                }
                let (c_sender, c_receiver) = unbounded_channel();
                kernel.set_to_ready(c_sender);
                let notebook_id = kernel.notebook_id();
                let run_id = kernel.run_id();
                state
                    .notebook_by_id(notebook_id)
                    .send_message(ToClientMessage::KernelReady {
                        notebook_id,
                        run_id,
                    });
                (
                    c_receiver,
                    KernelCtx {
                        kernel_id,
                        notebook_id,
                        run_id,
                    },
                )
            }
            _ => bail!("Invalid first message"),
        }
    } else {
        tracing::debug!("connection closed without sending message");
        return Ok(());
    };

    let r = tokio::select! {
        r = async {
            forward_sender(sender, c_receiver).await
        } => r,
        r = async {
            recv_kernel_messages(receiver, state_ref, kernel_ctx).await
        } => r
    };
    r
}

async fn forward_sender(
    mut sender: SplitSink<Codec, Bytes>,
    mut c_receiver: UnboundedReceiver<ToKernelMessage>,
) -> anyhow::Result<()> {
    while let Some(msg) = c_receiver.recv().await {
        let msg = serialize_to_kernel_message(msg)?;
        sender.send(msg.into()).await?
    }
    Ok(())
}

async fn recv_kernel_messages(
    mut receiver: SplitStream<Codec>,
    state_ref: AppStateRef,
    kernel_ctx: KernelCtx,
) -> anyhow::Result<()> {
    while let Some(msg) = receiver.next().await {
        let msg = msg?;
        let msg = parse_from_kernel_message(&msg)?;
        log::debug!("Received kernel message {msg:?}");
        process_kernel_message(&mut state_ref.lock().unwrap(), &kernel_ctx, msg)?;
    }
    Ok(())
}
