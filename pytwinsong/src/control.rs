use crate::executor::FromExecutorMessage;
use anyhow::anyhow;
use comm::messages::{ComputeMsg, FromKernelMessage, ToKernelMessage};
use comm::scopes::SerializedGlobals;
use comm::{Codec, make_protocol_builder, parse_to_kernel_message, serialize_from_kernel_message};
use futures_util::SinkExt;
use futures_util::stream::{SplitSink, SplitStream, StreamExt};
use tokio::net::TcpStream;
use tokio::runtime::Builder;
use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender, unbounded_channel};
use tokio_util::bytes::Bytes;
use uuid::Uuid;

pub fn start_control_process() -> (
    UnboundedSender<FromExecutorMessage>,
    UnboundedReceiver<ComputeMsg>,
) {
    let (c_sender, c_receiver) = unbounded_channel();
    let (o_sender, o_receiver) = unbounded_channel();
    std::thread::spawn(|| {
        Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
            .block_on(async {
                if let Err(e) = controller_main(c_sender, o_receiver).await {
                    panic!("Error: {:?}", e);
                }
            });
    });
    (o_sender, c_receiver)
}

async fn controller_main(
    c_sender: UnboundedSender<ComputeMsg>,
    o_receiver: UnboundedReceiver<FromExecutorMessage>,
) -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();
    let addr = std::env::var("KERNEL_CONNECT")
        .map_err(|_| anyhow!("Variable KERNEL_CONNECT not defined"))?;
    let id_str =
        std::env::var("KERNEL_ID").map_err(|_| anyhow!("Variable KERNEL_ID not defined"))?;
    let kernel_id = Uuid::parse_str(&id_str)?;
    let socket = TcpStream::connect(&addr).await?;
    let (mut sender, receiver) = make_protocol_builder().new_framed(socket).split();
    sender
        .send(serialize_from_kernel_message(FromKernelMessage::Login { kernel_id })?.into())
        .await?;

    tokio::select! {
        r = async {
            forward_sender(sender, o_receiver).await
        } => r,
        r = async {
            handle_recv(receiver, c_sender).await
        } => r
    }
}

async fn forward_sender(
    mut sender: SplitSink<Codec, Bytes>,
    mut o_receiver: UnboundedReceiver<FromExecutorMessage>,
) -> anyhow::Result<()> {
    let mut last_globals = SerializedGlobals::default();
    while let Some(msg) = o_receiver.recv().await {
        let out_msg = match msg {
            FromExecutorMessage::Output {
                value,
                cell_id,
                flag,
                update: globals,
            } => {
                let update = globals.map(|g| {
                    let update = g.create_update(Some(&last_globals));
                    last_globals = g;
                    update
                });
                FromKernelMessage::Output {
                    value,
                    cell_id,
                    flag,
                    update,
                }
            }
        };
        let msg = serialize_from_kernel_message(out_msg)?;
        sender.send(msg.into()).await?
    }
    Ok(())
}

async fn handle_recv(
    mut receiver: SplitStream<Codec>,
    c_sender: UnboundedSender<ComputeMsg>,
) -> anyhow::Result<()> {
    while let Some(message) = receiver.next().await {
        let message = message?;
        match parse_to_kernel_message(&message)? {
            ToKernelMessage::Compute(msg) => {
                c_sender.send(msg).unwrap();
            }
        }
    }
    Ok(())
}
