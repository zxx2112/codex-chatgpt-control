import json
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

from codex_chatgpt_control import ChatGPT
from codex_chatgpt_control.backend import BACKEND_RESPONSE_SCHEMA_VERSION
from codex_chatgpt_control.transport import NodeSidecarError, NodeSidecarTransport


def successful_result(output_text: str = "") -> dict:
    return {
        "ok": True,
        "status": "ok",
        "output_text": output_text,
        "finalOutput": output_text,
        "output": [],
        "newItems": [],
        "interruptions": [],
        "state": {"id": "state-sidecar", "resumable": False},
        "activeAgentName": "reviewer",
        "lastAgentName": "reviewer",
        "warnings": [],
        "context": {"timestamp": "2026-06-05T00:00:00.000Z"},
    }


class NodeSidecarTransportTests(unittest.TestCase):
    def test_run_sends_backend_envelope_to_node_command(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            seen_path = Path(tmp) / "seen.jsonl"
            result = NodeSidecarTransport(
                command=fake_backend_command(
                    f"""
                    import json
                    import pathlib
                    import sys
                    line = sys.stdin.readline()
                    pathlib.Path({str(seen_path)!r}).write_text(line, encoding="utf-8")
                    request = json.loads(line)
                    print(json.dumps({{
                        "schemaVersion": {BACKEND_RESPONSE_SCHEMA_VERSION!r},
                        "requestId": request.get("requestId"),
                        "ok": True,
                        "result": {successful_result("sidecar-ok")!r},
                    }}), flush=True)
                    """
                )
            ).run({"agent": {"name": "reviewer"}, "input": "hi"})

            self.assertEqual(result["output_text"], "sidecar-ok")
            written = json.loads(seen_path.read_text(encoding="utf-8"))
            self.assertEqual(written["command"], "runner.run")
            self.assertEqual(written["payload"]["input"], "hi")
            self.assertEqual(written["payload"]["agent"]["name"], "reviewer")

    def test_nonzero_exit_raises_structured_error(self) -> None:
        with self.assertRaises(NodeSidecarError) as error:
            NodeSidecarTransport(
                command=fake_backend_command(
                    """
                    import sys
                    sys.stdin.readline()
                    sys.stderr.write("runner failed")
                    sys.exit(1)
                    """
                )
            ).run({"agent": {"name": "reviewer"}, "input": "hi"})

        self.assertEqual(error.exception.returncode, 1)
        self.assertEqual(error.exception.stderr, "runner failed")

    def test_invalid_json_raises_structured_error(self) -> None:
        with self.assertRaises(NodeSidecarError) as error:
            NodeSidecarTransport(
                command=fake_backend_command(
                    """
                    import sys
                    sys.stdin.readline()
                    print("not-json", flush=True)
                    """
                )
            ).run({"agent": {"name": "reviewer"}, "input": "hi"})

        self.assertEqual(error.exception.returncode, 0)
        self.assertIn("invalid JSON", str(error.exception))

    def test_missing_transport_error_points_to_sidecar(self) -> None:
        chatgpt = ChatGPT()
        agent = chatgpt.agent(name="reviewer")

        with self.assertRaises(RuntimeError) as error:
            chatgpt.runner.run(agent, input="hi")

        self.assertIn("NodeSidecarTransport", str(error.exception))


def fake_backend_command(source: str) -> list[str]:
    return [sys.executable, "-c", textwrap.dedent(source)]


if __name__ == "__main__":
    unittest.main()
