import type { CommandResult } from "../types.js";
import { augmentCommandBlocker, resumeDecisionForBlocker } from "./resume.js";
import type { ChatGPTCommandBlocker, ChatGPTInterruption } from "./types.js";

export function interruptionFromCommandResult(
  result: CommandResult<unknown>,
  command?: string
): ChatGPTInterruption | undefined {
  if (!isInterruptingResult(result)) {
    return undefined;
  }

  const id = `interruption-${Date.now().toString(36)}`;
  const blocker = result.blocker === undefined ? undefined : augmentCommandBlocker(result.blocker);
  const remediation = blocker?.remediation ?? [];
  const interruption: ChatGPTInterruption = {
    id,
    type: interruptionType(result, blocker),
    status: result.status,
    message: blocker?.message ?? result.error?.message ?? result.status,
    resume: resumeDecisionForBlocker(blocker, id)
  };

  if (blocker !== undefined) {
    interruption.blocker = blocker;
    if (blocker.fieldPath !== undefined) interruption.fieldPath = blocker.fieldPath;
  }
  if (command !== undefined) interruption.command = command;
  if (remediation.length > 0) {
    interruption.fix = {
      summary: "Resolve the reported blocker before resuming.",
      steps: remediation.map(step => step.instruction)
    };
  }

  return interruption;
}

function isInterruptingResult(result: CommandResult<unknown>): boolean {
  return result.blocker !== undefined
    || result.status === "needs_confirmation"
    || result.status === "unsupported"
    || result.status === "timeout";
}

function interruptionType(
  result: CommandResult<unknown>,
  blocker: ChatGPTCommandBlocker | undefined
): ChatGPTInterruption["type"] {
  switch (blocker?.kind) {
    case "confirmation":
      return "approval_required";
    case "permission":
    case "upload_failed":
    case "download_unavailable":
      return "permission_required";
    case "login_required":
      return "login_required";
    case "captcha":
      return "captcha";
    case "rate_limit":
      return "rate_limit";
    case "selector_drift":
      return "selector_drift";
    case "browser_bridge_unavailable":
    case "not_found":
    case "modal":
    case "unknown":
    case undefined:
      break;
  }

  if (result.status === "needs_confirmation") return "approval_required";
  if (result.status === "timeout") return "timeout";
  return "unsupported";
}
