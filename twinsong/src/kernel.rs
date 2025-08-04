use crate::client_messages::{KernelInfo, ToClientMessage};
use crate::notebook::{KernelId, NotebookId, RunId};
use crate::reactor::process_kernel_message;
use crate::state::AppStateRef;
use anyhow::bail;
use axum::body::Bytes;
use comm::messages::{FromKernelMessage, ToKernelMessage};
use comm::scopes::SerializedGlobals;
use comm::{Codec, make_protocol_builder, parse_from_kernel_message, serialize_to_kernel_message};
use futures_util::SinkExt;
use futures_util::stream::{SplitSink, SplitStream, StreamExt};
use std::env::temp_dir;
use std::fs::File;
use std::path::PathBuf;
use std::process::Stdio;
use tokio::net::{TcpListener, TcpStream};
use tokio::process::Child;
use tokio::spawn;
use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender, unbounded_channel};
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
    kernel_ctx: KernelCtx,
    pid: u32,
    on_save_sender: Vec<oneshot::Sender<Result<(), String>>>,
    on_load_sender: Vec<oneshot::Sender<Result<SerializedGlobals, String>>>,
}

impl KernelHandle {
    pub fn new(kernel_ctx: KernelCtx, kill_sender: oneshot::Sender<()>, pid: u32) -> Self {
        KernelHandle {
            kill_sender,
            state: KernelHandleState::Init(Vec::new()),
            kernel_ctx,
            pid,
            on_save_sender: Vec::new(),
            on_load_sender: Vec::new(),
        }
    }

    pub fn kernel_info(&self, kernel_id: KernelId) -> KernelInfo {
        KernelInfo {
            kernel_id,
            notebook_id: self.kernel_ctx.notebook_id,
            run_id: self.kernel_ctx.run_id,
            pid: self.pid,
        }
    }

    pub fn on_store_response(&mut self, result: Result<(), String>) {
        if !self.on_save_sender.is_empty() {
            let _ = self.on_save_sender.remove(0).send(result);
        }
    }

    pub fn on_load_response(&mut self, result: Result<SerializedGlobals, String>) {
        if !self.on_load_sender.is_empty() {
            let _ = self.on_load_sender.remove(0).send(result);
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

    pub fn store_state(&mut self, path: PathBuf) -> oneshot::Receiver<Result<(), String>> {
        let (sender, receiver) = oneshot::channel();
        self.on_save_sender.push(sender);
        self.send_message(ToKernelMessage::SaveState(path));
        receiver
    }

    pub fn load_state(
        &mut self,
        path: PathBuf,
    ) -> oneshot::Receiver<Result<SerializedGlobals, String>> {
        let (sender, receiver) = oneshot::channel();
        self.on_load_sender.push(sender);
        self.send_message(ToKernelMessage::LoadState(path));
        receiver
    }

    pub fn send_message(&mut self, message: ToKernelMessage) {
        match &mut self.state {
            KernelHandleState::Init(pending_msgs) => {
                pending_msgs.push(message);
            }
            KernelHandleState::Ready(sender) => {
                let _ = sender.send(message);
            }
        }
    }

    pub fn stop(self) {
        let _ = self.kill_sender.send(());
    }
}

pub fn spawn_kernel(
    state_ref: &AppStateRef,
    kernel_ctx: KernelCtx,
    kernel_port: u16,
) -> anyhow::Result<KernelHandle> {
    let program = std::env::var("TWINSONG_PYTHON")
        .map(PathBuf::from)
        .or_else(|_| which::which("python"))
        .or_else(|_| which::which("python3"))?;
    let mut cmd = tokio::process::Command::new(program);
    let stdout_path = temp_dir().join("kernel.out");
    let stderr_path = temp_dir().join("kernel.err");
    let stdout_file = File::create(&stdout_path).expect("Cannot log file");
    let stderr_file = File::create(&stderr_path).expect("Cannot log file");

    cmd.env("KERNEL_ID", kernel_ctx.kernel_id.to_string())
        .env("KERNEL_CONNECT", format!("127.0.0.1:{kernel_port}"))
        .stdout(Stdio::from(stdout_file))
        .stderr(Stdio::from(stderr_file))
        .kill_on_drop(true)
        .arg("-m")
        .arg("twinsong.driver");
    tracing::debug!("Spawning new kernel command {:?}", &cmd);
    let child = cmd.spawn()?;
    let pid = child.id().unwrap_or(0);
    let (sender, receiver) = oneshot::channel();
    let state_ref = state_ref.clone();
    spawn(async move {
        tokio::select! {
            _ = kernel_guard(child) => {
                let mut state = state_ref.lock().unwrap();
                if let Ok(kernel) = state.find_kernel_by_id_mut(kernel_ctx.kernel_id) {
                    // TODO: Remove kernel from state
                    let notebook_id = kernel.notebook_id();
                    let run_id = kernel.run_id();
                    let notebook = state.find_notebook_by_id_mut(notebook_id).unwrap();
                    let run = notebook.find_run_by_id_mut(run_id).unwrap();
                    run.set_crashed_kernel("Process unexpectedly closed".to_string());
                    notebook.send_message(ToClientMessage::KernelCrashed {
                        notebook_id,
                        run_id,
                        message: "Process unexpectedly closed".to_string(),
                    })
                }
            }
            _ = receiver => {}
        }
    });
    Ok(KernelHandle::new(kernel_ctx, sender, pid))
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
                let notebook = state.notebook_by_id_mut(notebook_id);
                notebook
                    .find_run_by_id_mut(run_id)
                    .unwrap()
                    .set_running_kernel(kernel_id);
                notebook.send_message(ToClientMessage::KernelReady {
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
