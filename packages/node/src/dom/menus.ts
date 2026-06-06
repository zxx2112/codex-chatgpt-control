import type { PageLike } from "../types.js";
import { normalizeLabel, normalizeWhitespace } from "./visible-text.js";

export type MenuItem = {
  label: string;
  normalized: string;
};

export function extractMenuItemsFromText(text: string): MenuItem[] {
  return text
    .split(/\n| {2,}| • /)
    .map(label => normalizeWhitespace(label))
    .filter(Boolean)
    .map(label => ({ label, normalized: normalizeLabel(label) }));
}

export async function enumerateVisibleMenuItems(page: PageLike): Promise<MenuItem[]> {
  if (typeof page.evaluate === "function") {
    const labels = await page.evaluate(() => {
      const roleItems = Array.from(document.querySelectorAll("[role='menuitem'], [role='menuitemradio'], [role='option']"))
        .map(node => (node as HTMLElement).innerText ?? node.textContent ?? "")
        .filter(Boolean);

      if (roleItems.length > 0) {
        return { labels: roleItems, split: false };
      }

      const menus = Array.from(document.querySelectorAll("[role='menu'], [role='listbox'], [data-radix-popper-content-wrapper]"))
        .map(node => (node as HTMLElement).innerText ?? node.textContent ?? "")
        .filter(Boolean);

      return { labels: menus, split: true };
    });

    return labels.split
      ? labels.labels.flatMap(label => extractMenuItemsFromText(label))
      : labels.labels
        .map(label => normalizeWhitespace(label))
        .filter(Boolean)
        .map(label => ({ label, normalized: normalizeLabel(label) }));
  }

  return [];
}

export function findUniqueMenuItem(items: MenuItem[], wanted: string): MenuItem | undefined {
  const normalized = normalizeLabel(wanted);
  const exact = items.filter(item => item.normalized === normalized);
  if (exact.length === 1) {
    return exact[0];
  }

  const fuzzy = items.filter(item => item.normalized.includes(normalized));
  return fuzzy.length === 1 ? fuzzy[0] : undefined;
}
