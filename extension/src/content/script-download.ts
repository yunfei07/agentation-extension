export type ScriptDownloadDependencies = {
  requestExtensionDownload: (params: {
    fileName: string;
    script: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  createBlob: (content: string) => Blob;
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
  createAnchor: () => {
    href: string;
    download: string;
    click: () => void;
  };
  appendAnchor: (anchor: { href: string; download: string; click: () => void }) => void;
  removeAnchor: (anchor: { href: string; download: string; click: () => void }) => void;
};

const DEFAULT_FILE_BASENAME = "generated_playwright_test";

function sanitizeFileBasename(value: string): string {
  const sanitized = value
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  return sanitized.length > 0 ? sanitized : DEFAULT_FILE_BASENAME;
}

export function buildPythonFileName(testName: string): string {
  return `${sanitizeFileBasename(testName)}.py`;
}

const defaultDependencies: ScriptDownloadDependencies = {
  requestExtensionDownload: async ({
    fileName,
    script,
  }: {
    fileName: string;
    script: string;
  }) => {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
      return { ok: false, error: "chrome.runtime.sendMessage is unavailable" };
    }

    return await new Promise<{ ok: boolean; error?: string }>((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "AGENTATION_SAVE_SCRIPT",
          fileName,
          script,
        } as {
          type: string;
          fileName: string;
          script: string;
        },
        (response: { ok?: boolean; error?: string } | undefined) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }
          resolve({
            ok: Boolean(response?.ok),
            error: response?.error,
          });
        },
      );
    });
  },
  createBlob: (content: string) =>
    new Blob([content], { type: "text/x-python;charset=utf-8" }),
  createObjectURL: (blob: Blob) => URL.createObjectURL(blob),
  revokeObjectURL: (url: string) => URL.revokeObjectURL(url),
  createAnchor: () => document.createElement("a"),
  appendAnchor: (anchor) => {
    (document.body || document.documentElement).appendChild(
      anchor as HTMLAnchorElement,
    );
  },
  removeAnchor: (anchor) => {
    (anchor as HTMLAnchorElement).remove();
  },
};

export async function saveScriptAsPythonFile(
  script: string,
  testName: string,
  deps: ScriptDownloadDependencies = defaultDependencies,
): Promise<string> {
  const fileName = buildPythonFileName(testName);

  try {
    const extensionResult = await deps.requestExtensionDownload({
      fileName,
      script,
    });
    if (extensionResult.ok) {
      return fileName;
    }
    if (extensionResult.error) {
      console.warn(
        `[Agentation Extension] Extension download failed (${extensionResult.error}); using anchor fallback.`,
      );
    }
  } catch {
    // Fallback to anchor download below.
  }

  const blob = deps.createBlob(script);
  const objectUrl = deps.createObjectURL(blob);
  const anchor = deps.createAnchor();

  anchor.href = objectUrl;
  anchor.download = fileName;
  deps.appendAnchor(anchor);
  anchor.click();
  deps.removeAnchor(anchor);
  deps.revokeObjectURL(objectUrl);

  return fileName;
}
