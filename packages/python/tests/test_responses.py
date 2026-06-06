import json
import unittest
from datetime import datetime, timezone
from pathlib import Path

from codex_chatgpt_control import ChatGPT, ChatGPTResponse
from codex_chatgpt_control.responses import ResponsesClient, validate_responses_create_args


ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "node" / "contracts" / "v1" / "fixtures"
FIXED_NOW = datetime(2026, 6, 6, tzinfo=timezone.utc)


class FakeResponsesBackend:
    def __init__(self) -> None:
        self.requests: list[tuple[str, dict]] = []

    def request(self, command: str, payload: dict) -> dict:
        self.requests.append((command, payload))
        return {
            "id": "chatgpt-browser-response-ok",
            "object": "chatgpt.browser.response",
            "created_at": 1780704000,
            "status": "ok",
            "output_text": "accepted",
            "output": [],
            "browser_control": {"visibleUi": True, "resultStatus": "ok"},
        }


class ResponsesTests(unittest.TestCase):
    def test_accepted_browser_fields_pass_validation(self) -> None:
        validation = validate_responses_create_args({
            "input": "hi",
            "thread": {"type": "new"},
            "attachments": [{"path": "/tmp/a.txt"}],
            "mode": {"model": "auto"},
            "tools": [{"tool": "web_search"}],
            "text": {"format": "markdown"},
            "stream": False,
            "report": False,
            "instructions": "Visible instruction.",
            "instructions_mode": "visible_prefix",
        })

        self.assertTrue(validation.ok)
        self.assertEqual(validation.unsupported, [])

    def test_api_only_field_returns_unsupported_before_backend_call(self) -> None:
        backend = FakeResponsesBackend()
        client = ResponsesClient(backend=backend, now=lambda: FIXED_NOW)

        response = client.create(input="hi", temperature=0.2)

        self.assertEqual(response.status, "unsupported")
        self.assertEqual(response.unsupported_fields[0]["path"], "temperature")
        self.assertEqual(backend.requests, [])

    def test_hidden_instructions_match_node_fixture(self) -> None:
        backend = FakeResponsesBackend()
        client = ResponsesClient(backend=backend, now=lambda: FIXED_NOW)
        expected = json.loads(
            (FIXTURES / "responses-hidden-instructions-unsupported.json").read_text(encoding="utf-8")
        )["response"]

        response = client.create(input="Visible request.", instructions="Hidden instruction request.")

        self.assertEqual(response.to_wire(), expected)
        self.assertEqual(backend.requests, [])

    def test_visible_prefix_instructions_are_accepted(self) -> None:
        backend = FakeResponsesBackend()
        client = ResponsesClient(backend=backend, now=lambda: FIXED_NOW)

        response = client.create(
            input="Visible request.",
            instructions="Visible instruction.",
            instructions_mode="visible_prefix",
        )

        self.assertEqual(response.status, "ok")
        self.assertEqual(backend.requests[0][0], "responses.create")
        self.assertEqual(backend.requests[0][1]["instructionsMode"], "visible_prefix")

    def test_unknown_field_matches_node_fixture(self) -> None:
        backend = FakeResponsesBackend()
        client = ResponsesClient(backend=backend, now=lambda: FIXED_NOW)
        expected = json.loads(
            (FIXTURES / "responses-unknown-field-unsupported.json").read_text(encoding="utf-8")
        )["response"]

        response = client.create(input="Visible request.", unknown_control=True)

        self.assertEqual(response.to_wire(), expected)
        self.assertEqual(backend.requests, [])

    def test_accepted_response_calls_backend(self) -> None:
        backend = FakeResponsesBackend()
        client = ResponsesClient(backend=backend, now=lambda: FIXED_NOW)

        response = client.create(input="hi", text={"format": "markdown"}, stream=False)

        self.assertIsInstance(response, ChatGPTResponse)
        self.assertEqual(response.output_text, "accepted")
        self.assertEqual(backend.requests, [("responses.create", {
            "input": "hi",
            "text": {"format": "markdown"},
            "stream": False,
        })])

    def test_chatgpt_exposes_responses_client(self) -> None:
        backend = FakeResponsesBackend()
        chatgpt = ChatGPT(backend=backend)

        response = chatgpt.responses.create(input="hi")

        self.assertEqual(response.output_text, "accepted")
        self.assertEqual(backend.requests[0][0], "responses.create")


if __name__ == "__main__":
    unittest.main()
