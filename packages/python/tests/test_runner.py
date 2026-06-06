import unittest

from codex_chatgpt_control import Agent, ChatGPT, ChatGPTRunResult, Runner, SequencePlan


class FakeBackend:
    def __init__(self) -> None:
        self.requests: list[tuple[str, dict, object]] = []

    def runner_run(self, agent: dict, input: object) -> dict:
        self.requests.append(("runner.run", agent, input))
        return run_result(agent["name"], "backend-ok")

    def runner_plan(self, agent: dict, input: object) -> dict:
        self.requests.append(("runner.plan", agent, input))
        return {
            "name": f"agent-run:{agent['name']}",
            "policy": {"stopOnError": True, "returnPartial": True},
            "steps": [
                {"id": "bootstrap", "command": "session.bootstrap"},
                {"id": "ask", "command": "messages.ask", "args": {"text": input}},
            ],
        }


class RunnerTests(unittest.IsolatedAsyncioTestCase):
    def test_run_sync_calls_backend_runner_run(self) -> None:
        backend = FakeBackend()
        runner = Runner(backend=backend)
        agent = Agent(name="reviewer")

        result = runner.run_sync(agent, "hi")

        self.assertIsInstance(result, ChatGPTRunResult)
        self.assertEqual(result.final_output, "backend-ok")
        self.assertEqual(backend.requests[0], ("runner.run", agent.to_wire(), "hi"))

    async def test_run_async_calls_backend_runner_run(self) -> None:
        backend = FakeBackend()
        runner = Runner(backend=backend)
        agent = Agent(name="reviewer")

        result = await runner.run(agent, "hi")

        self.assertEqual(result.final_output, "backend-ok")
        self.assertEqual(backend.requests[0][0], "runner.run")

    def test_chatgpt_run_aliases_runner_run(self) -> None:
        backend = FakeBackend()
        chatgpt = ChatGPT(backend=backend)
        agent = chatgpt.agent(name="reviewer")

        result = chatgpt.run(agent, "hi")

        self.assertEqual(result.final_output, "backend-ok")
        self.assertEqual(backend.requests[0][0], "runner.run")

    def test_chatgpt_runner_plan_calls_backend_runner_plan(self) -> None:
        backend = FakeBackend()
        chatgpt = ChatGPT(backend=backend)
        agent = chatgpt.agent(name="planner")

        plan = chatgpt.runner.plan(agent, "draft plan")

        self.assertIsInstance(plan, SequencePlan)
        self.assertEqual(plan.name, "agent-run:planner")
        self.assertEqual(backend.requests[0][0], "runner.plan")


def run_result(agent_name: str, output_text: str) -> dict:
    return {
        "ok": True,
        "status": "ok",
        "output_text": output_text,
        "finalOutput": output_text,
        "output": [],
        "newItems": [],
        "interruptions": [],
        "state": {"id": "state-runner", "resumable": False},
        "activeAgentName": agent_name,
        "lastAgentName": agent_name,
        "warnings": [],
        "context": {"timestamp": "2026-06-06T00:00:00.000Z"},
    }


if __name__ == "__main__":
    unittest.main()
