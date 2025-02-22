use crate::notebook::{EditorCell, Notebook, NotebookId};
use anyhow::bail;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::collections::HashMap;
use std::path::Path;
use std::sync::mpsc::channel;

const VERSION_STRING: &str = "twinsong 0.0.1";

#[derive(Debug, Serialize)]
struct NotebookStore<'a> {
    version: &'a str,
    editor_cells: &'a [EditorCell],
}

#[derive(Debug, Deserialize)]
struct NotebookLoad {
    version: String,
    editor_cells: Vec<EditorCell>,
}

pub(crate) enum StorageCommand {
    Save { notebook_id: NotebookId },
}

pub(crate) fn serialize_notebook(notebook: &Notebook) -> anyhow::Result<String> {
    let s_notebook = NotebookStore {
        version: VERSION_STRING,
        editor_cells: &notebook.editor_cells,
    };
    Ok(toml::to_string(&s_notebook)?)
}

pub(crate) fn deserialize_notebook(data: &str) -> anyhow::Result<Notebook> {
    let store: NotebookLoad = toml::from_str(data)?;
    if store.version != VERSION_STRING {
        bail!("Invalid version")
    }
    Ok(Notebook {
        editor_cells: store.editor_cells,
        path: String::new(),
        runs: HashMap::new(),
        run_order: Vec::new(),
        observers: vec![],
    })
}
