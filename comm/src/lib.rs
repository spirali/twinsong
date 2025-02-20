pub mod messages;
mod protocol;

use tokio::net::TcpStream;
use tokio_util::codec::{Framed, LengthDelimitedCodec};

pub type Codec = Framed<TcpStream, LengthDelimitedCodec>;

pub use protocol::{
    make_protocol_builder, parse_from_kernel_message, parse_to_kernel_message,
    serialize_from_kernel_message, serialize_to_kernel_message,
};
