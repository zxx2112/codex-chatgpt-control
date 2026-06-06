import unittest

from codex_chatgpt_control import ChatGPT, CommandDescriptor


DESCRIPTOR = {
    "name": "runner.run",
    "layer": "workflow",
    "summary": "Run an agent.",
    "risk": "medium",
    "args": {},
    "defaults": {},
    "retryPolicy": "Return structured failures.",
    "blockers": [],
    "examples": [],
}


class RecordingBackend:
    def __init__(self) -> None:
        self.requests: list[tuple[str, dict]] = []

    def request(self, command: str, payload: dict | None = None):
        payload = payload or {}
        self.requests.append((command, payload))
        if command == "commands":
            return [DESCRIPTOR]
        if command == "describe":
            return DESCRIPTOR
        if command == "help":
            return "ChatGPT browser-control help"
        raise AssertionError(command)


class CommandFacadeTests(unittest.TestCase):
    def test_commands_describe_and_help(self) -> None:
        backend = RecordingBackend()
        chatgpt = ChatGPT(backend=backend)

        commands = chatgpt.commands(layer="workflow")
        descriptor = chatgpt.describe("runner.run")
        help_text = chatgpt.help("runner.run")

        self.assertIsInstance(commands[0], CommandDescriptor)
        self.assertEqual(descriptor.name, "runner.run")
        self.assertIn("help", help_text)
        self.assertEqual(backend.requests, [
            ("commands", {"filter": {"layer": "workflow"}}),
            ("describe", {"name": "runner.run"}),
            ("help", {"topic": "runner.run"}),
        ])


if __name__ == "__main__":
    unittest.main()
