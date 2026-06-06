import unittest

from codex_chatgpt_control import Agent, BackendEvent, Runner
from tests.test_runner import run_result


class FakeStreamingBackend:
    def __init__(self) -> None:
        self.requests: list[tuple[str, dict, object]] = []

    def runner_stream(self, agent: dict, input: object):
        self.requests.append(("runner.stream", agent, input))
        yield {
            "schemaVersion": "chatgpt.browser_control.backend_event.v1",
            "type": "run_item_stream_event",
            "name": "message_submitted",
            "item": {"type": "message.submitted"},
        }
        yield {
            "schemaVersion": "chatgpt.browser_control.backend_event.v1",
            "type": "completed",
            "result": run_result(agent["name"], "stream-ok"),
        }


class RunnerStreamedTests(unittest.TestCase):
    def test_run_streamed_yields_events_and_final_result(self) -> None:
        backend = FakeStreamingBackend()
        runner = Runner(backend=backend)
        agent = Agent(name="streamer")

        stream = runner.run_streamed(agent, "hi")
        events = list(stream)

        self.assertIsInstance(events[0], BackendEvent)
        self.assertEqual(events[0].name, "message_submitted")
        self.assertIsNotNone(stream.final_result)
        assert stream.final_result is not None
        self.assertEqual(stream.final_result.final_output, "stream-ok")
        self.assertEqual(backend.requests[0], ("runner.stream", agent.to_wire(), "hi"))


if __name__ == "__main__":
    unittest.main()
