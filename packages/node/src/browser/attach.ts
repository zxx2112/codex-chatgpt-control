import { BrowserBridgeUnavailableError, LoginRequiredError, SelectorDriftError } from "../errors.js";
import type { BootstrapArgs, BrowserLike, PageLike, RuntimeEnv } from "../types.js";
import { readPageState } from "./page-state.js";

const CHATGPT_HOME = "https://chatgpt.com/";

export type AttachedBrowser = {
  browser: BrowserLike;
  page: PageLike;
  browserName: string;
  tabId?: string;
};

export async function attachChatGPTBrowser(
  env: RuntimeEnv,
  args: BootstrapArgs = {}
): Promise<AttachedBrowser> {
  const browser = await getBrowser(env);
  const page = await getOrCreateChatGPTPage(browser, env, args);
  const state = await readPageState(page);

  if (state.blocker?.kind === "login_required") {
    throw new LoginRequiredError(state.blocker.visibleText);
  }

  if (state.url.includes("chatgpt.com") && !state.signedIn && state.visibleText.length > 0) {
    throw new SelectorDriftError("ChatGPT loaded, but no signed-in ChatGPT controls were recognized.", state.visibleText);
  }

  const attached: AttachedBrowser = {
    browser,
    page,
    browserName: browser.name ?? "chrome"
  };

  const tabId = getTabId(page);
  if (tabId !== undefined) {
    attached.tabId = tabId;
  }

  return attached;
}

async function getBrowser(env: RuntimeEnv): Promise<BrowserLike> {
  if (env.browser !== undefined) {
    return env.browser;
  }

  const anyEnv = env as Record<string, unknown>;
  const agent = env.agent ?? anyEnv.agent ?? (globalThis as Record<string, unknown>).agent;
  const browsers = (agent as { browsers?: unknown } | undefined)?.browsers;

  if (browsers !== undefined && typeof browsers === "object") {
    const maybeBrowser = await tryBrowserGetPreferredListed(browsers)
      ?? await tryBrowserGet(browsers, "extension")
      ?? await tryBrowserGet(browsers, "chrome");

    if (maybeBrowser !== undefined) {
      return maybeBrowser;
    }
  }

  throw new BrowserBridgeUnavailableError();
}

async function tryBrowserGet(browsers: unknown, name: string): Promise<BrowserLike | undefined> {
  const get = (browsers as { get?: (browserName: string) => Promise<unknown> | unknown }).get;
  if (typeof get !== "function") {
    return undefined;
  }

  try {
    const browser = await get.call(browsers, name);
    return normalizeBrowser(browser);
  } catch {
    return undefined;
  }
}

async function tryBrowserGetFirst(browsers: unknown): Promise<BrowserLike | undefined> {
  const list = (browsers as { list?: () => Promise<unknown[]> | unknown[] }).list;
  const get = (browsers as { get?: (browserName: string) => Promise<unknown> | unknown }).get;

  if (typeof list !== "function" || typeof get !== "function") {
    return undefined;
  }

  try {
    const names = await list.call(browsers);
    const first = names.find(name => typeof name === "string") as string | undefined;
    if (first === undefined) {
      return undefined;
    }
    const browser = await get.call(browsers, first);
    return normalizeBrowser(browser);
  } catch {
    return undefined;
  }
}

async function tryBrowserGetPreferredListed(browsers: unknown): Promise<BrowserLike | undefined> {
  const list = (browsers as { list?: () => Promise<Array<Record<string, unknown>>> | Array<Record<string, unknown>> }).list;
  const get = (browsers as { get?: (browserName: string) => Promise<unknown> | unknown }).get;

  if (typeof list !== "function" || typeof get !== "function") {
    return undefined;
  }

  try {
    const available = await list.call(browsers);
    const preferred = available.find(browser => browser.type === "extension")
      ?? available.find(browser => typeof browser.name === "string" && /chrome/i.test(browser.name))
      ?? available[0];
    const id = preferred?.id;
    if (typeof id !== "string") {
      return undefined;
    }
    const browser = await get.call(browsers, id);
    return normalizeBrowser(browser);
  } catch {
    return undefined;
  }
}

async function getOrCreateChatGPTPage(
  browser: BrowserLike,
  env: RuntimeEnv,
  args: BootstrapArgs
): Promise<PageLike> {
  if (env.page !== undefined) {
    return normalizePage(env.page);
  }

  const targetUrl = args.url ?? CHATGPT_HOME;

  if (args.preferExistingTab !== false) {
    const existing = await findExistingChatGPTTab(browser);
    if (existing !== undefined) {
      return existing;
    }
  }

  const created = await createTab(browser, targetUrl);
  if (created !== undefined) {
    return created;
  }

  throw new BrowserBridgeUnavailableError("Codex can access a browser object, but no tab creation API was found.");
}

async function findExistingChatGPTTab(browser: BrowserLike): Promise<PageLike | undefined> {
  const selected = browser.tabs?.selected;
  if (typeof selected === "function") {
    try {
      const current = await selected.call(browser.tabs);
      if (current !== undefined) {
        const normalized = normalizePage(current);
        try {
          if ((await normalized.url?.())?.includes("chatgpt.com") === true) {
            return normalized;
          }
        } catch {
          // Continue to full tab list.
        }
      }
    } catch {
      // No selected tab is a normal fresh-browser state.
    }
  }

  const list = browser.tabs?.list;
  if (typeof list !== "function") {
    return undefined;
  }

  const tabs = await list.call(browser.tabs);
  const normalized = await Promise.all(tabs.map(tab => hydrateTab(browser, tab)));
  for (const tab of normalized) {
    try {
      if ((await tab.url?.())?.includes("chatgpt.com") === true) {
        return tab;
      }
    } catch {
      // Keep looking.
    }
  }
  return undefined;
}

async function createTab(browser: BrowserLike, url: string): Promise<PageLike | undefined> {
  if (typeof browser.tabs?.create === "function") {
    const tab = await browser.tabs.create(url);
    const page = await hydrateTab(browser, tab);
    await ensurePageAt(page, url);
    return page;
  }

  if (typeof browser.tabs?.new === "function") {
    const tab = await browser.tabs.new(url);
    const page = await hydrateTab(browser, tab);
    await ensurePageAt(page, url);
    return page;
  }

  if (typeof browser.newPage === "function") {
    const page = normalizePage(await browser.newPage());
    if (typeof page.goto === "function") {
      await page.goto(url);
    }
    return page;
  }

  return undefined;
}

async function ensurePageAt(page: PageLike, url: string): Promise<void> {
  const currentUrl = await Promise.resolve(page.url?.()).catch(() => "");
  if (currentUrl?.includes("chatgpt.com") === true) {
    return;
  }
  if (typeof page.goto === "function") {
    await page.goto(url);
  }
}

function normalizeBrowser(browser: unknown): BrowserLike | undefined {
  if (browser === undefined || browser === null || typeof browser !== "object") {
    return undefined;
  }

  return browser as BrowserLike;
}

async function hydrateTab(browser: BrowserLike, pageOrTab: unknown): Promise<PageLike> {
  const maybe = pageOrTab as Record<string, unknown>;
  if (maybe.playwright === undefined && typeof maybe.id === "string" && typeof browser.tabs?.get === "function") {
    try {
      return normalizePage(await browser.tabs.get(maybe.id));
    } catch {
      return normalizePage(pageOrTab);
    }
  }
  return normalizePage(pageOrTab);
}

function normalizePage(pageOrTab: unknown): PageLike {
  const maybe = pageOrTab as Record<string, unknown>;
  const playwright = maybe.playwright ?? maybe.page;
  if (playwright !== undefined && typeof playwright === "object") {
    return new Proxy(playwright as Record<string, unknown>, {
      get(target, prop) {
        if (prop in target) {
          const value = target[prop as keyof typeof target];
          return typeof value === "function" ? value.bind(target) : value;
        }
        const value = maybe[prop as keyof typeof maybe];
        return typeof value === "function" ? value.bind(maybe) : value;
      }
    }) as PageLike;
  }

  if (typeof maybe.url === "string") {
    return {
      ...maybe,
      url: () => maybe.url as string,
      title: async () => typeof maybe.title === "string" ? maybe.title : ""
    } as PageLike;
  }

  return pageOrTab as PageLike;
}

function getTabId(page: PageLike): string | undefined {
  const maybe = page as Record<string, unknown>;
  const id = maybe.id ?? maybe.tabId;
  return typeof id === "string" ? id : undefined;
}
