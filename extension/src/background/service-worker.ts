import {
  getDomainFromUrl,
  getDomainStorageKey,
  isSameDomainUrl,
} from "./domain-toggle";

type SetAgentationActiveMessage = {
  type: "AGENTATION_SET_ACTIVE";
  active: boolean;
};

type GetAgentationActiveMessage = {
  type: "AGENTATION_GET_ACTIVE";
  url?: string;
};

type SaveScriptMessage = {
  type: "AGENTATION_SAVE_SCRIPT";
  fileName: string;
  script: string;
};

type ToggleAgentationResponse = {
  ok: boolean;
  active: boolean;
};

chrome.runtime.onInstalled.addListener(() => {
  console.info(
    "[Agentation Extension] Config is build-time injected from backend/.env",
  );
});

type SaveScriptResponse = {
  ok: boolean;
  downloadId?: number;
  error?: string;
};

type AgentationMessage = GetAgentationActiveMessage | SaveScriptMessage;

async function getDomainActive(domain: string): Promise<boolean> {
  const key = getDomainStorageKey(domain);
  const stored = await chrome.storage.local.get(key);
  return Boolean(stored[key]);
}

async function setDomainActive(domain: string, active: boolean): Promise<void> {
  const key = getDomainStorageKey(domain);
  await chrome.storage.local.set({ [key]: active });
}

function sendSetActiveMessage(
  tabId: number,
  active: boolean,
): Promise<ToggleAgentationResponse> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(
      tabId,
      { type: "AGENTATION_SET_ACTIVE", active } as SetAgentationActiveMessage,
      (response: ToggleAgentationResponse | undefined) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response) {
          reject(new Error("No response from content script"));
          return;
        }
        resolve(response);
      },
    );
  });
}

async function setBadgeForTab(tabId: number, tabUrl?: string): Promise<void> {
  const domain = getDomainFromUrl(tabUrl);
  if (!domain) {
    await chrome.action.setBadgeText({ tabId, text: "" });
    return;
  }

  const active = await getDomainActive(domain);
  await chrome.action.setBadgeBackgroundColor({
    color: active ? "#22c55e" : "#64748b",
    tabId,
  });
  await chrome.action.setBadgeText({
    text: active ? "ON" : "OFF",
    tabId,
  });
}

async function broadcastDomainActive(domain: string, active: boolean): Promise<void> {
  const tabs = await chrome.tabs.query({});

  await Promise.all(
    tabs.map(async (candidate) => {
      if (!candidate.id || !isSameDomainUrl(candidate.url, domain)) {
        return;
      }
      try {
        await sendSetActiveMessage(candidate.id, active);
      } catch {
        // Ignore tabs where content script is unavailable.
      }
      await setBadgeForTab(candidate.id, candidate.url);
    }),
  );
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  const domain = getDomainFromUrl(tab.url);
  if (!domain) return;

  try {
    const nextActive = !(await getDomainActive(domain));
    await setDomainActive(domain, nextActive);
    await broadcastDomainActive(domain, nextActive);
  } catch (error) {
    console.warn("[Agentation Extension] Toggle failed:", error);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    await setBadgeForTab(tabId, tab.url);
  } catch {
    // Ignore tab races.
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url && changeInfo.status !== "complete") {
    return;
  }
  try {
    await setBadgeForTab(tabId, tab.url ?? changeInfo.url);
  } catch {
    // Ignore tab update races.
  }
});

chrome.runtime.onMessage.addListener(
  (message: AgentationMessage, sender, sendResponse) => {
    if (message?.type === "AGENTATION_SAVE_SCRIPT") {
      const contentUrl = `data:text/x-python;charset=utf-8,${encodeURIComponent(
        message.script,
      )}`;

      chrome.downloads.download(
        {
          url: contentUrl,
          filename: message.fileName,
          saveAs: false,
          conflictAction: "uniquify",
        },
        (downloadId) => {
          if (chrome.runtime.lastError) {
            sendResponse({
              ok: false,
              error: chrome.runtime.lastError.message,
            } satisfies SaveScriptResponse);
            return;
          }

          sendResponse({
            ok: typeof downloadId === "number",
            downloadId,
          } satisfies SaveScriptResponse);
        },
      );
      return true;
    }

    if (message?.type !== "AGENTATION_GET_ACTIVE") {
      return false;
    }

    const domain =
      getDomainFromUrl(message.url) ?? getDomainFromUrl(sender.tab?.url);
    if (!domain) {
      sendResponse({ ok: true, active: false });
      return true;
    }

    getDomainActive(domain)
      .then((active) => sendResponse({ ok: true, active }))
      .catch((error) => {
        console.warn("[Agentation Extension] Failed to read domain state:", error);
        sendResponse({ ok: false, active: false });
      });
    return true;
  },
);
