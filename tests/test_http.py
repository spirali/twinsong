import shutil

import toml


def test_execute_command(client):
    r = client.create_new_notebook()
    k = client.create_new_kernel(r["notebook"]["id"])
    assert "3" == k.run_code_simple("1 + 2")
    assert [
               {"Text": {"value": "Hello"}},
               {"Text": {"value": "\n"}},
               {"Text": {"value": "World"}},
               {"Text": {"value": "\n"}},
               "None",
           ] == k.run_code("print('Hello')\nprint('World')")


def test_save_notebook_plain(client):
    r = client.create_new_notebook()
    notebook_id = r["notebook"]["id"]
    path = r["notebook"]["path"] + ".tsnb"
    editor_cells = [
        {
            "id": "b3852a51-3782-4e11-9182-33a1455139b0",
            "value": "print(\"Hello world!\")"
        },
        {
            "id": "16918374-b87d-4a7d-8667-064a6a752ff0",
            "value": "print(\"Hello world!\")\nx = 10\nprint(x)\nx"
        }
    ]
    client.send_message({"type": "SaveNotebook",
                         "notebook_id": notebook_id,
                         "editor_cells": editor_cells})
    r = client.receive_message()
    assert r == {'type': 'SaveCompleted', 'error': None, 'notebook_id': notebook_id}
    with open(path) as f:
        data = toml.loads(f.read())
    shutil.copy(path, "copy.tsnb")
    assert data == {
        "version": "twinsong 0.0.1",
        "editor_cells": editor_cells
    }
    client.send_message({"type": "LoadNotebook",
                         "path": "copy"})
    r = client.receive_message()
    assert r == {
        "type": "NewNotebook",
        "notebook": {
            "editor_cells": editor_cells,
            "id": notebook_id + 1,
            "path": "copy",
        }
    }
    client.send_message({"type": "LoadNotebook",
                         "path": "copy"})
    r = client.receive_message()
    assert r == {
        "type": "NewNotebook",
        "notebook": {
            "editor_cells": editor_cells,
            "id": notebook_id + 1,
            "path": "copy",
        }
    }
    with open("copy.tsnb") as f:
        data2 = toml.loads(f.read())
    assert data == data2
