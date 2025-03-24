import pytest
import os
import subprocess
from websockets.sync.client import connect
import json
import time
import uuid
import contextlib

TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(TESTS_DIR)
if os.environ.get("TWINSONG_TEST_BIN") == "release":
    BIN_DIR = os.path.join(ROOT_DIR, "target", "release", "twinsong")
else:
    BIN_DIR = os.path.join(ROOT_DIR, "target", "debug", "twinsong")

PORT = 4511


@contextlib.contextmanager
def work_dir(path):
    old = os.getcwd()
    os.chdir(path)
    try:
        yield path
    finally:
        os.chdir(old)


@pytest.fixture
def http_service(tmp_path):
    global PORT
    PORT += 1
    with work_dir(tmp_path):
        log_path = str(tmp_path / "server.out.log")
        log = open(log_path, "w")
        env = os.environ.copy()
        env["RUST_LOG"] = "DEBUG"
        p = subprocess.Popen(
            [BIN_DIR, "--port", str(PORT)],
            stdout=log,
            stderr=subprocess.STDOUT,
            env=env,
        )
        time.sleep(0.15)
        yield f"ws://127.0.0.1:{PORT}/ws"
        print("Shutting down http service")
        if p.poll() is None:
            p.kill()
            time.sleep(0.1)
        else:
            raise Exception("HTTP service failed")


@pytest.fixture
def ws(http_service):
    with connect(http_service) as ws:
        yield ws


class Kernel:
    def __init__(self, client: "Client", notebook_id, run_id):
        self.client = client
        self.notebook_id = notebook_id
        self.run_id = run_id
        self.last_cell_id = None
        self.last_editor_node = None
        self.last_called_id = None
        self.last_update = None
        self.editor_root_id = str(uuid.uuid4())

    def run_code(self, code, called_id=None):
        cell_id = str(uuid.uuid4())
        if isinstance(code, str):
            called_id = str(uuid.uuid4())
            children = [{"type": "Cell", "id": called_id, "code": code}]
        elif isinstance(code, list):
            if called_id is None:
                raise Exception("Called ID not provided when code is list")
            children = code
        else:
            if called_id is None:
                called_id = code["id"]
            children = [code]
        editor_node = {
            "name": "",
            "scope": "Own",
            "id": self.editor_root_id,
            "children": children,
        }
        self.last_editor_node = editor_node
        self.last_called_id = called_id
        outputs = []
        self.client.send_message(
            {
                "type": "RunCode",
                "notebook_id": self.notebook_id,
                "run_id": self.run_id,
                "code": code,
                "cell_id": cell_id,
                "editor_node": editor_node,
                "called_id": called_id,
            }
        )
        while True:
            r = self.client.receive_message()
            print(">>>", r)
            if r["update"]:
                self.last_update = dict(r["update"])
            self.last_cell_id = r["cell_id"]
            assert r["type"] == "Output"
            outputs.append(r["value"])
            if r["flag"] != "Running":
                return outputs

    def run_code_simple(self, code):
        r = self.run_code(code)
        if r[-1]["type"] == "None":
            return None
        else:
            return r[-1]["value"]


class Client:
    def __init__(self, ws):
        self.ws = ws
        self.send_message({"type": "login"})

    def send_message(self, data):
        self.ws.send(json.dumps(data))

    def receive_message(self, skip_async=True):
        while True:
            r = json.loads(self.ws.recv())
            if skip_async and r["type"] == "DirList":
                continue
            return r

    def load_notebook(self, path):
        self.send_message({"type": "LoadNotebook", "path": path})
        return self.receive_message()

    def create_new_notebook(self):
        self.send_message({"type": "CreateNewNotebook"})
        r = self.receive_message()
        assert r["type"] == "NewNotebook"
        return r

    def kernel_list(self):
        self.send_message({"type": "KernelList"})
        r = self.receive_message()
        assert r["type"] == "Kernels"
        return r["kernels"]

    def create_new_kernel(self, notebook_id) -> Kernel:
        run_id = str(uuid.uuid4())
        self.send_message(
            {
                "type": "CreateNewKernel",
                "notebook_id": notebook_id,
                "run_id": run_id,
                "run_title": "Run Test",
            }
        )
        r = self.receive_message()
        assert r["type"] == "KernelReady"
        return Kernel(self, notebook_id, run_id)


@pytest.fixture
def client(ws):
    yield Client(ws)
