use crate::notebook::{EditorCell, KernelState, Notebook, NotebookId, OutputCell, Run, RunId};
use anyhow::bail;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::collections::HashMap;
use std::path::Path;
use std::sync::mpsc::channel;

const VERSION_STRING: &str = "twinsong 0.0.1";

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
enum KernelStateStore {
    Closed,
    Crashed { message: String },
}

#[derive(Debug, Serialize)]
struct RunStore<'a> {
    id: RunId,
    title: &'a str,
    kernel_state: KernelStateStore,
    output_cells: &'a [OutputCell],
}

#[derive(Debug, Serialize)]
struct NotebookStore<'a> {
    version: &'a str,
    editor_cells: &'a [EditorCell],
    runs: Vec<RunStore<'a>>,
}

#[derive(Debug, Deserialize)]
struct RunLoad {
    id: RunId,
    title: String,
    output_cells: Vec<OutputCell>,
    kernel_state: KernelStateStore,
}

#[derive(Debug, Deserialize)]
struct NotebookLoad {
    version: String,
    editor_cells: Vec<EditorCell>,
    runs: Vec<RunLoad>,
}

pub(crate) fn serialize_notebook(notebook: &Notebook) -> anyhow::Result<String> {
    let runs: Vec<RunStore> = notebook
        .runs()
        .map(|(run_id, run)| RunStore {
            id: run_id,
            title: run.title(),
            kernel_state: match run.kernel_state() {
                KernelState::Crashed(s) => KernelStateStore::Crashed { message: s.clone() },
                _ => KernelStateStore::Closed,
            },
            output_cells: run.output_cells(),
        })
        .collect();
    let s_notebook = NotebookStore {
        version: VERSION_STRING,
        editor_cells: &notebook.editor_cells,
        runs,
    };
    Ok(toml::to_string(&s_notebook)?)
}

pub(crate) fn deserialize_notebook(data: &str) -> anyhow::Result<Notebook> {
    let store: NotebookLoad = toml::from_str(data)?;
    if store.version != VERSION_STRING {
        bail!("Invalid version")
    }
    let run_order: Vec<_> = store.runs.iter().map(|r| r.id).collect();
    let runs: HashMap<RunId, Run> = store
        .runs
        .into_iter()
        .map(|r| {
            (
                r.id,
                Run::new(
                    r.title,
                    r.output_cells,
                    match r.kernel_state {
                        KernelStateStore::Closed => KernelState::Closed,
                        KernelStateStore::Crashed { message } => KernelState::Crashed(message),
                    },
                ),
            )
        })
        .collect();
    Ok(Notebook {
        editor_cells: store.editor_cells,
        path: String::new(),
        runs,
        run_order,
        observer: None,
    })
}
