import { describe, expect, it } from "vitest";
import { visibleLabelMatches } from "../../src/dom/label-match.js";
import { enumerateVisibleMenuItems, extractMenuItemsFromText, findUniqueMenuItem } from "../../src/dom/menus.js";
import type { PageLike } from "../../src/types.js";

describe("menu helpers", () => {
  it("normalizes bullet-separated menu labels", () => {
    expect(extractMenuItemsFromText("Latest • Instant • Extended").map(item => item.normalized)).toEqual([
      "latest",
      "instant",
      "extended"
    ]);
  });

  it("returns a unique fuzzy match", () => {
    const items = extractMenuItemsFromText("Web search\nDeep research\nCreate image");
    expect(findUniqueMenuItem(items, "deep")?.label).toBe("Deep research");
  });

  it("does not let short Pro matching select project menu rows", () => {
    const items = extractMenuItemsFromText("Move to project");
    expect(findUniqueMenuItem(items, "Pro")).toBeUndefined();
  });

  it("matches short labels only on token boundaries", () => {
    expect(visibleLabelMatches("Pro", "Pro")).toBe(true);
    expect(visibleLabelMatches("Pro Extended", "Pro")).toBe(true);
    expect(visibleLabelMatches("Move to project", "Pro")).toBe(false);
    expect(visibleLabelMatches("Projects", "Pro")).toBe(false);
  });

  it("matches CJK labels by exact alias or meaningful substring only", () => {
    expect(visibleLabelMatches("专业", "专业")).toBe(true);
    expect(visibleLabelMatches("专业模式", "专业")).toBe(true);
    expect(visibleLabelMatches("项目", "专业")).toBe(false);
  });

  it("scopes enumeration to open menu containers when any exist", async () => {
    const page = containerScopedPage({
      containerItems: ["Instant", "Thinking", "Pro"],
      strayItems: ["Recent thread row", "Sidebar option"]
    });

    const items = await enumerateVisibleMenuItems(page);

    expect(items.map(item => item.label)).toEqual(["Instant", "Thinking", "Pro"]);
  });

  it("keeps unscoped enumeration when no menu container is present", async () => {
    const page = containerScopedPage({
      containerItems: [],
      strayItems: ["Instant", "Thinking"]
    });

    const items = await enumerateVisibleMenuItems(page);

    expect(items.map(item => item.label)).toEqual(["Instant", "Thinking"]);
  });

  it("falls back to the unscoped list when containers hold no role items", async () => {
    const page = containerScopedPage({
      containerItems: [],
      strayItems: ["Instant", "Thinking"],
      emptyContainer: true
    });

    const items = await enumerateVisibleMenuItems(page);

    expect(items.map(item => item.label)).toEqual(["Instant", "Thinking"]);
  });
});

function containerScopedPage({
  containerItems,
  strayItems,
  emptyContainer = false
}: {
  containerItems: string[];
  strayItems: string[];
  emptyContainer?: boolean;
}): PageLike {
  const scopedNodes = containerItems.map(label => fakeRoleNode(label));
  const strayNodes = strayItems.map(label => fakeRoleNode(label));
  const containers = containerItems.length > 0 || emptyContainer
    ? [{ contains: (node: unknown) => scopedNodes.includes(node as ReturnType<typeof fakeRoleNode>) }]
    : [];

  return {
    evaluate: async <T, A = unknown>(fn: (arg: A) => T | Promise<T>, arg?: A) => {
      const previousDocument = globalThis.document;
      try {
        globalThis.document = {
          querySelectorAll: (selector: string) => {
            if (selector.includes("menuitem") || selector.includes("option")) {
              return [...scopedNodes, ...strayNodes];
            }
            if (selector.includes("[role='menu']")) {
              return containers;
            }
            return [];
          }
        } as unknown as Document;
        return await fn(arg as A);
      } finally {
        globalThis.document = previousDocument;
      }
    }
  };
}

function fakeRoleNode(label: string): { getAttribute: (name: string) => string | undefined; innerText: string; textContent: string } {
  return {
    getAttribute: () => undefined,
    innerText: label,
    textContent: label
  };
}
