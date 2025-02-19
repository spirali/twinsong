use crate::http::http_server_main;
use clap::Parser;
use std::sync::{Arc, Mutex};

mod cli;
pub mod client_messages;
mod http;
mod kernel;
mod notebook;
mod reactor;
mod state;
mod utils;

pub use cli::server_cli;

use crate::kernel::init_kernel_manager;
use crate::state::AppState;
use utils::ids::{AsIdVec, ItemId};
