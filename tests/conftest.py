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
    with work_dir(tmp_path):
        log_path = str(tmp_path / "server.out.log")
        log = open(log_path, "w")
        env = os.environ.copy()
        env["RUST_LOG"] = "DEBUG"
        p = subprocess.Popen(
            [BIN_DIR, "--port", str(PORT)], stdout=log, stderr=subprocess.STDOUT, env=env
        )
        time.sleep(0.1)
        yield p
        print("Shutting down http service")
        if p.poll() is None:
            p.kill()
        else:
            raise Exception("HTTP service failed")


@pytest.fixture
def ws(http_service):
    with connect(f"ws://127.0.0.1:{PORT}/ws") as ws:
        yield ws


class Kernel:
    def __init__(self, client: "Client", notebook_id, run_id):
        self.client = client
        self.notebook_id = notebook_id
        self.run_id = run_id

    def run_code(self, code):
        cell_id = str(uuid.uuid4())
        editor_cell = {"id": str(uuid.uuid4()), "value": code}
        outputs = []
        while True:
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
            r = self.client.receive_message()
            print(r)
            assert r["type"] == "Output"
            outputs.append(r["value"])
            if r["flag"] != "Stream":
                return outputs

    def run_code_simple(self, code):
        r = self.run_code(code)[-1]
        return r["Text"]["value"]


class Client:
    def __init__(self, ws):
        self.ws = ws
        self.send_message({"type": "login"})

    def send_message(self, data):
        self.ws.send(json.dumps(data))

    def receive_message(self):
        return json.loads(self.ws.recv())

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
