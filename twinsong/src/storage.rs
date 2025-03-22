use crate::notebook::{EditorGroup, KernelState, Notebook, OutputCell, Run, RunId};
use anyhow::bail;
use comm::scopes::SerializedGlobals;
use jiff::Timestamp;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use uuid::Uuid;

const VERSION_STRING: &str = "twinsong 0.0.1";

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
enum KernelStateStore {
    Closed,
    Crashed { message: String },
}

#[derive(Debug, Serialize)]
struct RunStore<'a> {
    title: &'a str,
    id: RunId,
    created: Timestamp,
    kernel_state: KernelStateStore,
    output_cells: &'a [OutputCell],
    globals: &'a SerializedGlobals,
}

#[derive(Debug, Serialize)]
struct NotebookStore<'a> {
    version: &'a str,
    editor_root: &'a EditorGroup,
}

#[derive(Debug, Deserialize)]
struct RunLoad {
    id: RunId,
    created: Timestamp,
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
}

pub(crate) struct SerializedNotebook {
    notebook_data: String,
    runs: Vec<(String, String)>,
}

fn create_run_filename(name: &str, uuid: RunId) -> String {
    let mut str = String::with_capacity(24);
    for c in name.chars().take(8) {
        match c {
            c if c.is_alphanumeric() => str.push(c),
            '_' | '-' | '+' | '.' | ':' => str.push(c),
            _ => str.push('_'),
        }
    }
    str.push('_');
    str.push_str(&uuid.to_string()[..8]);
    str.push_str(".run");
    str
}

impl SerializedNotebook {
    pub async fn save(&self, path: &Path) -> anyhow::Result<()> {
        tokio::fs::write(&path, self.notebook_data.as_bytes()).await?;
        let tmp_path = path
            .parent()
            .unwrap()
            .join(Uuid::new_v4().to_string().as_str());
        tokio::fs::create_dir(&tmp_path).await?;
        for (filename, data) in &self.runs {
            let path = tmp_path.join(filename);
            tokio::fs::write(&path, data.as_bytes()).await?;
        }
        let mut path_str = path.as_os_str().to_os_string();
        path_str.push(".runs");
        let target_path = Path::new(&path_str);
        if target_path.exists() {
            tokio::fs::remove_dir_all(target_path).await?;
        }
        tokio::fs::rename(&tmp_path, &target_path).await?;
        Ok(())
    }

    pub async fn load(path: &Path) -> anyhow::Result<Self> {
        let notebook_data = tokio::fs::read_to_string(&path).await?;
        let mut path_str = path.as_os_str().to_os_string();
        path_str.push(".runs");
        let runs_path = Path::new(&path_str);

        let runs = if runs_path.exists() {
            let mut runs = Vec::new();
            for entry in std::fs::read_dir(runs_path)? {
                let entry = entry?;
                if entry.file_type()?.is_file()
                    && entry.file_name().to_string_lossy().ends_with(".run")
                {
                    runs.push((
                        String::new(),
                        tokio::fs::read_to_string(&entry.path()).await?,
                    ));
                }
            }
            runs
        } else {
            Vec::new()
        };
        Ok(SerializedNotebook {
            notebook_data,
            runs,
        })
    }
}

pub(crate) fn serialize_notebook(notebook: &Notebook) -> anyhow::Result<SerializedNotebook> {
    let runs: Vec<(String, String)> = notebook
        .runs()
        .map(|(run_id, run)| {
            let store = RunStore {
                title: run.title(),
                id: run_id,
                created: run.created(),
                kernel_state: match run.kernel_state() {
                    KernelState::Crashed(s) => KernelStateStore::Crashed { message: s.clone() },
                    _ => KernelStateStore::Closed,
                },
                output_cells: run.output_cells(),
                globals: run.globals(),
            };
            let data = toml::to_string(&store)?;
            Ok((create_run_filename(run.title(), run_id), data))
        })
        .collect::<anyhow::Result<_>>()?;
    let s_notebook = NotebookStore {
        version: VERSION_STRING,
        editor_root: &notebook.editor_root,
    };
    Ok(SerializedNotebook {
        notebook_data: toml::to_string(&s_notebook)?,
        runs,
    })
}

pub(crate) fn deserialize_notebook(
    serialized_notebook: &SerializedNotebook,
) -> anyhow::Result<Notebook> {
    let store: NotebookLoad = toml::from_str(&serialized_notebook.notebook_data)?;
    if store.version != VERSION_STRING {
        bail!("Invalid version")
    }
    let mut runs: HashMap<RunId, Run> = HashMap::new();
    for (_, run_data) in &serialized_notebook.runs {
        let run_load: RunLoad = toml::from_str(run_data)?;
        runs.insert(
            run_load.id,
            Run::new(
                run_load.title,
                run_load.output_cells,
                match run_load.kernel_state {
                    KernelStateStore::Closed => KernelState::Closed,
                    KernelStateStore::Crashed { message } => KernelState::Crashed(message),
                },
                run_load.globals,
                run_load.created,
            ),
        );
    }
    let mut run_order: Vec<_> = runs.keys().copied().collect();
    run_order.sort_unstable_by_key(|id| runs.get(id).unwrap().created());
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
