import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { BackendSession } from "../../src/backend/session.js";
import { runBackendStdioServer } from "../../src/backend/stdio-server.js";
import {
  BACKEND_EVENT_SCHEMA_VERSION,
  BACKEND_RESPONSE_SCHEMA_VERSION,
  BACKEND_REQUEST_SCHEMA_VERSION,
  type BackendEvent,
  type BackendResponse,
  type BackendRequest
} from "../../src/backend/protocol.js";

describe("backend stdio server", () => {
  it("writes one NDJSON response for one NDJSON request", async () => {
    const server = startServer();

    server.input.write(`${JSON.stringify(request("backend.health"))}\n`);
    server.input.end();

    await server.done;
    expect(server.stdoutLines()).toEqual([
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          ok: true,
          status: "ok"
        })
      })
    ]);
  });

  it("handles multiple requests in one long-lived session", async () => {
    const server = startServer();

    server.input.write(`${JSON.stringify(request("backend.health", {}, "req_health"))}\n`);
    server.input.write(`${JSON.stringify(request("backend.capabilities", {}, "req_capabilities"))}\n`);
    server.input.end();

    await server.done;
    const lines = server.stdoutLines();
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ requestId: "req_health", ok: true });
    expect(lines[1]).toMatchObject({
      requestId: "req_capabilities",
      ok: true,
      result: expect.objectContaining({
        commands: expect.arrayContaining(["runner.run"])
      })
    });
  });

  it("returns protocol errors for invalid JSON and keeps processing", async () => {
    const server = startServer();

    server.input.write("not-json\n");
    server.input.write(`${JSON.stringify(request("backend.health", {}, "req_after_error"))}\n`);
    server.input.end();

    await server.done;
    const lines = server.stdoutLines();
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      ok: false,
      error: {
        code: "invalid_request",
        recoverable: false
      }
    });
    expect(lines[1]).toMatchObject({
      requestId: "req_after_error",
      ok: true
    });
  });

  it("streams milestone events and a final completed event", async () => {
    const server = startServer(new BackendSession({
      now: () => new Date("2026-06-06T00:00:00.000Z"),
      limits: { maxPromptsPerRun: 0 }
    }));

    server.input.write(`${JSON.stringify(request("runner.stream", {
      agent: { name: "reviewer" },
      input: "reply with hi"
    }, "req_stream"))}\n`);
    server.input.end();

    await server.done;
    const lines = server.stdoutLines();
    expect(lines).toEqual([
      expect.objectContaining({
        requestId: "req_stream",
        type: "run_item_stream_event",
        name: "run_blocked",
        item: expect.objectContaining({ type: "run.blocked" })
      }),
      expect.objectContaining({
        requestId: "req_stream",
        type: "completed",
        result: expect.objectContaining({
          status: "needs_confirmation",
          output_text: ""
        })
      })
    ]);
  });

  it("does not block later requests behind a long-running stream", async () => {
    const server = startServer(new SlowStreamSession());

    server.input.write(`${JSON.stringify(request("runner.stream", {}, "req_stream"))}\n`);
    server.input.write(`${JSON.stringify(request("backend.health", {}, "req_health"))}\n`);
    server.input.end();

    await server.done;
    const lines = server.stdoutLines();
    expect(lines[0]).toMatchObject({
      schemaVersion: BACKEND_RESPONSE_SCHEMA_VERSION,
      requestId: "req_health",
      ok: true
    });
    expect(lines.map(line => line.requestId)).toEqual(["req_health", "req_stream", "req_stream"]);
  });
});

function startServer(session = new BackendSession({ now: () => new Date("2026-06-06T00:00:00.000Z") })) {
  const input = new PassThrough();
  const output = new PassThrough();
  const stderr = new PassThrough();
  let stdout = "";
  let stderrText = "";

  output.setEncoding("utf8");
  output.on("data", chunk => {
    stdout += chunk as string;
  });
  stderr.setEncoding("utf8");
  stderr.on("data", chunk => {
    stderrText += chunk as string;
  });

  const done = runBackendStdioServer({
    input,
    output,
    error: stderr,
    session
  });

  return {
    input,
    done,
    stdoutLines: () => stdout.trim().split("\n").filter(Boolean).map(line => JSON.parse(line) as Record<string, unknown>),
    stderrText: () => stderrText
  };
}

function request(command: string, payload: Record<string, unknown> = {}, requestId = `req_${command}`) {
  return {
    schemaVersion: BACKEND_REQUEST_SCHEMA_VERSION,
    requestId,
    command,
    payload
  };
}

class SlowStreamSession extends BackendSession {
  override async dispatch(request: BackendRequest): Promise<BackendResponse> {
    return {
      schemaVersion: BACKEND_RESPONSE_SCHEMA_VERSION,
      ...(request.requestId ? { requestId: request.requestId } : {}),
      ok: true as const,
      result: { ok: true, status: "ok" }
    } satisfies BackendResponse;
  }

  override async *stream(request: BackendRequest): AsyncIterable<BackendEvent> {
    await new Promise(resolve => setTimeout(resolve, 50));
    yield {
      schemaVersion: BACKEND_EVENT_SCHEMA_VERSION,
      ...(request.requestId ? { requestId: request.requestId } : {}),
      type: "run_item_stream_event" as const,
      name: "message_completed",
      item: { type: "message.completed" }
    } satisfies BackendEvent;
    yield {
      schemaVersion: BACKEND_EVENT_SCHEMA_VERSION,
      ...(request.requestId ? { requestId: request.requestId } : {}),
      type: "completed" as const,
      result: { ok: true, status: "ok" }
    } satisfies BackendEvent;
  }
}
