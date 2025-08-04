import shutil
import uuid

import toml
import psutil
import time

from conftest import Kernel
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


def test_globals_update_without_scopes(client):
    r = client.create_new_notebook()
    k = client.create_new_kernel(r["notebook"]["id"])
    k.run_code("x = 2")
    assert len(k.last_update["variables"]) == 1
    x = build_jobject_from_text(k.last_update["variables"]["x"])
    assert x == {"kind": "number", "repr": "2", "value_type": "int"}

    k.run_code("x = 3\ny = 4")
    print(k.last_update)
    assert len(k.last_update["variables"]) == 2
    x = build_jobject_from_text(k.last_update["variables"]["x"])
    assert x == {"kind": "number", "repr": "3", "value_type": "int"}
    x = build_jobject_from_text(k.last_update["variables"]["y"])
    assert x == {"kind": "number", "repr": "4", "value_type": "int"}

    k.run_code("x = 5")
    assert len(k.last_update["variables"]) == 2
    x = build_jobject_from_text(k.last_update["variables"]["x"])
    assert x == {"kind": "number", "repr": "5", "value_type": "int"}
    assert k.last_update["variables"]["y"] is None


def test_globals_update_scopes(client):
    r = client.create_new_notebook()
    k = client.create_new_kernel(r["notebook"]["id"])
    k.run_code("x = 2")
    group_id1 = str(uuid.uuid4())
    group_id2 = str(uuid.uuid4())
    k.run_code(
        {
            "type": "Group",
            "id": group_id1,
            "name": "G1",
            "scope": "Own",
            "children": [
                {"type": "Cell", "id": str(uuid.uuid4()), "code": "x = 3"},
            ],
        }
    )

    assert len(k.last_update["children"]) == 1
    assert k.last_update["name"] == ""
    assert k.last_update["children"][group_id1]["name"] == "G1"

    x = build_jobject_from_text(k.last_update["children"][group_id1]["variables"]["x"])
    assert x == {"kind": "number", "repr": "3", "value_type": "int"}

    k.run_code(
        {
            "type": "Group",
            "id": group_id2,
            "name": "G1",
            "scope": "Inherit",
            "children": [{"type": "Cell", "id": str(uuid.uuid4()), "code": "x = 4"}],
        }
    )
    assert len(k.last_update["children"]) == 1
    x = build_jobject_from_text(k.last_update["variables"]["x"])
    assert x == {"kind": "number", "repr": "4", "value_type": "int"}
    assert k.last_update["children"][group_id1]["variables"]["x"] is None


def test_parent_scope(client):
    r = client.create_new_notebook()
    k = client.create_new_kernel(r["notebook"]["id"])
    k.run_code("x = 2")
    group_id1 = str(uuid.uuid4())
    group_id2 = str(uuid.uuid4())
    k.run_code(
        {
            "type": "Group",
            "id": group_id1,
            "name": "G1",
            "scope": "Own",
            "children": [
                {"type": "Cell", "id": str(uuid.uuid4()), "code": "x = 3"},
                {
                    "type": "Group",
                    "id": group_id2,
                    "name": "G2",
                    "scope": "Own",
                    "children": [
                        {
                            "type": "Cell",
                            "id": str(uuid.uuid4()),
                            "code": "parent_scope.x = 10; x = x - 6",
                        },
                    ],
                },
            ],
        }
    )

    x = build_jobject_from_text(k.last_update["children"][group_id1]["variables"]["x"])
    assert x == {"kind": "number", "repr": "10", "value_type": "int"}

    x = build_jobject_from_text(
        k.last_update["children"][group_id1]["children"][group_id2]["variables"]["x"]
    )
    assert x == {"kind": "number", "repr": "4", "value_type": "int"}


def test_save_notebook_plain(client):
    r = client.create_new_notebook()
    notebook_id = r["notebook"]["id"]
    path = r["notebook"]["path"]
    k = client.create_new_kernel(r["notebook"]["id"])
    k.run_code_simple("import time; print('Hello'); time.sleep(0.8); print('world!')")
    cell_id = k.last_cell_id
    editor_root = {
        "id": "a0ff2759-edf5-44ac-a367-6d86c6bc4bcf",
        "name": "root",
        "scope": "Own",
        "children": [
            {
                "type": "Cell",
                "id": "b3852a51-3782-4e11-9182-33a1455139b0",
                "code": 'print("Hello world!")',
            },
            {
                "type": "Cell",
                "id": "16918374-b87d-4a7d-8667-064a6a752ff0",
                "code": 'print("Hello world!")\nx = 10\nprint(x)\nx',
            },
        ],
    }

    runs = [
        {
            "id": k.run_id,
            "kernel_state": {"type": "Closed"},
            "output_cells": [
                {
                    "editor_node": k.last_editor_node,
                    "called_id": k.last_called_id,
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
            "editor_root": editor_root,
        }
    )
    r = client.receive_message()
    assert r == {"type": "SaveCompleted", "error": None, "notebook_id": notebook_id}
    with open(path) as f:
        data = toml.loads(f.read())
    assert data == {
        "version": "twinsong 0.0.1",
        "editor_root": editor_root,
    }
    shutil.copy(path, "copy.tsnb")
    shutil.copytree(path + ".runs", "copy.tsnb.runs")

    client.send_message({"type": "QueryDir"})
    r = client.receive_message(skip_async=False)
    assert r == {
        "type": "DirList",
        "entries": [
            {"entry_type": "Notebook", "path": "copy.tsnb"},
            {"entry_type": "File", "path": "server.out.log"},
            {"entry_type": "LoadedNotebook", "path": "test.tsnb"},
        ],
    }
    r = client.load_notebook("copy.tsnb")
    for run in r["notebook"]["runs"]:
        del run["globals"]
    assert r == {
        "type": "NewNotebook",
        "notebook": {
            "editor_root": editor_root,
            "runs": runs,
            "id": notebook_id + 1,
            "path": "copy.tsnb",
            "editor_open_nodes": ["a0ff2759-edf5-44ac-a367-6d86c6bc4bcf"],
        },
    }
    r2 = client.load_notebook("copy.tsnb")
    for run in r2["notebook"]["runs"]:
        del run["globals"]
    assert r == r2
    with open("copy.tsnb") as f:
        data2 = toml.loads(f.read())
    assert data == data2
    client.send_message({"type": "QueryDir"})
    r = client.receive_message(skip_async=False)
    print(r)
    assert r == {
        "type": "DirList",
        "entries": [
            {"entry_type": "LoadedNotebook", "path": "copy.tsnb"},
            {"entry_type": "File", "path": "server.out.log"},
            {"entry_type": "LoadedNotebook", "path": "test.tsnb"},
        ],
    }


def test_save_empty(client):
    r = client.create_new_notebook()
    notebook_id = r["notebook"]["id"]
    editor_root = r["notebook"]["editor_root"]
    client.send_message(
        {
            "type": "SaveNotebook",
            "notebook_id": notebook_id,
            "editor_root": editor_root,
        }
    )
    s = client.receive_message()
    assert s == {"type": "SaveCompleted", "error": None, "notebook_id": notebook_id}
    with open(r["notebook"]["path"]) as f:
        data = toml.loads(f.read())
    assert data == {
        "version": "twinsong 0.0.1",
        "editor_root": editor_root,
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


def test_execute_tree(client):
    r = client.create_new_notebook()
    k = client.create_new_kernel(r["notebook"]["id"])

    code = {
        "type": "Group",
        "name": "root",
        "id": "e21693b2-3b93-48e4-87ca-1b6226045438",
        "scope": "Own",
        "children": [
            {
                "type": "Group",
                "name": "root",
                "id": "b8f6e75a-dd3b-4df1-88cb-edd4e74c1771",
                "scope": "Inherit",
                "children": [
                    {
                        "type": "Cell",
                        "id": "0e093025-1030-4458-b2c8-174066568ea9",
                        "code": 'print("One")\n123',
                    }
                ],
            },
            {
                "type": "Cell",
                "id": "28a20c2e-5868-4160-b384-92996d09ccfa",
                "code": "x = 10\nx",
            },
            {
                "type": "Cell",
                "id": "5360be7d-81e4-43aa-9abd-7ac57567ed12",
                "code": 'print("Two")\nx',
            },
        ],
    }

    assert [
        {"type": "Text", "value": "One"},
        {"type": "Text", "value": "\n"},
        {"type": "Text", "value": "Two"},
        {"type": "Text", "value": "\n"},
        {"type": "Text", "value": "10"},
    ] == k.run_code(code)


def test_fork(client):
    r = client.create_new_notebook()
    notebook_id = r["notebook"]["id"]
    k = client.create_new_kernel(r["notebook"]["id"])
    group_id1 = str(uuid.uuid4())
    k.run_code(
        {
            "type": "Group",
            "id": group_id1,
            "name": "G1",
            "scope": "Own",
            "children": [
                {"type": "Cell", "id": str(uuid.uuid4()), "code": "x = 3"},
            ],
        }
    )
    new_run_id = str(uuid.uuid4())
    new_run_name = "Forked Run"
    client.send_message(
        {
            "type": "Fork",
            "notebook_id": notebook_id,
            "run_id": k.run_id,
            "new_run_id": new_run_id,
            "new_run_title": new_run_name,
        }
    )
    r = client.receive_message()
    assert r["type"] == "KernelReady"
    r = client.receive_message()
    x = r["globals"]["children"][group_id1]["variables"].pop("x")
    x = build_jobject_from_text(x)
    assert x == {"repr": "3", "value_type": "int", "kind": "number"}
    assert r == {
        "globals": {
            "children": {
                group_id1: {
                    "children": {},
                    "name": "G1",
                    "variables": {},
                }
            },
            "name": "",
            "variables": {},
        },
        "notebook_id": notebook_id,
        "run_id": new_run_id,
        "type": "NewGlobals",
    }
    new_kernel = Kernel(client, notebook_id, new_run_id)
    r = new_kernel.run_code(
        {
            "type": "Group",
            "id": group_id1,
            "name": "G1",
            "scope": "Own",
            "children": [
                {"type": "Cell", "id": str(uuid.uuid4()), "code": "x + 1"},
            ],
        }
    )
    assert r == [{"type": "Text", "value": "4"}]
