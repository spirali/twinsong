use crate::http::http_server_main;
use clap::Parser;
use std::sync::{Arc, Mutex};

pub mod client_messages;
mod http;
mod kernel;
mod notebook;
mod reactor;
mod state;
mod utils;

use crate::kernel::init_kernel_manager;
use crate::state::AppState;
pub use utils::ids::{AsIdVec, ItemId};

#[derive(Parser)]
#[command(version, about, long_about = None)]
struct Args {
    /// Sets a custom config file
    #[arg(long, default_value = "4500")]
    port: u16,
}

#[tokio::main(flavor = "current_thread")]
async fn main() {
    let local = tokio::task::LocalSet::new();
    local
        .run_until(async move {
            let args = Args::parse();
            tracing_subscriber::fmt::init();
            let state = Arc::new(Mutex::new(AppState::new()));
            init_kernel_manager(&state).await.unwrap();
            http_server_main(state, args.port).await.unwrap();
        })
        .await;
}
