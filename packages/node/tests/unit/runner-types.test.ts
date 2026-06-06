import { describe, expect, it } from "vitest";
import type {
  ChatGPTAgentConfig,
  ChatGPTResponse,
  ChatGPTRunInput,
  ChatGPTRunItem,
  ChatGPTRunResult
} from "../../src/runner/types.js";

describe("runner public type contract", () => {
  it("models ChatGPTAgent as a browser-control profile", () => {
    const config: ChatGPTAgentConfig = {
      name: "reviewer",
      instructions: "Review deeply.",
      instructionsMode: "visible_prefix",
      defaults: {
        thread: { type: "new" },
        read: { format: "markdown" }
      }
    };

    expect(config.name).toBe("reviewer");
    expect(config.instructionsMode).toBe("visible_prefix");
  });

  it("models runner input with attachments and visible UI thread selectors", () => {
    const input: ChatGPTRunInput = {
      input: "Review this file.",
      thread: { type: "conversationId", conversationId: "abc-123" },
      attachments: [{ path: "/absolute/file.md" }],
      response: { format: "markdown" }
    };

    expect(input.thread?.type).toBe("conversationId");
  });

  it("models run items without requiring raw content in every item", () => {
    const item: ChatGPTRunItem = {
      type: "message.submitted",
      role: "user",
      preview: "Review this file.",
      redacted: true
    };

    expect(item.redacted).toBe(true);
  });

  it("models browser response objects as non-OpenAI API responses", () => {
    const response: ChatGPTResponse = {
      id: "chatgpt-browser-test",
      object: "chatgpt.browser.response",
      created_at: 0,
      status: "ok",
      output_text: "hi",
      output: [],
      browser_control: {
        visibleUi: true,
        resultStatus: "ok"
      }
    };

    expect(response.object).toBe("chatgpt.browser.response");
  });

  it("allows run results to expose finalOutput and output_text", () => {
    const result = {
      ok: true,
      status: "ok",
      warnings: [],
      context: { timestamp: "2026-06-05T00:00:00.000Z" },
      output_text: "hi",
      output: [],
      newItems: [],
      interruptions: [],
      state: { id: "state-1", resumable: false },
      activeAgentName: "reviewer",
      lastAgentName: "reviewer",
      finalOutput: "hi"
    } satisfies ChatGPTRunResult;

    expect(result.finalOutput).toBe("hi");
  });
});
