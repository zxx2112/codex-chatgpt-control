import { attachChatGPTBrowser } from "../browser/attach.js";
import { readPageState } from "../browser/page-state.js";
import { resultError, resultOk } from "../errors.js";
import type { BootstrapArgs, BootstrapData, CommandResult, RuntimeEnv } from "../types.js";
import { contextFromPage } from "./context.js";

export async function bootstrap(
  env: RuntimeEnv,
  args: BootstrapArgs = {}
): Promise<CommandResult<BootstrapData>> {
  try {
    const attached = await attachChatGPTBrowser(env, args);
    env.browser = attached.browser;
    env.page = attached.page;

    const state = await readPageState(attached.page);
    const data: BootstrapData = {
      browserName: attached.browserName,
      tabId: attached.tabId ?? "unknown",
      url: state.url,
      loggedIn: state.signedIn
    };

    const context = attached.tabId === undefined
      ? { browserName: attached.browserName }
      : { browserName: attached.browserName, tabId: attached.tabId };

    return resultOk(data, await contextFromPage(attached.page, context));
  } catch (error) {
    return resultError(error instanceof Error ? error : new Error(String(error)));
  }
}
