# Responses Adapter

`chatgpt.responses.create()` is a narrow convenience wrapper around visible ChatGPT browser control. It returns a Responses-shaped object with `object: "chatgpt.browser.response"`, but it is not the OpenAI Responses API and does not support hidden model controls.

Accepted fields:

- `input`
- `thread`
- `attachments`
- `mode`
- `tools`
- `text.format`
- `stream: false`
- `report`
- `instructions` only with `instructionsMode: "visible_prefix"`

Rejected API-only fields return `status: "unsupported"` before any prompt is submitted. The response includes `browser_control.unsupported[]` with `path`, `reason`, and `alternative`.

```ts
const response = await chatgpt.responses.create({
  input: "Summarize the latest plan.",
  thread: { type: "conversationId", conversationId: "abc-123" },
  text: { format: "markdown" },
  stream: false
});
```

Use `chatgpt.runner.run()` for lower-level browser-control workflows, multi-step command planning, attachments, downloads, reports, and explicit interruption handling.
