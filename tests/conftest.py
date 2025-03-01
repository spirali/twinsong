import pytest
import os
import subprocess
from websockets.sync.client import connect
import json
import time
import uuid
import contextlib

w
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
        self.last_editor_cell = None

    def run_code(self, code):
        cell_id = str(uuid.uuid4())
        editor_cell = {"id": str(uuid.uuid4()), "value": code}
        self.last_editor_cell = editor_cell
        outputs = []
        self.client.send_message(
            {
                "type": "RunCell",
                "notebook_id": self.notebook_id,
                "run_id": self.run_id,
                "code": code,
                "cell_id": cell_id,
                "editor_cell": editor_cell,
            }
        )
        while True:
            r = self.client.receive_message()
            print(">>>", r)
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

    def create_new_notebook(self):
        self.send_message({"type": "CreateNewNotebook"})
        r = self.receive_message()
        assert r["type"] == "NewNotebook"
        return r

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
