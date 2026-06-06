import unittest

from codex_chatgpt_control import ChatGPT, ChatGPTRunResult


class FakeTransport:
    def __init__(self) -> None:
        self.requests = []

    def run(self, payload: dict) -> dict:
        self.requests.append(payload)
        return {
            "ok": True,
            "status": "ok",
            "output_text": "fake-ok",
            "finalOutput": "fake-ok",
            "output": [],
            "newItems": [],
            "interruptions": [],
            "state": {"id": "state-fake", "resumable": False},
            "activeAgentName": payload["agent"]["name"],
            "lastAgentName": payload["agent"]["name"],
            "warnings": [],
            "context": {"timestamp": "2026-06-05T00:00:00.000Z"},
        }


class RunnerApiTests(unittest.TestCase):
    def test_runner_sends_agent_and_input_to_transport(self) -> None:
        transport = FakeTransport()
        chatgpt = ChatGPT(transport=transport)
        agent = chatgpt.agent(name="reviewer", instructions="Review deeply.")

        result = chatgpt.runner.run(agent, input="Reply with hi.")

        self.assertIsInstance(result, ChatGPTRunResult)
        self.assertEqual(result.final_output, "fake-ok")
        self.assertEqual(transport.requests[0]["agent"]["name"], "reviewer")
        self.assertEqual(transport.requests[0]["input"], "Reply with hi.")


if __name__ == "__main__":
    unittest.main()
