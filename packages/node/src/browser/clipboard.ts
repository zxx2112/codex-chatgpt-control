import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function readSystemClipboard(): Promise<string | undefined> {
  if (typeof process === "undefined" || process.platform !== "darwin") {
    return undefined;
  }

  try {
    const { stdout } = await execFileAsync("pbpaste", [], { timeout: 2000, maxBuffer: 10 * 1024 * 1024 });
    return stdout;
  } catch {
    return undefined;
  }
}

export async function waitForClipboardChange(
  before: string | undefined,
  timeoutMs: number,
  pollMs = 150
): Promise<string | undefined> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const current = await readSystemClipboard();
    if (current !== undefined && current.length > 0 && current !== before) {
      return current;
    }

    await new Promise(resolve => setTimeout(resolve, pollMs));
  }

  return undefined;
}
