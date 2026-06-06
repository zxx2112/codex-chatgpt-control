import { describe, expect, it } from "vitest";
import { resultBlocked, resultOk } from "../../src/errors.js";

describe("result helpers", () => {
  it("creates an ok result with context and warnings", () => {
    const result = resultOk({ value: "hi" }, { url: "https://chatgpt.com/" });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("ok");
    expect(result.data?.value).toBe("hi");
    expect(result.warnings).toEqual([]);
    expect(result.context.url).toBe("https://chatgpt.com/");
  });

  it("creates a blocked result with recoverable blocker metadata", () => {
    const result = resultBlocked("login_required", "Please log in", "Sign in");

    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked");
    expect(result.blocker?.kind).toBe("login_required");
    expect(result.blocker?.visibleText).toBe("Sign in");
  });
});
