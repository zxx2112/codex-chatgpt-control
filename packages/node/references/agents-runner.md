# Agents Runner

`ChatGPTAgent` is a browser-control task profile for operating visible ChatGPT web. It is not an OpenAI API Agent, not a model instance, and not a hidden system-prompt container.

`instructions` are visible by default through `instructionsMode: "visible_prefix"`.

Use:

```ts
const chatgpt = createChatGPT({ agent: globalThis.agent });
const reviewer = chatgpt.agent({ name: "reviewer", instructions: "Review deeply." });
const plan = chatgpt.runner.plan(reviewer, {
  input: "Review this design.",
  thread: { type: "new" }
});
const result = await chatgpt.runner.run(reviewer, {
  input: "Review this design.",
  thread: { type: "new" }
});
```

`instructionsMode` controls how instructions are exposed to visible ChatGPT:

- `visible_prefix`: include instructions in the same submitted user message.
- `visible_setup_message`: submit instructions as a separate visible setup turn before the user request.
- `metadata_only`: keep instructions local; they are not sent to ChatGPT.

`runner.run()` returns a `ChatGPTRunResult` with `output_text`, `finalOutput`, `output`, `interruptions`, and `state`. Browser-control blockers are surfaced as resumable interruptions when the underlying command can be retried after user approval, login, or permission repair.

For milestone streaming, call `chatgpt.runner.run(agent, input, { stream: true })` and iterate events before awaiting `stream.completed`. This is milestone streaming only, not token-delta streaming.

Do not pass API-only model controls such as `temperature`, `logprobs`, `seed`, or hidden system instructions.
