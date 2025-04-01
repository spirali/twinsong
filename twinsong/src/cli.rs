use crate::http::http_server_main;
use crate::kernel::init_kernel_manager;
use crate::state::AppState;
use clap::Parser;
use std::sync::{Arc, Mutex};

#[derive(Parser)]
#[command(version, about, long_about = None)]
struct Args {
    #[arg(long, default_value = "4050")]
    port: u16,

    #[arg(long)]
    key: Option<String>,
}

pub async fn server_cli(args: Option<Vec<String>>) {
    /*
       TODO: Implement graceful termination of kernels
       We are not explicitly setting handler when server is called
       from Python
    */
    ctrlc::set_handler(|| std::process::exit(2)).unwrap();
    let args = if let Some(args) = args {
        Args::parse_from(args)
    } else {
        Args::parse()
    };
    let local = tokio::task::LocalSet::new();
    local
        .run_until(async move {
            tracing_subscriber::fmt::init();
            let state = Arc::new(Mutex::new(AppState::new(args.port, args.key)));
            init_kernel_manager(&state).await.unwrap();
            http_server_main(state, args.port).await.unwrap();
        })
        .await;
}
