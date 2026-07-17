import { describe, expect, it, vi } from "vitest";
import {
  composerTextbox,
  newChatButton,
  sendButton
} from "../../src/dom/selectors.js";
import type { LocatorLike, PageLike } from "../../src/types.js";

describe("structural ChatGPT selectors", () => {
  it("prefers stable DOM attributes over localized accessible names", () => {
    const locatorResult: LocatorLike = {};
    const locator = vi.fn(() => locatorResult);
    const getByRole = vi.fn<(role: string, options?: Record<string, unknown>) => LocatorLike>(() => ({}));
    const page: PageLike = { locator, getByRole };

    expect(composerTextbox(page)).toBe(locatorResult);
    expect(locator).toHaveBeenLastCalledWith(expect.stringContaining("textarea[name='prompt-textarea']"));

    expect(newChatButton(page)).toBe(locatorResult);
    expect(locator).toHaveBeenLastCalledWith("[data-testid='create-new-chat-button']:visible");

    expect(sendButton(page)).toBe(locatorResult);
    expect(locator).toHaveBeenLastCalledWith("main [data-testid='send-button']:visible");
    expect(getByRole).not.toHaveBeenCalled();
  });

  it("falls back to the current Simplified Chinese accessible names", () => {
    const roleResult: LocatorLike = {};
    const getByRole = vi.fn<(role: string, options?: Record<string, unknown>) => LocatorLike>(
      () => roleResult
    );
    const page: PageLike = { getByRole };

    expect(composerTextbox(page)).toBe(roleResult);
    const composerPattern = getByRole.mock.calls.at(-1)?.[1]?.name;
    expect(composerPattern).toBeInstanceOf(RegExp);
    expect((composerPattern as RegExp).test("与 ChatGPT 聊天")).toBe(true);

    expect(newChatButton(page)).toBe(roleResult);
    expect(getByRole.mock.calls.at(-1)?.[0]).toBe("link");
    const newChatPattern = getByRole.mock.calls.at(-1)?.[1]?.name;
    expect(newChatPattern).toBeInstanceOf(RegExp);
    expect((newChatPattern as RegExp).test("新聊天")).toBe(true);
  });
});
