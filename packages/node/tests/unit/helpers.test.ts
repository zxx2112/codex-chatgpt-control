import { describe, expect, it } from "vitest";
import { planAskInThread, planAttachAskRead, planTwoTurnExchange } from "../../src/commands/helpers.js";

describe("compound helper planners", () => {
  it("expands askInThread to bootstrap, search, open, and one self-contained ask", () => {
    const plan = planAskInThread({
      thread: { query: "Naming macOS Utility" },
      text: "reply with the word hi",
      wait: true,
      read: true
    });

    expect(plan.steps.map(step => step.command)).toEqual([
      "session.bootstrap",
      "threads.search",
      "threads.open",
      "messages.ask"
    ]);
  });

  it("expands attachAskRead through file attachment before ask", () => {
    const plan = planAttachAskRead({
      thread: { conversationId: "abc" },
      files: ["/tmp/example.txt"],
      text: "summarize",
      wait: true,
      read: true
    });

    expect(plan.steps.map(step => step.command)).toEqual([
      "session.bootstrap",
      "threads.open",
      "files.attach",
      "messages.ask"
    ]);
  });

  it("expands twoTurnExchange to two ask commands", () => {
    const plan = planTwoTurnExchange({
      thread: { url: "https://chatgpt.com/c/abc" },
      text: "first",
      followupText: "second"
    });

    expect(plan.steps.filter(step => step.command === "messages.ask")).toHaveLength(2);
  });
});
