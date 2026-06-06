import { createInterface } from "node:readline";

const baseUrl = process.env.CHATGPT_BROWSER_BACKEND_HTTP_URL;

if (baseUrl === undefined || baseUrl.length === 0) {
  console.error("CHATGPT_BROWSER_BACKEND_HTTP_URL is required.");
  process.exit(2);
}

const input = createInterface({
  input: process.stdin,
  crlfDelay: Infinity
});

for await (const line of input) {
  const trimmed = line.trim();
  if (trimmed.length === 0) continue;

  let request;
  try {
    request = JSON.parse(trimmed);
  } catch (error) {
    await writeJson({
      schemaVersion: "chatgpt.browser_control.backend_response.v1",
      ok: false,
      error: {
        code: "invalid_request",
        message: error instanceof Error ? error.message : String(error),
        recoverable: false
      }
    });
    continue;
  }

  const path = request.command === "runner.stream" ? "/stream" : "/request";
  const response = await fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const message = `Bridge relay returned HTTP ${response.status}.`;
    if (path === "/stream") {
      await writeRelayEventError(request, message);
    } else {
      await writeRelayResponseError(request, message);
    }
    continue;
  }

  if (path === "/request") {
    const text = await response.text();
    if (text.length === 0) {
      await writeRelayResponseError(request, "Bridge relay returned an empty response body.");
      continue;
    }
    await writeText(text);
    continue;
  }

  const wrote = await writeResponseStream(response);
  if (!wrote) {
    await writeRelayEventError(request, "Bridge relay returned an empty stream body.");
  }
}

async function writeJson(value) {
  await writeRaw(`${JSON.stringify(value)}\n`);
}

async function writeText(text) {
  if (text.length === 0) return;
  await writeRaw(text.endsWith("\n") ? text : `${text}\n`);
}

async function writeRelayResponseError(request, message) {
  await writeJson({
    schemaVersion: "chatgpt.browser_control.backend_response.v1",
    requestId: request.requestId,
    ok: false,
    error: {
      code: "backend_relay_error",
      message,
      recoverable: true
    }
  });
}

async function writeRelayEventError(request, message) {
  await writeJson({
    schemaVersion: "chatgpt.browser_control.backend_event.v1",
    requestId: request.requestId,
    type: "error",
    error: {
      code: "backend_relay_error",
      message,
      recoverable: true
    }
  });
}

async function writeResponseStream(response) {
  if (response.body === null) {
    const text = await response.text();
    if (text.length === 0) return false;
    await writeText(text);
    return true;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let wrote = false;
  let endsWithNewline = true;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      if (text.length === 0) continue;
      wrote = true;
      endsWithNewline = text.endsWith("\n");
      await writeRaw(text);
    }

    const tail = decoder.decode();
    if (tail.length > 0) {
      wrote = true;
      endsWithNewline = tail.endsWith("\n");
      await writeRaw(tail);
    }
  } finally {
    reader.releaseLock();
  }

  if (wrote && !endsWithNewline) {
    await writeRaw("\n");
  }

  return wrote;
}

async function writeRaw(text) {
  if (process.stdout.write(text)) return;
  await new Promise(resolve => process.stdout.once("drain", resolve));
}
