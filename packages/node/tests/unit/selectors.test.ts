import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractThreadSearchResultsFromHtml, selectSearchResult } from "../../src/commands/threads.js";

describe("thread search parsing", () => {
  it("parses title, snippet, href, and conversation id", () => {
    const html = readFileSync("tests/fixtures/search-results.html", "utf8");
    const results = extractThreadSearchResultsFromHtml(html);

    expect(results[0]).toMatchObject({
      title: "Naming macOS Utility",
      snippet: "This is strong. I would make only a few tweaks...",
      href: "/c/6a20e900-4744-83ea-9b80-2c75fb85bd63",
      conversationId: "6a20e900-4744-83ea-9b80-2c75fb85bd63"
    });
  });

  it("selects exact normalized titles before fuzzy matches", () => {
    const selected = selectSearchResult(
      [
        { title: "Other Naming macOS Utility", href: "/c/1" },
        { title: "Naming macOS Utility", href: "/c/2" }
      ],
      { title: "naming macos utility" }
    );

    expect(selected?.href).toBe("/c/2");
  });
});
