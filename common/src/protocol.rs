use crate::messages::{FromKernelMessage, ToKernelMessage};
use tokio_util::codec::LengthDelimitedCodec;
use tokio_util::codec::length_delimited::Builder;

pub fn make_protocol_builder() -> Builder {
    *LengthDelimitedCodec::builder()
        .little_endian()
        .max_frame_length(128 * 1024 * 1024)
}

#[inline]
pub fn parse_from_kernel_message(data: &[u8]) -> bincode::Result<FromKernelMessage> {
    bincode::deserialize(data)
}

#[inline]
pub fn parse_to_kernel_message(data: &[u8]) -> bincode::Result<ToKernelMessage> {
    bincode::deserialize(data)
}

#[inline]
pub fn serialize_from_kernel_message(message: FromKernelMessage) -> bincode::Result<Vec<u8>> {
    bincode::serialize(&message)
}

#[inline]
pub fn serialize_to_kernel_message(message: ToKernelMessage) -> bincode::Result<Vec<u8>> {
    bincode::serialize(&message)
}
