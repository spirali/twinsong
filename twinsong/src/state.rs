use crate::client_messages::KernelInfo;
use crate::kernel::KernelHandle;
use crate::notebook::{KernelId, Notebook, NotebookId};
use anyhow::anyhow;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

pub(crate) struct AppState {
    notebooks: HashMap<NotebookId, Notebook>,
    kernels: HashMap<KernelId, KernelHandle>,
    id_counter: u32,
    kernel_port: u16,
    http_port: u16,
}

pub(crate) type AppStateRef = Arc<Mutex<AppState>>;

impl AppState {
    pub fn new(http_port: u16) -> Self {
        AppState {
            notebooks: HashMap::new(),
            kernels: HashMap::new(),
            id_counter: 0,
            kernel_port: 0,
            http_port,
        }
    }

    pub(crate) fn kernel_list(&self) -> Vec<KernelInfo> {
        self.kernels
            .iter()
            .map(|(kernel_id, kernel_handle)| kernel_handle.kernel_info(*kernel_id))
            .collect()
    }

    pub fn new_notebook_id(&mut self) -> NotebookId {
        self.id_counter += 1;
        NotebookId::new(self.id_counter)
    }

    pub fn add_notebook(&mut self, notebook_id: NotebookId, notebook: Notebook) {
        self.notebooks.insert(notebook_id, notebook);
    }

    pub fn notebook_by_id_mut(&mut self, id: NotebookId) -> &mut Notebook {
        self.notebooks.get_mut(&id).unwrap()
    }

    pub fn find_notebook_by_id_mut(&mut self, id: NotebookId) -> anyhow::Result<&mut Notebook> {
        self.notebooks
            .get_mut(&id)
            .ok_or(anyhow!("Notebook not found"))
    }

    pub fn get_notebook_by_id(&self, id: NotebookId) -> Option<&Notebook> {
        self.notebooks.get(&id)
    }

    pub fn add_kernel(&mut self, kernel_id: KernelId, kernel: KernelHandle) {
        assert!(self.kernels.insert(kernel_id, kernel).is_none());
    }

    pub fn stop_kernel(&mut self, kernel_id: KernelId) {
        if let Some(kernel_handle) = self.kernels.remove(&kernel_id) {
            tracing::debug!("Stopping kernel {}", kernel_id);
            kernel_handle.stop();
        }
    }

    pub fn set_kernel_port(&mut self, kernel_port: u16) {
        self.kernel_port = kernel_port;
    }

    pub fn kernel_port(&self) -> u16 {
        self.kernel_port
    }

    pub fn http_port(&self) -> u16 {
        self.http_port
    }

    pub fn find_kernel_by_id_mut(&mut self, id: KernelId) -> anyhow::Result<&mut KernelHandle> {
        self.kernels.get_mut(&id).ok_or(anyhow!("Kernel not found"))
    }

    pub fn get_kernel_by_id_mut(&mut self, id: KernelId) -> Option<&mut KernelHandle> {
        self.kernels.get_mut(&id)
    }

    pub fn get_notebook_by_path_mut(&mut self, path: &str) -> Option<(NotebookId, &mut Notebook)> {
        self.notebooks
            .iter_mut()
            .filter_map(|(id, notebook)| {
                if notebook.path == path {
                    Some((*id, notebook))
                } else {
                    None
                }
            })
            .next()
    }
}
