import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";

import { AgentationExtensionApp } from "./AgentationExtensionApp";

const rootId = "agentation-extension-root";
let appRoot: Root | null = null;

type SetAgentationActiveMessage = {
  type: "AGENTATION_SET_ACTIVE";
  active: boolean;
};

type ToggleAgentationResponse = {
  ok: boolean;
  active: boolean;
};

export function isMounted(): boolean {
  return Boolean(document.getElementById(rootId));
}

function mount(): void {
  if (isMounted()) {
    return;
  }

  const container = document.createElement("div");
  container.id = rootId;
  document.documentElement.appendChild(container);

  appRoot = createRoot(container);
  appRoot.render(<AgentationExtensionApp />);
}

function unmount(): void {
  if (!isMounted()) {
    return;
  }

  appRoot?.unmount();
  appRoot = null;
  document.getElementById(rootId)?.remove();
}

function setActive(active: boolean): boolean {
  if (!active) {
    unmount();
    return false;
  }

  mount();
  return true;
}

function syncActiveStateFromBackground(): void {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return;
  }

  chrome.runtime.sendMessage(
    {
      type: "AGENTATION_GET_ACTIVE",
      url: window.location.href,
    },
    (response: ToggleAgentationResponse | undefined) => {
      if (chrome.runtime.lastError) {
        return;
      }

      if (!response?.ok) {
        return;
      }

      setActive(response.active);
    },
  );
}

chrome.runtime.onMessage.addListener(
  (
    message: SetAgentationActiveMessage,
    _sender,
    sendResponse: (response: ToggleAgentationResponse) => void,
  ) => {
    if (message?.type !== "AGENTATION_SET_ACTIVE") {
      return false;
    }

    const active = setActive(message.active);
    sendResponse({ ok: true, active });
    return true;
  },
);

syncActiveStateFromBackground();
