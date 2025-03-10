use crate::executor::FromExecutorMessage;
use anyhow::anyhow;
use comm::messages::{ComputeMsg, FromKernelMessage, ToKernelMessage};
use comm::{make_protocol_builder, parse_to_kernel_message, serialize_from_kernel_message, Codec};
use futures_util::stream::{SplitSink, SplitStream, StreamExt};
use futures_util::SinkExt;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::net::TcpStream;
use tokio::runtime::Builder;
use tokio::sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender};
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
    let mut last_globals: HashMap<String, Arc<String>> = HashMap::new();
    while let Some(msg) = o_receiver.recv().await {
        let out_msg = match msg {
            FromExecutorMessage::Output {
                value,
                cell_id,
                flag,
                globals,
            } => {
                dbg!(&last_globals);
                let globals = if let Some(new_globals) = globals {
                    let g = new_globals
                        .iter()
                        .map(|(name, value)| {
                            (
                                name.clone(),
                                if let Some(true) =
                                    last_globals.get(name).map(|v| v.as_str() == value.as_str())
                                {
                                    None
                                } else {
                                    Some(value.clone())
                                },
                            )
                        })
                        .collect();
                    last_globals = new_globals;
                    Some(g)
                } else {
                    None
                };
                dbg!(&globals);
                FromKernelMessage::Output {
                    value,
                    cell_id,
                    flag,
                    globals,
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
