import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildGenerationRequestPayload,
  extractScriptFromResponse,
  generatePlaywrightScript,
} from "./generation-client";
import type { RuntimeConfig } from "../shared/runtime-config";

const defaultRuntimeConfig: RuntimeConfig = {
  backendUrl: "http://localhost:8000",
  model: "gpt-4.1-mini",
  temperature: 0.2,
  mcpEndpoint: "http://localhost:4747",
  generationTimeoutMs: 300000,
};

describe("buildGenerationRequestPayload", () => {
  it("maps data into backend contract", () => {
    const payload = buildGenerationRequestPayload({
      pageUrl: "https://example.com",
      markdown: "## output",
      annotations: [
        {
          id: "1",
          x: 10,
          y: 20,
          comment: "update CTA",
          element: "Button",
          elementPath: "body > button",
          timestamp: 123,
        },
      ],
    },
    defaultRuntimeConfig);

    expect(payload.page_url).toBe("https://example.com");
    expect(payload.output_markdown).toBe("## output");
    expect(payload.generation_options.style).toBe("pytest_sync");
    expect(payload.generation_options.timeout_ms).toBe(300000);
    expect(payload.model).toBe(defaultRuntimeConfig.model);
  });
});

describe("extractScriptFromResponse", () => {
  it("unwraps fenced python blocks", () => {
    const value = extractScriptFromResponse("```python\nprint('ok')\n```");
    expect(value).toBe("print('ok')");
  });
});

describe("generatePlaywrightScript", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("calls backend and returns script", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        script: "def test_homepage(page):\\n    pass",
        test_name: "test_homepage",
        metadata: { model: "gpt-4.1-mini", warnings: [] },
      }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const result = await generatePlaywrightScript({
      pageUrl: "https://example.com",
      markdown: "## output",
      annotations: [],
    }, defaultRuntimeConfig);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, fetchInit] = fetchMock.mock.calls[0];
    expect(fetchInit.signal).toBeDefined();
    const requestBody = JSON.parse(String(fetchInit.body)) as {
      generation_options: { timeout_ms?: number };
    };
    expect(requestBody.generation_options.timeout_ms).toBe(300000);
    expect(result.script).toContain("def test_homepage");
    expect(result.testName).toBe("test_homepage");
  });

  it("creates a case first and then generates script with case_id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          case: { id: "case-123" },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          script: "def test_assets(page):\\n    assert True",
          test_name: "test_assets",
          metadata: {
            model: "gpt-4.1-mini",
            warnings: [],
            asset: {
              case_id: "case-123",
              version_id: "version-2",
              version_no: 2,
            },
          },
        }),
      } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const result = await generatePlaywrightScript(
      {
        pageUrl: "https://example.com/checkout",
        markdown: "## output",
        annotations: [
          {
            id: "1",
            x: 10,
            y: 20,
            comment: "update CTA",
            element: "Button",
            elementPath: "body > button",
            timestamp: 123,
          },
        ],
      },
      defaultRuntimeConfig,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain("/api/v1/assets/cases");
    expect(fetchMock.mock.calls[1][0]).toContain(
      "/api/v1/scripts/playwright-python",
    );

    const [, generateInit] = fetchMock.mock.calls[1];
    const requestBody = JSON.parse(String(generateInit.body)) as {
      case_id?: string;
    };
    expect(requestBody.case_id).toBe("case-123");
    expect(result.metadata.asset?.caseId).toBe("case-123");
    expect(result.metadata.asset?.versionNo).toBe(2);
  });

  it("throws a timeout error when fetch aborts", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    const fetchMock = vi.fn().mockRejectedValue(abortError);
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generatePlaywrightScript({
        pageUrl: "https://example.com",
        markdown: "## output",
        annotations: [],
      }, defaultRuntimeConfig),
    ).rejects.toThrow("timed out");
  });
});
