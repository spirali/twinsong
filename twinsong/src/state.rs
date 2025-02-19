use crate::notebook::{Notebook, NotebookId, Run, RunId};
use anyhow::anyhow;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

pub struct AppState {
    notebooks: HashMap<NotebookId, Notebook>,
    runs: HashMap<RunId, Run>,
    id_counter: u32,
    kernel_port: u16,
    http_port: u16,
}

pub type AppStateRef = Arc<Mutex<AppState>>;

impl AppState {
    pub fn new(http_port: u16) -> Self {
        AppState {
            notebooks: HashMap::new(),
            runs: HashMap::new(),
            id_counter: 0,
            kernel_port: 0,
            http_port,
        }
    }

    pub fn new_notebook_id(&mut self) -> NotebookId {
        self.id_counter += 1;
        self.id_counter.into()
    }

    pub fn add_notebook(&mut self, notebook: Notebook) {
        let id = notebook.id;
        self.notebooks.insert(id, notebook);
    }

    pub fn notebook_by_id(&self, id: NotebookId) -> &Notebook {
        self.notebooks.get(&id).unwrap()
    }

    pub fn find_notebook_by_id(&self, id: NotebookId) -> anyhow::Result<&Notebook> {
        self.notebooks.get(&id).ok_or(anyhow!("Notebook not found"))
    }

    pub fn find_notebook_by_id_mut(&mut self, id: NotebookId) -> anyhow::Result<&mut Notebook> {
        self.notebooks
            .get_mut(&id)
            .ok_or(anyhow!("Notebook not found"))
    }

    pub fn add_run(&mut self, run_id: RunId, run: Run) {
        assert!(self.runs.insert(run_id, run).is_none());
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

    pub fn run_by_id(&self, id: RunId) -> &Run {
        self.runs.get(&id).unwrap()
    }

    pub fn get_run_by_id(&self, id: RunId) -> Option<&Run> {
        self.runs.get(&id)
    }

    pub fn find_run_by_id(&self, id: RunId) -> anyhow::Result<&Run> {
        self.runs.get(&id).ok_or(anyhow!("Kernel not found"))
    }

    pub fn find_run_by_id_mut(&mut self, id: RunId) -> anyhow::Result<&mut Run> {
        self.runs.get_mut(&id).ok_or(anyhow!("Kernel not found"))
    }
}
