use crate::client_messages::{
    parse_client_message, serialize_client_message, FromClientMessage, NotebookDesc,
    ToClientMessage,
};
use crate::notebook::{generate_new_notebook_path, Notebook};
use crate::reactor::{load_notebook, query_notebooks, run_code, save_notebook, start_kernel};
use crate::state::AppStateRef;
use axum::body::Body;
use axum::extract::ws::{Message, WebSocket};
use axum::extract::{Path, State, WebSocketUpgrade};
use axum::http::header;
use axum::response::{IntoResponse, Response};
use axum::routing::{any, get};
use axum::Router;
use futures_util::stream::{SplitSink, SplitStream};
use futures_util::SinkExt;
use futures_util::StreamExt;
use std::io::Write;
use termcolor::{Color, ColorChoice, ColorSpec, StandardStream, WriteColor};
use tokio::sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender};
use tracing::log;

pub(crate) async fn http_server_main(state: AppStateRef, port: u16) -> anyhow::Result<()> {
    let app = Router::new()
        .route("/", get(index))
        .route("/assets/{name}", get(get_assets))
        .route("/twinsong.jpeg", get(twinsong_jpeg))
        .route("/ws", any(ws_handler))
        .with_state(state);
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}")).await?;

    {
        let mut stdout = StandardStream::stdout(ColorChoice::Always);
        stdout.set_color(ColorSpec::new().set_fg(Some(Color::Ansi256(75))))?;
        write!(&mut stdout, "\n  Twin")?;
        stdout.set_color(ColorSpec::new().set_fg(Some(Color::Ansi256(214))))?;
        write!(&mut stdout, "Song")?;
        stdout.set_color(ColorSpec::new().set_fg(None))?;
        write!(&mut stdout, " v{}", env!("CARGO_PKG_VERSION"))?;
        stdout.set_color(ColorSpec::new().set_bold(true))?;
        writeln!(&mut stdout, "\n\n   ➜ http://127.0.0.1:{port}\n")?;
    }
    axum::serve(listener, app).await?;
    Ok(())
}

async fn get_assets(Path(name): Path<String>) -> impl IntoResponse {
    let (data, content_type) = if name.ends_with("css") {
        (
            include_bytes!("../../browser/ui/dist/assets/index.css.gz").as_ref(),
            "text/css",
        )
    } else {
        (
            include_bytes!("../../browser/ui/dist/assets/index.js.gz").as_ref(),
            "text/javascript",
        )
    };
    Response::builder()
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CONTENT_ENCODING, "gzip")
        .body(Body::from(data))
        .unwrap()
}

async fn index(State(state): State<AppStateRef>) -> impl IntoResponse {
    let port = state.lock().unwrap().http_port();
    let html = include_str!("../../browser/ui/dist/index.html")
        .replace("%URL%", format!("ws://127.0.0.1:{port}/ws").as_str());
    Response::builder()
        .header(header::CONTENT_TYPE, "text/html")
        .body(Body::from(html))
        .unwrap()
}

async fn twinsong_jpeg() -> impl IntoResponse {
    Response::builder()
        .header(header::CONTENT_TYPE, "image/jpeg")
        .body(Body::from(
            include_bytes!("../../browser/ui/dist/twinsong.jpeg").as_ref(),
        ))
        .unwrap()
}

async fn ws_handler(ws: WebSocketUpgrade, State(state): State<AppStateRef>) -> impl IntoResponse {
    tracing::debug!("New websocket connection");
    ws.on_upgrade(move |socket| async move {
        if let Err(e) = handle_socket(socket, &state).await {
            tracing::error!("Websocket error: {e}");
        }
    })
}

async fn handle_socket(mut socket: WebSocket, state_ref: &AppStateRef) -> anyhow::Result<()> {
    if let Some(msg) = socket.recv().await {
        let msg = msg?;
        if let Message::Text(_text) = msg {
            // TODO: Implement loging with TOKEN
            let state = state_ref.lock().unwrap();
        } else {
            tracing::error!("Invalid first message");
        }
    } else {
        tracing::debug!("Connection terminated without hello message");
        return Ok(());
    }
    let (sender, receiver) = socket.split();
    let (tx, rx) = unbounded_channel::<Message>();
    let r = tokio::select! {
        r = async {
            forward_sender(sender, rx).await
        } => r,
        r = async {
            recv_client_messages(receiver, state_ref, tx).await
        } => r
    };
    r
}

async fn forward_sender(
    mut sender: SplitSink<WebSocket, Message>,
    mut rx: UnboundedReceiver<Message>,
) -> anyhow::Result<()> {
    while let Some(msg) = rx.recv().await {
        sender.send(msg).await?
    }
    Ok(())
}

async fn recv_client_messages(
    mut receiver: SplitStream<WebSocket>,
    state_ref: &AppStateRef,
    sender: UnboundedSender<Message>,
) -> anyhow::Result<()> {
    while let Some(data) = receiver.next().await {
        let data = data?;
        if let Message::Close(_) = data {
            break;
        }
        let message = parse_client_message(data)?;
        match message {
            FromClientMessage::CreateNewNotebook(_) => {
                let mut state = state_ref.lock().unwrap();
                let notebook_id = state.new_notebook_id();
                tracing::debug!("Creating new notebook {notebook_id}");
                let mut notebook = Notebook::new(generate_new_notebook_path()?);
                notebook.set_observer(sender.clone());
                notebook.send_message(ToClientMessage::NewNotebook {
                    notebook: notebook.notebook_desc(notebook_id),
                });
                state.add_notebook(notebook_id, notebook);
            }
            FromClientMessage::CreateNewKernel(msg) => {
                tracing::debug!("Creating new kernel for notebook {}", msg.notebook_id);
                let mut state = state_ref.lock().unwrap();
                if let Err(e) = start_kernel(
                    &mut state,
                    state_ref,
                    msg.notebook_id,
                    msg.run_id,
                    msg.run_title,
                ) {
                    log::error!("Starting kernel failed {e}");
                    let _ =
                        sender.send(serialize_client_message(ToClientMessage::KernelCrashed {
                            notebook_id: msg.notebook_id,
                            run_id: msg.run_id,
                            message: e.to_string(),
                        })?);
                }
                // if let Err(e) = create_new_kernel(state, msg).await {
                //     tracing::error!("Failed to create new kernel: {e}");
                //     socket
                //         .send(serialize_client_message(ToClientMessage::Error {
                //             message: &e.to_string(),
                //         })?)
                //         .await?;
                // }
            }
            FromClientMessage::RunCell(msg) => {
                let mut state = state_ref.lock().unwrap();
                if let Err(e) = run_code(&mut state, msg) {
                    log::error!("Running code failed: {e}");
                    let _ = sender.send(serialize_client_message(ToClientMessage::Error {
                        message: &e.to_string(),
                    })?);
                }
            }
            FromClientMessage::SaveNotebook(msg) => {
                let mut state = state_ref.lock().unwrap();
                save_notebook(&mut state, &state_ref, msg)?;
            }
            FromClientMessage::LoadNotebook(msg) => {
                let mut state = state_ref.lock().unwrap();
                load_notebook(&mut state, &state_ref, msg, sender.clone())?;
            }
            FromClientMessage::QueryNotebooks => {
                let mut state = state_ref.lock().unwrap();
                query_notebooks(&mut state, &sender)?;
            }
        }
    }
    Ok(())
}
