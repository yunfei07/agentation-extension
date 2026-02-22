import type {
  CaseDetailResponse,
  CaseListFilters,
  CaseSummary,
  CreateRunRequest,
  CreateRunResponse,
  GenerateCaseScriptRequest,
  GenerateCaseScriptResponse,
} from "@/types/assets";

const DEFAULT_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, "");
}

function buildUrl(baseUrl: string, path: string, params?: Record<string, string | undefined>) {
  const url = new URL(`${normalizeBaseUrl(baseUrl)}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
  }
  return url.toString();
}

export function resolveBackendUrl(url?: string): string {
  return normalizeBaseUrl(url?.trim() || DEFAULT_BACKEND_URL);
}

async function requestJson<T>(
  url: string,
  init?: RequestInit,
  timeoutMs = 30_000,
): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Request failed (${response.status})`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function listCases(baseUrl: string, filters: CaseListFilters = {}): Promise<CaseSummary[]> {
  return requestJson<CaseSummary[]>(
    buildUrl(baseUrl, "/api/v1/assets/cases", {
      module: filters.module,
      status: filters.status,
      source_domain: filters.sourceDomain,
      tag: filters.tag,
    }),
  );
}

export async function getCase(baseUrl: string, caseId: string): Promise<CaseDetailResponse> {
  return requestJson<CaseDetailResponse>(
    buildUrl(baseUrl, `/api/v1/assets/cases/${encodeURIComponent(caseId)}`),
  );
}

export async function generateCaseScript(
  baseUrl: string,
  caseId: string,
  payload: GenerateCaseScriptRequest,
): Promise<GenerateCaseScriptResponse> {
  return requestJson<GenerateCaseScriptResponse>(
    buildUrl(baseUrl, `/api/v1/assets/cases/${encodeURIComponent(caseId)}/generate`),
    {
      method: "POST",
      body: JSON.stringify({
        page_url: payload.page_url,
        output_markdown: payload.output_markdown,
        annotations: payload.annotations,
        generation_options: {
          style: payload.generation_options?.style || "pytest_sync",
          include_comments: payload.generation_options?.include_comments ?? true,
          timeout_ms: payload.generation_options?.timeout_ms,
        },
        model: payload.model,
        temperature: payload.temperature,
        change_note: payload.change_note,
      }),
    },
    120_000,
  );
}

export async function createRun(
  baseUrl: string,
  payload: CreateRunRequest,
): Promise<CreateRunResponse> {
  return requestJson<CreateRunResponse>(
    buildUrl(baseUrl, "/api/v1/assets/runs"),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}
