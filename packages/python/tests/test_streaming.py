import json
import unittest
from pathlib import Path

from codex_chatgpt_control import ChatGPTStreamEvent


ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "node" / "contracts" / "v1" / "fixtures"


def load_events(name: str) -> list[dict]:
    return [
        json.loads(line)
        for line in (FIXTURES / name).read_text(encoding="utf-8").strip().splitlines()
    ]


class StreamingFixtureTests(unittest.TestCase):
    def test_stream_fixture_ends_with_completed_result(self) -> None:
        events = load_events("stream-basic.ndjson")

        self.assertEqual(events[-1]["type"], "completed")
        event = ChatGPTStreamEvent.from_wire(events[-1])
        result = event.result
        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result.status, "ok")
        self.assertEqual(result.final_output, "hi")

    def test_blocked_stream_preserves_final_blocker(self) -> None:
        events = load_events("stream-blocked.ndjson")

        self.assertEqual(events[-1]["type"], "completed")
        event = ChatGPTStreamEvent.from_wire(events[-1])
        result = event.result
        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result.status, "partial")
        self.assertIsNotNone(result.blocker)
        assert result.blocker is not None
        self.assertEqual(result.blocker["kind"], "browser_bridge_unavailable")
        self.assertEqual(result.blocker["code"], "codex_chrome_bridge_unavailable")


if __name__ == "__main__":
    unittest.main()
