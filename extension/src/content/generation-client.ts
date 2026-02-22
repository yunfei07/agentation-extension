import type { Annotation } from "agentation";

import {
  RUNTIME_CONFIG,
  type RuntimeConfig,
} from "../shared/runtime-config";

export type GenerationRequestPayload = {
  page_url: string;
  output_markdown: string;
  annotations: Annotation[];
  generation_options: {
    style: "pytest_sync";
    include_comments: boolean;
    timeout_ms?: number;
  };
  model: string;
  temperature: number;
  case_id?: string;
  change_note?: string;
};

export type GenerationInput = {
  pageUrl: string;
  markdown: string;
  annotations: Annotation[];
  caseId?: string;
};

export type AssetMetadata = {
  caseId: string;
  versionId: string;
  versionNo: number;
};

export type GenerationResult = {
  script: string;
  testName: string;
  metadata: {
    model: string;
    warnings: string[];
    tokenUsage?: Record<string, unknown>;
    asset?: AssetMetadata;
  };
};

const DEFAULT_GENERATION_TIMEOUT_MS = 300_000;
const GENERATION_TIMEOUT_GRACE_MS = 10_000;
const CASE_CREATE_TIMEOUT_MS = 30_000;
const CASE_STORAGE_PREFIX = "flowmarker.case.";

function normalizeBackendUrl(url: string): string {
  return url.replace(/\/$/, "");
}

function getDomain(pageUrl: string): string | undefined {
  try {
    return new URL(pageUrl).hostname;
  } catch {
    return undefined;
  }
}

function getCaseStorageKey(pageUrl: string): string | undefined {
  const domain = getDomain(pageUrl);
  if (!domain) return undefined;
  return `${CASE_STORAGE_PREFIX}${domain}`;
}

function getStoredCaseId(pageUrl: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  const storageKey = getCaseStorageKey(pageUrl);
  if (!storageKey) return undefined;
  const value = localStorage.getItem(storageKey);
  if (!value) return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function rememberCaseId(pageUrl: string, caseId: string): void {
  if (typeof window === "undefined") return;
  const storageKey = getCaseStorageKey(pageUrl);
  if (!storageKey) return;
  localStorage.setItem(storageKey, caseId);
}

function inferCaseModule(pageUrl: string): string | undefined {
  try {
    const url = new URL(pageUrl);
    const firstSegment = url.pathname
      .split("/")
      .map((item) => item.trim())
      .filter(Boolean)[0];
    return firstSegment || undefined;
  } catch {
    return undefined;
  }
}

function buildDefaultCaseName(pageUrl: string): string {
  const domain = getDomain(pageUrl);
  if (domain) {
    return `FlowMarker ${domain} smoke`;
  }
  return "FlowMarker generated case";
}

export function buildGenerationRequestPayload(
  input: GenerationInput,
  runtimeConfig: RuntimeConfig = RUNTIME_CONFIG,
  caseId?: string,
): GenerationRequestPayload {
  const backendTimeoutMs =
    runtimeConfig.generationTimeoutMs > 0
      ? runtimeConfig.generationTimeoutMs
      : DEFAULT_GENERATION_TIMEOUT_MS;

  const payload: GenerationRequestPayload = {
    page_url: input.pageUrl,
    output_markdown: input.markdown,
    annotations: input.annotations,
    generation_options: {
      style: "pytest_sync",
      include_comments: true,
      timeout_ms: backendTimeoutMs,
    },
    model: runtimeConfig.model,
    temperature: runtimeConfig.temperature,
  };

  if (caseId) {
    payload.case_id = caseId;
  }

  return payload;
}

export function extractScriptFromResponse(scriptText: string): string {
  const match = scriptText.match(/```(?:python)?\s*([\s\S]*?)```/i);
  if (!match) {
    return scriptText.trim();
  }

  return match[1].trim();
}

function resolveTestName(script: string, rawTestName?: string): string {
  if (rawTestName && rawTestName.length > 0) {
    return rawTestName;
  }

  const match = script.match(/def\s+(test_[A-Za-z0-9_]+)\s*\(/);
  return match?.[1] ?? "test_generated";
}

async function ensureCaseId(
  input: GenerationInput,
  runtimeConfig: RuntimeConfig,
): Promise<string | undefined> {
  if (input.caseId) {
    rememberCaseId(input.pageUrl, input.caseId);
    return input.caseId;
  }

  const storedCaseId = getStoredCaseId(input.pageUrl);
  if (storedCaseId) {
    return storedCaseId;
  }

  if (input.annotations.length === 0) {
    return undefined;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CASE_CREATE_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${normalizeBackendUrl(runtimeConfig.backendUrl)}/api/v1/assets/cases`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: buildDefaultCaseName(input.pageUrl),
          module: inferCaseModule(input.pageUrl),
          source_domain: getDomain(input.pageUrl),
          status: "active",
          annotations: input.annotations,
          output_markdown: input.markdown,
          model: runtimeConfig.model,
          temperature: runtimeConfig.temperature,
        }),
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      return undefined;
    }

    const payload = (await response.json()) as {
      case?: { id?: string };
    };
    const caseId = payload.case?.id?.trim();
    if (!caseId) {
      return undefined;
    }

    rememberCaseId(input.pageUrl, caseId);
    return caseId;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generatePlaywrightScript(
  input: GenerationInput,
  runtimeConfig: RuntimeConfig = RUNTIME_CONFIG,
): Promise<GenerationResult> {
  const caseId = await ensureCaseId(input, runtimeConfig);
  const payload = buildGenerationRequestPayload(input, runtimeConfig, caseId);
  const controller = new AbortController();
  const requestTimeoutMs =
    (payload.generation_options.timeout_ms ?? DEFAULT_GENERATION_TIMEOUT_MS) +
    GENERATION_TIMEOUT_GRACE_MS;
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);

  let response: Response;
  try {
    response = await fetch(
      `${normalizeBackendUrl(runtimeConfig.backendUrl)}/api/v1/scripts/playwright-python`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Generation request timed out after ${requestTimeoutMs}ms`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Generation request failed (${response.status})`);
  }

  const body = (await response.json()) as {
    script: string;
    test_name?: string;
    metadata?: {
      model?: string;
      warnings?: string[];
      token_usage?: Record<string, unknown>;
      asset?: {
        case_id?: string;
        version_id?: string;
        version_no?: number;
      };
    };
  };

  const script = extractScriptFromResponse(body.script);
  const asset =
    body.metadata?.asset?.case_id &&
    body.metadata?.asset?.version_id &&
    typeof body.metadata?.asset?.version_no === "number"
      ? {
          caseId: body.metadata.asset.case_id,
          versionId: body.metadata.asset.version_id,
          versionNo: body.metadata.asset.version_no,
        }
      : undefined;

  if (asset?.caseId) {
    rememberCaseId(input.pageUrl, asset.caseId);
  }

  return {
    script,
    testName: resolveTestName(script, body.test_name),
    metadata: {
      model: body.metadata?.model ?? runtimeConfig.model,
      warnings: body.metadata?.warnings ?? [],
      tokenUsage: body.metadata?.token_usage,
      asset,
    },
  };
}
