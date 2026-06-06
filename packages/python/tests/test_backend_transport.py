import json
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

from codex_chatgpt_control.backend import (
    BACKEND_EVENT_SCHEMA_VERSION,
    BACKEND_REQUEST_SCHEMA_VERSION,
    BACKEND_RESPONSE_SCHEMA_VERSION,
    BackendProtocolError,
    BackendTransportError,
    StdioBackendTransport,
)


class StdioBackendTransportTests(unittest.TestCase):
    def test_request_writes_one_envelope_line_and_parses_response(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            seen_path = Path(tmp) / "seen.jsonl"
            transport = StdioBackendTransport(
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
                        "result": {{"seenCommand": request["command"]}},
                    }}), flush=True)
                    """
                )
            )
            try:
                response = transport.request(backend_request("backend.version", request_id="req_one"))
            finally:
                transport.close()

            self.assertEqual(response["result"]["seenCommand"], "backend.version")
            written = seen_path.read_text(encoding="utf-8").splitlines()
            self.assertEqual(len(written), 1)
            self.assertEqual(json.loads(written[0])["requestId"], "req_one")

    def test_protocol_error_response_raises_protocol_error(self) -> None:
        transport = StdioBackendTransport(
            command=fake_backend_command(
                f"""
                import json
                import sys
                request = json.loads(sys.stdin.readline())
                print(json.dumps({{
                    "schemaVersion": {BACKEND_RESPONSE_SCHEMA_VERSION!r},
                    "requestId": request.get("requestId"),
                    "ok": False,
                    "error": {{
                        "code": "unknown_command",
                        "message": "No such command.",
                        "recoverable": False,
                    }},
                }}), flush=True)
                """
            )
        )
        try:
            with self.assertRaises(BackendProtocolError) as error:
                transport.request(backend_request("backend.version"))
        finally:
            transport.close()

        self.assertEqual(error.exception.code, "unknown_command")
        self.assertFalse(error.exception.recoverable)

    def test_nonzero_process_exit_raises_transport_error(self) -> None:
        transport = StdioBackendTransport(
            command=fake_backend_command(
                """
                import sys
                sys.stderr.write("backend failed")
                sys.exit(7)
                """
            )
        )
        try:
            with self.assertRaises(BackendTransportError) as error:
                transport.request(backend_request("backend.version"))
        finally:
            transport.close()

        self.assertEqual(error.exception.returncode, 7)
        self.assertIn("backend failed", error.exception.stderr)

    def test_invalid_json_response_raises_transport_error(self) -> None:
        transport = StdioBackendTransport(
            command=fake_backend_command(
                """
                import sys
                sys.stdin.readline()
                print("not-json", flush=True)
                """
            )
        )
        try:
            with self.assertRaises(BackendTransportError) as error:
                transport.request(backend_request("backend.version"))
        finally:
            transport.close()

        self.assertIn("invalid JSON", str(error.exception))

    def test_large_stderr_is_drained_while_waiting_for_stdout(self) -> None:
        transport = StdioBackendTransport(
            command=fake_backend_command(
                f"""
                import json
                import sys
                sys.stderr.write("x" * 200000)
                sys.stderr.flush()
                request = json.loads(sys.stdin.readline())
                print(json.dumps({{
                    "schemaVersion": {BACKEND_RESPONSE_SCHEMA_VERSION!r},
                    "requestId": request.get("requestId"),
                    "ok": True,
                    "result": {{"stderrDrained": True}},
                }}), flush=True)
                """
            ),
            timeout_seconds=5,
        )
        try:
            response = transport.request(backend_request("backend.version"))
        finally:
            transport.close()

        self.assertEqual(response["result"], {"stderrDrained": True})

    def test_stream_yields_events_until_completed(self) -> None:
        transport = StdioBackendTransport(
            command=fake_backend_command(
                f"""
                import json
                import sys
                request = json.loads(sys.stdin.readline())
                print(json.dumps({{
                    "schemaVersion": {BACKEND_EVENT_SCHEMA_VERSION!r},
                    "requestId": request.get("requestId"),
                    "type": "run_item_stream_event",
                    "name": "message.submitted",
                    "item": {{"type": "message.submitted"}},
                }}), flush=True)
                print(json.dumps({{
                    "schemaVersion": {BACKEND_EVENT_SCHEMA_VERSION!r},
                    "requestId": request.get("requestId"),
                    "type": "completed",
                    "result": {{"ok": True, "status": "ok"}},
                }}), flush=True)
                """
            )
        )
        try:
            events = list(transport.stream(backend_request("runner.stream", request_id="req_stream")))
        finally:
            transport.close()

        self.assertEqual([event["type"] for event in events], ["run_item_stream_event", "completed"])
        self.assertEqual(events[0]["name"], "message.submitted")


def backend_request(command: str, *, request_id: str = "req_test") -> dict:
    return {
        "schemaVersion": BACKEND_REQUEST_SCHEMA_VERSION,
        "requestId": request_id,
        "command": command,
        "payload": {},
    }


def fake_backend_command(source: str) -> list[str]:
    return [sys.executable, "-c", textwrap.dedent(source)]


if __name__ == "__main__":
    unittest.main()
