import shutil
import toml
import psutil
import time

from utils import build_jobject_from_text


def test_execute_command(client):
    r = client.create_new_notebook()
    k = client.create_new_kernel(r["notebook"]["id"])
    assert "3" == k.run_code_simple("1 + 2")
    assert [
        {"type": "Text", "value": "Hello"},
        {"type": "Text", "value": "\n"},
        {"type": "Text", "value": "World"},
        {"type": "Text", "value": "\n"},
        {"type": "None"},
    ] == k.run_code("print('Hello')\nprint('World')")


def test_globals_update(client):
    r = client.create_new_notebook()
    k = client.create_new_kernel(r["notebook"]["id"])
    k.run_code("x = 2")
    assert len(k.last_globals) == 1
    x = build_jobject_from_text(k.last_globals["x"])
    assert x == {"kind": "number", "repr": "2", "value_type": "int"}

    k.run_code("x = 3\ny = 4")
    print(k.last_globals)
    assert len(k.last_globals) == 2
    x = build_jobject_from_text(k.last_globals["x"])
    assert x == {"kind": "number", "repr": "3", "value_type": "int"}
    x = build_jobject_from_text(k.last_globals["y"])
    assert x == {"kind": "number", "repr": "4", "value_type": "int"}

    k.run_code("x = 5")
    assert len(k.last_globals) == 2
    x = build_jobject_from_text(k.last_globals["x"])
    assert x == {"kind": "number", "repr": "5", "value_type": "int"}
    assert k.last_globals["y"] is None


def test_save_notebook_plain(client):
    r = client.create_new_notebook()
    notebook_id = r["notebook"]["id"]
    path = r["notebook"]["path"]
    k = client.create_new_kernel(r["notebook"]["id"])
    k.run_code_simple("import time; print('Hello'); time.sleep(0.8); print('world!')")
    cell_id = k.last_cell_id
    editor_cells = [
        {
            "id": "b3852a51-3782-4e11-9182-33a1455139b0",
            "value": 'print("Hello world!")',
        },
        {
            "id": "16918374-b87d-4a7d-8667-064a6a752ff0",
            "value": 'print("Hello world!")\nx = 10\nprint(x)\nx',
        },
    ]

    runs = [
        {
            "id": k.run_id,
            "kernel_state": {"type": "Closed"},
            "output_cells": [
                {
                    "editor_cell": k.last_editor_cell,
                    "flag": "Success",
                    "id": cell_id,
                    "values": [
                        {
                            "type": "Text",
                            "value": "Hello\nworld!\n",
                        },
                        {
                            "type": "None",
                        },
                    ],
                },
            ],
            "title": "Run Test",
        }
    ]
    client.send_message(
        {
            "type": "SaveNotebook",
            "notebook_id": notebook_id,
            "editor_cells": editor_cells,
        }
    )
    r = client.receive_message()
    assert r == {"type": "SaveCompleted", "error": None, "notebook_id": notebook_id}
    with open(path) as f:
        data = toml.loads(f.read())
    for run in data["runs"]:
        del run["globals"]
    assert data == {
        "version": "twinsong 0.0.1",
        "editor_cells": editor_cells,
        "runs": runs,
    }
    shutil.copy(path, "copy.tsnb")

    client.send_message({"type": "QueryDir"})
    r = client.receive_message(skip_async=False)
    assert r == {
        "type": "DirList",
        "entries": [
            {"entry_type": "Notebook", "path": "copy.tsnb"},
            {"entry_type": "LoadedNotebook", "path": "notebook_1.tsnb"},
            {"entry_type": "File", "path": "server.out.log"},
        ],
    }
    r = client.load_notebook("copy.tsnb")
    for run in r["notebook"]["runs"]:
        del run["globals"]
    assert r == {
        "type": "NewNotebook",
        "notebook": {
            "editor_cells": editor_cells,
            "runs": runs,
            "id": notebook_id + 1,
            "path": "copy.tsnb",
        },
    }
    r2 = client.load_notebook("copy.tsnb")
    for run in r2["notebook"]["runs"]:
        del run["globals"]
    assert r == r2
    with open("copy.tsnb") as f:
        data2 = toml.loads(f.read())
    for run in data2["runs"]:
        del run["globals"]
    assert data == data2
    client.send_message({"type": "QueryDir"})
    r = client.receive_message(skip_async=False)
    print(r)
    assert r == {
        "type": "DirList",
        "entries": [
            {"entry_type": "LoadedNotebook", "path": "copy.tsnb"},
            {"entry_type": "LoadedNotebook", "path": "notebook_1.tsnb"},
            {"entry_type": "File", "path": "server.out.log"},
        ],
    }


def test_save_empty(client):
    r = client.create_new_notebook()
    notebook_id = r["notebook"]["id"]
    editor_cells = r["notebook"]["editor_cells"]
    client.send_message(
        {
            "type": "SaveNotebook",
            "notebook_id": notebook_id,
            "editor_cells": editor_cells,
        }
    )
    s = client.receive_message()
    assert s == {"type": "SaveCompleted", "error": None, "notebook_id": notebook_id}
    with open(r["notebook"]["path"]) as f:
        data = toml.loads(f.read())
    assert data == {
        "version": "twinsong 0.0.1",
        "runs": [],
        "editor_cells": editor_cells,
    }


def test_close_run(client):
    r = client.create_new_notebook()
    notebook_id = r["notebook"]["id"]
    path = r["notebook"]["path"]
    k1 = client.create_new_kernel(r["notebook"]["id"])
    client.create_new_kernel(r["notebook"]["id"])

    r = client.load_notebook(path)
    assert len(r["notebook"]["runs"]) == 2
    klist = client.kernel_list()
    print(klist)
    assert len(klist) == 2

    for kernel in klist:
        assert psutil.pid_exists(kernel["pid"])

    client.send_message(
        {
            "type": "CloseRun",
            "notebook_id": notebook_id,
            "run_id": k1.run_id,
        }
    )
    time.sleep(1)
    r = client.load_notebook(path)
    assert len(r["notebook"]["runs"]) == 1
    klist2 = client.kernel_list()
    assert len(klist2) == 1
    running = 0
    for kernel in klist:
        if psutil.pid_exists(kernel["pid"]):
            running += 1
    assert running == 1
