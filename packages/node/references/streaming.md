# Runner Streaming

`chatgpt.runner.run(agent, input, { stream: true })` returns an async iterable of runner milestone events plus a `completed` promise.

```ts
const stream = chatgpt.runner.run(agent, "Reply with hi", { stream: true });

for await (const event of stream) {
  console.log(event.name, event.item.type);
}

const result = await stream.completed;
```

This is not token streaming. Events are emitted for browser-control milestones such as `message_submitted`, `message_completed`, `file_attached`, and `run_blocked`. Do not expect token deltas or OpenAI API stream event parity.
