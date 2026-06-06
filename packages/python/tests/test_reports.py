import unittest

from codex_chatgpt_control import ChatGPT, CommandResult


class RecordingBackend:
    def __init__(self) -> None:
        self.requests: list[tuple[str, dict]] = []

    def request(self, command: str, payload: dict | None = None):
        payload = payload or {}
        self.requests.append((command, payload))
        return {
            "ok": True,
            "status": "ok",
            "data": {"path": "reports/run.json", "bytes": 123},
            "warnings": [],
            "context": {"timestamp": "2026-06-06T00:00:00.000Z"},
        }


class ReportFacadeTests(unittest.TestCase):
    def test_reports_group_maps_to_backend_commands(self) -> None:
        backend = RecordingBackend()
        chatgpt = ChatGPT(backend=backend)

        create = chatgpt.reports.create({"ok": True}, dest_dir="/tmp")
        redact = chatgpt.reports.redact({"text": "private@example.com"})
        summarize = chatgpt.reports.summarize({"ok": True})

        self.assertIsInstance(create, CommandResult)
        self.assertIsInstance(redact, CommandResult)
        self.assertIsInstance(summarize, CommandResult)
        self.assertEqual(backend.requests, [
            ("reports.create", {"result": {"ok": True}, "args": {"destDir": "/tmp"}}),
            ("reports.redact", {"value": {"text": "private@example.com"}}),
            ("reports.summarize", {"result": {"ok": True}}),
        ])


if __name__ == "__main__":
    unittest.main()
