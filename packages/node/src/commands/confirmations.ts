import type { CommandResult } from "../types.js";

export type Confirmation = {
  targetKind: string;
  targetDisplayName: string;
  action: string;
  understood: true;
};

export function requireConfirmation<T>(
  confirm: Confirmation | undefined,
  expected: Omit<Confirmation, "understood">
): CommandResult<T> | undefined {
  if (
    confirm?.understood === true
    && confirm.targetKind === expected.targetKind
    && confirm.targetDisplayName === expected.targetDisplayName
    && confirm.action === expected.action
  ) {
    return undefined;
  }

  return {
    ok: false,
    status: "needs_confirmation",
    warnings: [],
    blocker: {
      kind: "confirmation",
      message: `Confirmation required before ${expected.action} on ${expected.targetKind} "${expected.targetDisplayName}".`
    },
    context: { timestamp: new Date().toISOString() }
  };
}

export function rejectNetworkCommand<T>(command: string): CommandResult<T> | undefined {
  if (!command.startsWith("network.")) {
    return undefined;
  }

  return {
    ok: false,
    status: "unsupported",
    warnings: [],
    blocker: {
      kind: "confirmation",
      message: "Private ChatGPT network replay commands are intentionally unsupported."
    },
    context: { timestamp: new Date().toISOString() }
  };
}
