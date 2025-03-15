use crate::notebook::{EditorGroup, KernelState, Notebook, OutputCell, Run, RunId};
use anyhow::bail;
use comm::scopes::SerializedGlobals;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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
    globals: &'a SerializedGlobals,
}

#[derive(Debug, Serialize)]
struct NotebookStore<'a> {
    version: &'a str,
    editor_root: &'a EditorGroup,
    runs: Vec<RunStore<'a>>,
}

#[derive(Debug, Deserialize)]
struct RunLoad {
    id: RunId,
    title: String,
    output_cells: Vec<OutputCell>,
    kernel_state: KernelStateStore,

    #[serde(default)]
    globals: SerializedGlobals,
}

#[derive(Debug, Deserialize)]
struct NotebookLoad {
    version: String,
    editor_root: EditorGroup,
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
            globals: run.globals(),
        })
        .collect();
    let s_notebook = NotebookStore {
        version: VERSION_STRING,
        editor_root: &notebook.editor_root,
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
                    r.globals,
                ),
            )
        })
        .collect();
    let root_id = store.editor_root.id;
    Ok(Notebook {
        editor_root: store.editor_root,
        editor_open_nodes: vec![root_id],
        path: String::new(),
        runs,
        run_order,
        observer: None,
    })
}
