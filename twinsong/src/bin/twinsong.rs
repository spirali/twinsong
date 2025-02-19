use clap::Parser;

#[tokio::main(flavor = "current_thread")]
async fn main() {
    twinsong::server_cli(None).await;
}
