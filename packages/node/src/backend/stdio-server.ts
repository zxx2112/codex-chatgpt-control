import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import { BackendSession } from "./session.js";
import {
  backendResponseError,
  parseBackendRequest,
  ProtocolError,
  type BackendRequest,
  type BackendResponse
} from "./protocol.js";

export type BackendStdioServerOptions = {
  input: Readable;
  output: Writable;
  error?: Writable;
  session?: BackendSession;
};

export async function runBackendStdioServer(options: BackendStdioServerOptions): Promise<void> {
  const session = options.session ?? new BackendSession();
  const lines = createInterface({
    input: options.input,
    crlfDelay: Infinity
  });
  const writeJson = createJsonLineWriter(options.output);
  const tasks = new Set<Promise<void>>();

  for await (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    const task = handleLine(session, trimmed, writeJson, options.error);
    tasks.add(task);
    void task.finally(() => {
      tasks.delete(task);
    }).catch(() => {});
  }

  await Promise.allSettled(tasks);
}

async function handleLine(
  session: BackendSession,
  line: string,
  writeJson: JsonLineWriter,
  error: Writable | undefined
): Promise<void> {
  let request: BackendRequest | undefined;
  try {
    const raw = JSON.parse(line) as unknown;
    request = parseBackendRequest(raw);
    if (request.command === "runner.stream") {
      for await (const event of session.stream(request)) {
        await writeJson(event);
      }
      return;
    }

    await writeJson(await session.dispatch(request));
  } catch (caught) {
    const response = backendResponseError(request?.requestId ?? requestIdFromLine(line), normalizeError(caught));
    await writeJson(response);
    if (!(caught instanceof ProtocolError)) {
      await writeDiagnostic(error, caught);
    }
  }
}

function normalizeError(error: unknown): Error {
  if (error instanceof SyntaxError) {
    return new ProtocolError("invalid_request", `Invalid JSON backend request line: ${error.message}`, false);
  }
  if (error instanceof Error) return error;
  return new ProtocolError("invalid_request", String(error), false);
}

function requestIdFromLine(line: string): string | undefined {
  try {
    const parsed = JSON.parse(line) as unknown;
    if (isRecord(parsed) && typeof parsed.requestId === "string" && parsed.requestId.length > 0) {
      return parsed.requestId;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

type JsonLineWriter = (value: BackendResponse | Record<string, unknown>) => Promise<void>;

function createJsonLineWriter(output: Writable): JsonLineWriter {
  let tail = Promise.resolve();
  return value => {
    const next = tail.then(() => writeLine(output, JSON.stringify(value)));
    tail = next.catch(() => {});
    return next;
  };
}

async function writeDiagnostic(error: Writable | undefined, value: unknown): Promise<void> {
  if (error === undefined) return;
  const message = value instanceof Error ? `${value.name}: ${value.message}` : String(value);
  await writeLine(error, message);
}

async function writeLine(output: Writable, line: string): Promise<void> {
  if (output.write(`${line}\n`)) return;
  await new Promise<void>(resolve => {
    output.once("drain", resolve);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
