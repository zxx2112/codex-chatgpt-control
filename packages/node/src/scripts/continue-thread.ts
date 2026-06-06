import { fileURLToPath } from "node:url";
import {
  createChatGPT,
  type ChatGPTClient,
  type WorkflowThread
} from "../client.js";
import type {
  CommandContext,
  CommandResult,
  ReadLatestArgs,
  ResponseFormat,
  WaitArgs
} from "../types.js";

const DEFAULT_SEARCH_LIMIT = 5;
const DEFAULT_FORMAT: ResponseFormat = "markdown";
const CHATGPT_HOSTS = new Set(["chatgpt.com", "www.chatgpt.com", "chat.openai.com"]);
const RESPONSE_FORMATS = new Set<ResponseFormat>([
  "markdown",
  "text",
  "normalized_text",
  "visible_text",
  "html",
  "blocks",
  "all"
]);

export const CONTINUE_THREAD_USAGE = [
  "Usage:",
  "  npm run thread -- \"<ChatGPT thread URL or history search query>\"",
  "  npm run thread -- \"<target>\" --prompt \"Continue from the latest answer.\"",
  "  CHATGPT_THREAD_TARGET=\"<target>\" CHATGPT_THREAD_PROMPT=\"<prompt>\" npm run thread",
  "",
  "Options:",
  "  --target, -t       ChatGPT /c/... URL or history search query.",
  "  --prompt, -p       Optional prompt to send after opening the thread. Omit to read only.",
  "  --format           Response format for the read step. Default: markdown.",
  "  --max-chars        Maximum response characters to return.",
  "  --timeout-ms       Wait timeout for continue prompts.",
  "  --stable-ms        Stable wait window for continue prompts."
].join("\n");

export type ContinueThreadOptions = {
  target: string;
  prompt?: string;
  format: ResponseFormat;
  maxChars?: number;
  timeoutMs?: number;
  stableMs?: number;
};

export type ContinueThreadClient = Pick<ChatGPTClient, "askInThread" | "openThread" | "readLatest">;
export type ContinueThreadSelector = Exclude<WorkflowThread, { type: "new" }>;

export class ContinueThreadUsageError extends Error {
  constructor(message: string, readonly exitCode = 2) {
    super(message);
    this.name = "ContinueThreadUsageError";
  }
}

export function parseContinueThreadCliArgs(
  argv: string[],
  env: Record<string, string | undefined> = process.env
): ContinueThreadOptions {
  let targetFlag: string | undefined;
  let promptFlag: string | undefined;
  let formatFlag: string | undefined;
  let maxCharsFlag: string | undefined;
  let timeoutMsFlag: string | undefined;
  let stableMsFlag: string | undefined;
  const positionals: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined) continue;
    switch (arg) {
      case "--help":
      case "-h":
        throw new ContinueThreadUsageError(CONTINUE_THREAD_USAGE, 0);
      case "--target":
      case "-t":
        targetFlag = requiredValue(argv, ++index, arg);
        break;
      case "--prompt":
      case "-p":
        promptFlag = requiredValue(argv, ++index, arg);
        break;
      case "--format":
        formatFlag = requiredValue(argv, ++index, arg);
        break;
      case "--max-chars":
        maxCharsFlag = requiredValue(argv, ++index, arg);
        break;
      case "--timeout-ms":
        timeoutMsFlag = requiredValue(argv, ++index, arg);
        break;
      case "--stable-ms":
        stableMsFlag = requiredValue(argv, ++index, arg);
        break;
      default:
        positionals.push(arg);
        break;
    }
  }

  const target = firstText(targetFlag, positionals.join(" "), env.CHATGPT_THREAD_TARGET);
  if (target === undefined) {
    throw new ContinueThreadUsageError(`Missing ChatGPT thread URL or search query.\n\n${CONTINUE_THREAD_USAGE}`);
  }

  const options: ContinueThreadOptions = {
    target,
    format: parseResponseFormat(firstText(formatFlag, env.CHATGPT_THREAD_FORMAT) ?? DEFAULT_FORMAT)
  };

  const prompt = firstText(promptFlag, env.CHATGPT_THREAD_PROMPT);
  if (prompt !== undefined) options.prompt = prompt;

  const maxChars = parsePositiveInteger(firstText(maxCharsFlag, env.CHATGPT_THREAD_MAX_CHARS), "--max-chars");
  if (maxChars !== undefined) options.maxChars = maxChars;

  const timeoutMs = parsePositiveInteger(firstText(timeoutMsFlag, env.CHATGPT_THREAD_TIMEOUT_MS), "--timeout-ms");
  if (timeoutMs !== undefined) options.timeoutMs = timeoutMs;

  const stableMs = parsePositiveInteger(firstText(stableMsFlag, env.CHATGPT_THREAD_STABLE_MS), "--stable-ms");
  if (stableMs !== undefined) options.stableMs = stableMs;

  return options;
}

export function threadSelectorFromTarget(
  target: string,
  args: { limit?: number } = {}
): ContinueThreadSelector {
  const value = target.trim();
  if (value.length === 0) {
    throw new ContinueThreadUsageError("Thread target must not be empty.");
  }

  const url = chatgptUrlFromTarget(value);
  if (url !== undefined) {
    return { type: "url", url };
  }

  return {
    type: "search",
    query: value,
    select: "first",
    limit: args.limit ?? DEFAULT_SEARCH_LIMIT
  };
}

export async function runContinueThread(
  client: ContinueThreadClient,
  options: ContinueThreadOptions
): Promise<CommandResult<unknown>> {
  const thread = threadSelectorFromTarget(options.target);
  const read = readArgs(options);
  const prompt = options.prompt?.trim();

  if (prompt !== undefined && prompt.length > 0) {
    return client.askInThread({
      thread,
      prompt,
      wait: waitArgs(options) ?? true,
      read
    });
  }

  const opened = await client.openThread(thread);
  if (!opened.ok) {
    return opened;
  }

  const latest = await client.readLatest(read);
  return mergeOpenReadResult(opened, latest);
}

export function renderContinueThreadOutput(result: CommandResult<unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {
    ok: result.ok,
    status: result.status,
    context: result.context
  };

  const text = textFromData(result.data);
  if (text !== undefined) output.text = text;
  if (text === undefined && result.data !== undefined) output.data = result.data;
  if (result.warnings.length > 0) output.warnings = result.warnings;
  if (result.blocker !== undefined) output.blocker = result.blocker;
  if (result.error !== undefined) output.error = result.error;
  if (result.reportPath !== undefined) output.reportPath = result.reportPath;
  return output;
}

export async function main(
  argv: string[] = process.argv.slice(2),
  env: Record<string, string | undefined> = process.env
): Promise<number> {
  try {
    const options = parseContinueThreadCliArgs(argv, env);
    const chatgpt = createChatGPT({ agent: (globalThis as Record<string, unknown>).agent });
    const result = await runContinueThread(chatgpt, options);
    console.log(JSON.stringify(renderContinueThreadOutput(result), null, 2));
    return result.ok ? 0 : result.blocker !== undefined ? 2 : 1;
  } catch (error) {
    if (error instanceof ContinueThreadUsageError) {
      console.error(error.message);
      return error.exitCode;
    }
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function requiredValue(argv: string[], index: number, flag: string): string {
  const value = argv[index];
  if (value === undefined || value.startsWith("--")) {
    throw new ContinueThreadUsageError(`Missing value for ${flag}.\n\n${CONTINUE_THREAD_USAGE}`);
  }
  return value;
}

function firstText(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed !== undefined && trimmed.length > 0) {
      return trimmed;
    }
  }
  return undefined;
}

function parseResponseFormat(value: string): ResponseFormat {
  if (RESPONSE_FORMATS.has(value as ResponseFormat)) {
    return value as ResponseFormat;
  }
  throw new ContinueThreadUsageError(`Unsupported response format "${value}". Use one of: ${Array.from(RESPONSE_FORMATS).join(", ")}.`);
}

function parsePositiveInteger(value: string | undefined, label: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new ContinueThreadUsageError(`${label} must be a positive integer.`);
  }
  return parsed;
}

function chatgptUrlFromTarget(target: string): string | undefined {
  const maybeUrl = target.startsWith("/c/") ? new URL(target, "https://chatgpt.com") : parseUrl(target);
  if (maybeUrl === undefined) {
    return undefined;
  }
  if (!CHATGPT_HOSTS.has(maybeUrl.hostname)) {
    throw new ContinueThreadUsageError("Target URL must be a ChatGPT thread URL from chatgpt.com or chat.openai.com.");
  }
  return maybeUrl.toString();
}

function parseUrl(value: string): URL | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

function readArgs(options: ContinueThreadOptions): ReadLatestArgs {
  const args: ReadLatestArgs = {
    role: "assistant",
    format: options.format
  };
  if (options.maxChars !== undefined) args.maxChars = options.maxChars;
  return args;
}

function waitArgs(options: ContinueThreadOptions): WaitArgs | undefined {
  if (options.timeoutMs === undefined && options.stableMs === undefined) {
    return undefined;
  }
  const args: WaitArgs = {};
  if (options.timeoutMs !== undefined) args.timeoutMs = options.timeoutMs;
  if (options.stableMs !== undefined) args.stableMs = options.stableMs;
  return args;
}

function mergeOpenReadResult(
  opened: CommandResult<unknown>,
  latest: CommandResult<unknown>
): CommandResult<unknown> {
  const merged: CommandResult<unknown> = {
    ...latest,
    warnings: [...opened.warnings, ...latest.warnings],
    context: mergeContext(opened.context, latest.context)
  };
  if (opened.steps !== undefined || latest.steps !== undefined) {
    merged.steps = [...(opened.steps ?? []), ...(latest.steps ?? [])];
  }
  return merged;
}

function mergeContext(opened: CommandContext, latest: CommandContext): CommandContext {
  const context: CommandContext = { timestamp: latest.timestamp };
  const url = latest.url ?? opened.url;
  const conversationId = latest.conversationId ?? opened.conversationId;
  const title = latest.title ?? opened.title;
  const turnCount = latest.turnCount ?? opened.turnCount;
  const assistantTurnCount = latest.assistantTurnCount ?? opened.assistantTurnCount;
  const browserName = latest.browserName ?? opened.browserName;
  const tabId = latest.tabId ?? opened.tabId;

  if (url !== undefined) context.url = url;
  if (conversationId !== undefined) context.conversationId = conversationId;
  if (title !== undefined) context.title = title;
  if (turnCount !== undefined) context.turnCount = turnCount;
  if (assistantTurnCount !== undefined) context.assistantTurnCount = assistantTurnCount;
  if (browserName !== undefined) context.browserName = browserName;
  if (tabId !== undefined) context.tabId = tabId;
  return context;
}

function textFromData(data: unknown): string | undefined {
  if (data === null || typeof data !== "object") {
    return undefined;
  }
  const record = data as Record<string, unknown>;
  const text = record.text ?? record.responseText;
  return typeof text === "string" ? text : undefined;
}

function isDirectRun(): boolean {
  return process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
}

if (isDirectRun()) {
  process.exitCode = await main();
}
