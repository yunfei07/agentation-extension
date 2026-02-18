import { describe, expect, it, vi } from "vitest";

import {
  buildPythonFileName,
  saveScriptAsPythonFile,
  type ScriptDownloadDependencies,
} from "./script-download";

describe("buildPythonFileName", () => {
  it("uses sanitized test name", () => {
    expect(buildPythonFileName("test_checkout_flow")).toBe(
      "test_checkout_flow.py",
    );
    expect(buildPythonFileName("test checkout flow!")).toBe(
      "test_checkout_flow.py",
    );
  });

  it("falls back to default when name is empty", () => {
    expect(buildPythonFileName("")).toBe("generated_playwright_test.py");
    expect(buildPythonFileName("___")).toBe("generated_playwright_test.py");
  });
});

describe("saveScriptAsPythonFile", () => {
  it("uses extension runtime download when available", async () => {
    const click = vi.fn();
    const anchor = { href: "", download: "", click };
    const deps: ScriptDownloadDependencies = {
      requestExtensionDownload: vi.fn().mockResolvedValue(true),
      createBlob: vi.fn().mockReturnValue({ type: "text/x-python" } as Blob),
      createObjectURL: vi.fn().mockReturnValue("blob:test-url"),
      revokeObjectURL: vi.fn(),
      createAnchor: vi.fn().mockReturnValue(anchor),
      appendAnchor: vi.fn(),
      removeAnchor: vi.fn(),
    };

    const filename = await saveScriptAsPythonFile(
      "def test_checkout(page):\n    pass",
      "test_checkout",
      deps,
    );

    expect(filename).toBe("test_checkout.py");
    expect(deps.requestExtensionDownload).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(0);
  });

  it("falls back to anchor download when extension download is unavailable", async () => {
    const click = vi.fn();
    const anchor = { href: "", download: "", click };
    const deps: ScriptDownloadDependencies = {
      requestExtensionDownload: vi.fn().mockResolvedValue(false),
      createBlob: vi.fn().mockReturnValue({ type: "text/x-python" } as Blob),
      createObjectURL: vi.fn().mockReturnValue("blob:test-url"),
      revokeObjectURL: vi.fn(),
      createAnchor: vi.fn().mockReturnValue(anchor),
      appendAnchor: vi.fn(),
      removeAnchor: vi.fn(),
    };

    const filename = await saveScriptAsPythonFile(
      "def test_checkout(page):\n    pass",
      "test_checkout",
      deps,
    );

    expect(filename).toBe("test_checkout.py");
    expect(anchor.href).toBe("blob:test-url");
    expect(anchor.download).toBe("test_checkout.py");
    expect(click).toHaveBeenCalledTimes(1);
    expect(deps.revokeObjectURL).toHaveBeenCalledWith("blob:test-url");
  });
});
