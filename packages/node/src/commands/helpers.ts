import type {
  AskHelperArgs,
  AskInThreadArgs,
  AttachAskReadArgs,
  CommandResult,
  DownloadLatestArgs,
  PrecannedResponseArgs,
  RuntimeEnv,
  SearchOpenCopyArgs,
  SendAndWaitArgs,
  SequencePlan,
  ThreadTarget,
  TwoTurnExchangeArgs
} from "../types.js";
import { runSequence } from "./sequence.js";

export function planAsk(args: AskHelperArgs): SequencePlan {
  const steps: SequencePlan["steps"] = [
    { id: "bootstrap", command: "session.bootstrap" }
  ];

  if (args.thread !== undefined) {
    steps.push(...threadOpenSteps(args.thread));
  }

  steps.push({ id: "ask", command: "messages.ask", args: askStepArgs(args) });
  return { name: "ask", steps };
}

export function planAskInThread(args: AskInThreadArgs): SequencePlan {
  return {
    name: "ask-in-thread",
    policy: {
      stopOnError: true,
      returnPartial: true,
      allowPromptResubmit: "only_if_no_matching_user_turn"
    },
    steps: [
      { id: "bootstrap", command: "session.bootstrap" },
      ...threadOpenSteps(args.thread),
      { id: "ask", command: "messages.ask", args: askStepArgs(args) }
    ]
  };
}

export function planAttachAskRead(args: AttachAskReadArgs): SequencePlan {
  return {
    name: "attach-ask-read",
    policy: { stopOnError: true, returnPartial: true },
    steps: [
      { id: "bootstrap", command: "session.bootstrap" },
      ...threadOpenSteps(args.thread),
      { id: "attach", command: "files.attach", args: { paths: args.files } },
      { id: "ask", command: "messages.ask", args: { text: args.text, wait: args.wait ?? true, read: args.read ?? true } }
    ]
  };
}

export function planDownloadLatestAttachment(args: DownloadLatestArgs): SequencePlan {
  return {
    name: "download-latest-attachment",
    steps: [
      { id: "bootstrap", command: "session.bootstrap" },
      { id: "download", command: "files.downloadLatest", args }
    ]
  };
}

export function planSearchOpenCopyLatest(args: SearchOpenCopyArgs): SequencePlan {
  return {
    name: "search-open-copy-latest",
    steps: [
      { id: "bootstrap", command: "session.bootstrap" },
      ...threadOpenSteps(args.thread),
      { id: "copy", command: "response.copy", args: { which: "latest" } }
    ]
  };
}

export function planTwoTurnExchange(args: TwoTurnExchangeArgs): SequencePlan {
  return {
    name: "two-turn-exchange",
    policy: { stopOnError: true, returnPartial: true },
    steps: [
      { id: "bootstrap", command: "session.bootstrap" },
      ...threadOpenSteps(args.thread),
      { id: "ask1", command: "messages.ask", args: { text: args.text, wait: true, read: true } },
      { id: "ask2", command: "messages.ask", args: { text: args.followupText, wait: true, read: true } }
    ]
  };
}

export async function ask(args: AskHelperArgs, env: RuntimeEnv = {}): Promise<CommandResult<unknown>> {
  return runSequence(planAsk(args), env);
}

export async function askInThread(args: AskInThreadArgs, env: RuntimeEnv = {}): Promise<CommandResult<unknown>> {
  return runSequence(planAskInThread(args), env);
}

export async function findSwitchAskWaitRead(args: AskInThreadArgs, env: RuntimeEnv = {}): Promise<CommandResult<unknown>> {
  return askInThread(args, env);
}

export async function sendAndWait(args: SendAndWaitArgs, env: RuntimeEnv = {}): Promise<CommandResult<unknown>> {
  return runSequence({
    name: "send-and-wait",
    steps: [
      { id: "bootstrap", command: "session.bootstrap" },
      { id: "ask", command: "messages.ask", args: { text: args.text, wait: args.wait ?? true, read: true } }
    ]
  }, env);
}

export async function sendPrecannedResponse(args: PrecannedResponseArgs, env: RuntimeEnv = {}): Promise<CommandResult<unknown>> {
  return askInThread(args, env);
}

export async function attachAskRead(args: AttachAskReadArgs, env: RuntimeEnv = {}): Promise<CommandResult<unknown>> {
  return runSequence(planAttachAskRead(args), env);
}

export async function downloadLatestAttachment(args: DownloadLatestArgs, env: RuntimeEnv = {}): Promise<CommandResult<unknown>> {
  return runSequence(planDownloadLatestAttachment(args), env);
}

export async function searchOpenCopyLatest(args: SearchOpenCopyArgs, env: RuntimeEnv = {}): Promise<CommandResult<unknown>> {
  return runSequence(planSearchOpenCopyLatest(args), env);
}

export async function twoTurnExchange(args: TwoTurnExchangeArgs, env: RuntimeEnv = {}): Promise<CommandResult<unknown>> {
  return runSequence(planTwoTurnExchange(args), env);
}

function threadOpenSteps(thread: ThreadTarget): SequencePlan["steps"] {
  if (thread.url !== undefined) {
    return [{ id: "open", command: "threads.open", args: { url: thread.url } }];
  }
  if (thread.conversationId !== undefined) {
    return [{ id: "open", command: "threads.open", args: { conversationId: thread.conversationId } }];
  }

  const query = thread.query ?? thread.title;
  if (query !== undefined) {
    return [
      { id: "find", command: "threads.search", args: { query, limit: 5 } },
      { id: "open", command: "threads.open", args: { fromStep: "find", select: thread.title === undefined ? "first" : { title: thread.title } } }
    ];
  }

  return [];
}

function askStepArgs(args: { text: string; wait?: unknown; read?: unknown }) {
  const askArgs: { text: string; wait?: never; read?: never } = { text: args.text };
  if (args.wait !== undefined) {
    (askArgs as { wait?: unknown }).wait = args.wait;
  }
  if (args.read !== undefined) {
    (askArgs as { read?: unknown }).read = args.read;
  }
  return askArgs;
}
