export type ScriptDownloadDependencies = {
  requestExtensionDownload: (params: {
    fileName: string;
    script: string;
  }) => Promise<boolean>;
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
      return false;
    }

    return await new Promise<boolean>((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "AGENTATION_SAVE_SCRIPT",
          fileName,
          script,
        },
        (response: { ok?: boolean } | undefined) => {
          if (chrome.runtime.lastError) {
            resolve(false);
            return;
          }
          resolve(Boolean(response?.ok));
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
    document.body.appendChild(anchor as HTMLAnchorElement);
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
    const savedByExtension = await deps.requestExtensionDownload({
      fileName,
      script,
    });
    if (savedByExtension) {
      return fileName;
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
