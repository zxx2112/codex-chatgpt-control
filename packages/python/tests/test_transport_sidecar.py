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


def multi_request_backend_command(pid_path: Path) -> list[str]:
    """A fake backend that answers every request on its stdin and records its PID per line."""
    return fake_backend_command(
        f"""
        import json
        import os
        import sys
        for line in sys.stdin:
            request = json.loads(line)
            with open({str(pid_path)!r}, "a", encoding="utf-8") as handle:
                handle.write(str(os.getpid()) + "\\n")
            print(json.dumps({{
                "schemaVersion": {BACKEND_RESPONSE_SCHEMA_VERSION!r},
                "requestId": request.get("requestId"),
                "ok": True,
                "result": {successful_result("session-ok")!r},
            }}), flush=True)
        """
    )


class NodeSidecarSessionTests(unittest.TestCase):
    def test_run_without_session_uses_a_fresh_process_per_call(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            pid_path = Path(tmp) / "pids.txt"
            transport = NodeSidecarTransport(command=multi_request_backend_command(pid_path))

            transport.run({"agent": {"name": "reviewer"}, "input": "one"})
            transport.run({"agent": {"name": "reviewer"}, "input": "two"})

            pids = pid_path.read_text(encoding="utf-8").split()
            self.assertEqual(len(pids), 2)
            self.assertNotEqual(pids[0], pids[1])

    def test_context_manager_session_reuses_one_process(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            pid_path = Path(tmp) / "pids.txt"
            with NodeSidecarTransport(command=multi_request_backend_command(pid_path)) as transport:
                first = transport.run({"agent": {"name": "reviewer"}, "input": "one"})
                second = transport.run({"agent": {"name": "reviewer"}, "input": "two"})

            self.assertEqual(first["output_text"], "session-ok")
            self.assertEqual(second["output_text"], "session-ok")
            pids = pid_path.read_text(encoding="utf-8").split()
            self.assertEqual(len(pids), 2)
            self.assertEqual(pids[0], pids[1])

    def test_open_is_idempotent_and_close_ends_the_session(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            pid_path = Path(tmp) / "pids.txt"
            transport = NodeSidecarTransport(command=multi_request_backend_command(pid_path))
            transport.open()
            transport.open()
            transport.run({"agent": {"name": "reviewer"}, "input": "one"})
            transport.close()
            transport.run({"agent": {"name": "reviewer"}, "input": "two"})

            pids = pid_path.read_text(encoding="utf-8").split()
            self.assertEqual(len(pids), 2)
            self.assertNotEqual(pids[0], pids[1])

    def test_transport_failure_closes_the_persistent_session(self) -> None:
        transport = NodeSidecarTransport(
            command=fake_backend_command(
                """
                import sys
                sys.stdin.readline()
                sys.stderr.write("session backend crashed")
                sys.exit(3)
                """
            )
        )
        transport.open()
        try:
            with self.assertRaises(NodeSidecarError) as ctx:
                transport.run({"agent": {"name": "reviewer"}, "input": "one"})

            self.assertEqual(ctx.exception.returncode, 3)
            self.assertIsNone(transport._session)
        finally:
            transport.close()

    def test_protocol_error_keeps_the_persistent_session_open(self) -> None:
        transport = NodeSidecarTransport(
            command=fake_backend_command(
                f"""
                import json
                import sys
                for line in sys.stdin:
                    request = json.loads(line)
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
        transport.open()
        try:
            with self.assertRaises(NodeSidecarError):
                transport.run({"agent": {"name": "reviewer"}, "input": "one"})
            self.assertIsNotNone(transport._session)
            with self.assertRaises(NodeSidecarError) as second:
                transport.run({"agent": {"name": "reviewer"}, "input": "two"})
            self.assertIsNone(second.exception.returncode)
        finally:
            transport.close()


class NodeSidecarReturncodeRegressionTests(unittest.TestCase):
    """Regression tests for Bug 3: NodeSidecarTransport must propagate a non-None
    returncode from BackendTransportError through to NodeSidecarError.

    The wiring in NodeSidecarTransport.run is:
        except BackendTransportError as exc:
            raise NodeSidecarError(..., returncode=exc.returncode, ...) from exc

    If exc.returncode is silently dropped (e.g. hard-coded to None), the caller
    loses the ability to distinguish a clean exit from an error exit.
    """

    def test_non_none_returncode_propagated_from_backend_transport_error(self) -> None:
        """REGRESSION for Bug 3.

        A BackendTransportError(returncode=7) raised by the underlying transport must
        surface as NodeSidecarError(returncode=7), not returncode=None.
        """
        # Drive this through a real subprocess that exits non-zero so the entire
        # wiring (StdioBackendTransport -> BackendTransportError -> NodeSidecarTransport
        # -> NodeSidecarError) is exercised end-to-end.
        with self.assertRaises(NodeSidecarError) as ctx:
            NodeSidecarTransport(
                command=fake_backend_command(
                    """
                    import sys
                    sys.stdin.readline()
                    sys.stderr.write("backend exploded with code 7")
                    sys.exit(7)
                    """
                )
            ).run({"agent": {"name": "reviewer"}, "input": "hi"})

        exc = ctx.exception
        self.assertEqual(
            exc.returncode,
            7,
            f"Expected returncode=7 propagated through NodeSidecarError, got {exc.returncode!r}",
        )
        self.assertIn("backend exploded", exc.stderr)

    def test_returncode_none_when_backend_protocol_error(self) -> None:
        """A BackendProtocolError (logical error, not a crash) surfaces with returncode=None."""
        with self.assertRaises(NodeSidecarError) as ctx:
            NodeSidecarTransport(
                command=fake_backend_command(
                    f"""
                    import json, sys
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
            ).run({"agent": {"name": "reviewer"}, "input": "hi"})

        exc = ctx.exception
        self.assertIsNone(
            exc.returncode,
            f"Protocol errors should have returncode=None, got {exc.returncode!r}",
        )

    def test_returncode_propagated_for_various_exit_codes(self) -> None:
        """Different non-zero exit codes are each propagated faithfully."""
        for exit_code in (1, 2, 42, 127):
            with self.subTest(exit_code=exit_code):
                with self.assertRaises(NodeSidecarError) as ctx:
                    NodeSidecarTransport(
                        command=fake_backend_command(
                            f"""
                            import sys
                            sys.stdin.readline()
                            sys.exit({exit_code})
                            """
                        )
                    ).run({"agent": {"name": "reviewer"}, "input": "hi"})

                self.assertEqual(
                    ctx.exception.returncode,
                    exit_code,
                    f"returncode should be {exit_code}, got {ctx.exception.returncode!r}",
                )


if __name__ == "__main__":
    unittest.main()
