use comm::messages::{FromKernelMessage, OutputFlag, OutputValue};
use pyo3::{pyclass, pymethods, PyResult};
use tokio::sync::mpsc::UnboundedSender;
use uuid::Uuid;

// A "tuple" struct
#[pyclass]
pub struct RedirectedStdio {
    sender: UnboundedSender<FromKernelMessage>,
    cell_id: Uuid,
}

impl RedirectedStdio {
    pub fn new(sender: UnboundedSender<FromKernelMessage>, cell_id: Uuid) -> Self {
        RedirectedStdio { sender, cell_id }
    }
}

#[pymethods]
impl RedirectedStdio {
    pub fn write(&self, text: String) -> PyResult<()> {
        let _ = self.sender.send(FromKernelMessage::Output {
            value: OutputValue::Text { value: text },
            cell_id: self.cell_id,
            flag: OutputFlag::Stream,
        });
        Ok(())
    }
}
