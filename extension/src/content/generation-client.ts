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
    timeout_ms: number;
  };
  model: string;
  temperature: number;
};

export type GenerationInput = {
  pageUrl: string;
  markdown: string;
  annotations: Annotation[];
};

export type GenerationResult = {
  script: string;
  testName: string;
  metadata: {
    model: string;
    warnings: string[];
    tokenUsage?: Record<string, unknown>;
  };
};

const BACKEND_GENERATION_TIMEOUT_MS = 120_000;
const GENERATION_TIMEOUT_MS = 130_000;

function normalizeBackendUrl(url: string): string {
  return url.replace(/\/$/, "");
}

export function buildGenerationRequestPayload(
  input: GenerationInput,
  runtimeConfig: RuntimeConfig = RUNTIME_CONFIG,
): GenerationRequestPayload {
  return {
    page_url: input.pageUrl,
    output_markdown: input.markdown,
    annotations: input.annotations,
    generation_options: {
      style: "pytest_sync",
      include_comments: true,
      timeout_ms: BACKEND_GENERATION_TIMEOUT_MS,
    },
    model: runtimeConfig.model,
    temperature: runtimeConfig.temperature,
  };
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

export async function generatePlaywrightScript(
  input: GenerationInput,
  runtimeConfig: RuntimeConfig = RUNTIME_CONFIG,
): Promise<GenerationResult> {
  const payload = buildGenerationRequestPayload(input, runtimeConfig);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);

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
        `Generation request timed out after ${GENERATION_TIMEOUT_MS}ms`,
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
    };
  };

  const script = extractScriptFromResponse(body.script);

  return {
    script,
    testName: resolveTestName(script, body.test_name),
    metadata: {
      model: body.metadata?.model ?? runtimeConfig.model,
      warnings: body.metadata?.warnings ?? [],
      tokenUsage: body.metadata?.token_usage,
    },
  };
}
