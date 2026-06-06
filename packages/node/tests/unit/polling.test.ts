import { describe, expect, it } from "vitest";
import { isResponseComplete } from "../../src/commands/messages.js";

describe("isResponseComplete", () => {
  it("requires stable text, response actions, and no active stop control", () => {
    expect(isResponseComplete({
      textStableForMs: 2200,
      stableMs: 2000,
      hasStopButton: false,
      hasResponseActions: true,
      latestText: "hi"
    })).toBe(true);
  });

  it("does not complete while stop control is visible", () => {
    expect(isResponseComplete({
      textStableForMs: 5000,
      stableMs: 2000,
      hasStopButton: true,
      hasResponseActions: false,
      latestText: "hi"
    })).toBe(false);
  });

  it("does not complete while text is still unstable", () => {
    expect(isResponseComplete({
      textStableForMs: 500,
      stableMs: 2000,
      hasStopButton: false,
      hasResponseActions: true,
      latestText: "hi"
    })).toBe(false);
  });

  it("does not complete on transient reasoning labels", () => {
    expect(isResponseComplete({
      textStableForMs: 5000,
      stableMs: 2000,
      hasStopButton: false,
      hasResponseActions: true,
      latestText: "Thinking"
    })).toBe(false);
  });
});
