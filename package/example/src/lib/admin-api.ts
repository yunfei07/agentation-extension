export type CaseSummary = {
  id: string;
  name: string;
  module: string | null;
  tags: string[];
  status: string;
  source_domain: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  latest_version_no: number | null;
  latest_test_name: string | null;
  latest_run_status: string | null;
};

export type TestStep = {
  id: string;
  order_no: number;
  action: string | null;
  expected: string | null;
  selector_candidates: Array<Record<string, unknown>>;
  element_profile: Record<string, unknown>;
};

export type CaseVersion = {
  id: string;
  case_id: string;
  version_no: number;
  change_note: string | null;
  annotation_snapshot: Array<Record<string, unknown>>;
  prompt_snapshot: string | null;
  model: string | null;
  temperature: number | null;
  generated_script: string | null;
  script_sha256: string | null;
  test_name: string | null;
  created_at: string;
  steps: TestStep[];
};

export type CaseDetailResponse = {
  case: CaseSummary;
  versions: CaseVersion[];
};

export type AssetMetadata = {
  case_id: string;
  version_id: string;
  version_no: number;
};

export type GenerateCaseScriptRequest = {
  page_url: string;
  output_markdown: string;
  annotations?: Array<Record<string, unknown>>;
  generation_options?: {
    style?: "pytest_sync";
    include_comments?: boolean;
    timeout_ms?: number;
  };
  model?: string;
  temperature?: number;
  change_note?: string;
};

export type GenerateCaseScriptResponse = {
  script: string;
  test_name: string;
  metadata: {
    model: string;
    warnings: string[];
    token_usage?: Record<string, unknown>;
    asset?: AssetMetadata;
  };
};

const DEFAULT_BACKEND_URL = "http://localhost:8000";
const DEFAULT_TIMEOUT_MS = 20_000;

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, "");
}

export function resolveBackendBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
  if (!value) return DEFAULT_BACKEND_URL;
  return normalizeBaseUrl(value);
}

function buildUrl(path: string, params?: Record<string, string | undefined>): string {
  const baseUrl = resolveBackendBaseUrl();
  const url = new URL(`${baseUrl}${path}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (!value) continue;
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

async function requestJson<T>(
  url: string,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Request failed (${response.status})`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export type CaseListFilters = {
  module?: string;
  status?: string;
  sourceDomain?: string;
  tag?: string;
};

export async function listCases(filters: CaseListFilters = {}): Promise<CaseSummary[]> {
  return requestJson<CaseSummary[]>(
    buildUrl("/api/v1/assets/cases", {
      module: filters.module,
      status: filters.status,
      source_domain: filters.sourceDomain,
      tag: filters.tag,
    }),
  );
}

export async function getCase(caseId: string): Promise<CaseDetailResponse> {
  return requestJson<CaseDetailResponse>(
    buildUrl(`/api/v1/assets/cases/${encodeURIComponent(caseId)}`),
  );
}

export async function generateCaseScript(
  caseId: string,
  payload: GenerateCaseScriptRequest,
): Promise<GenerateCaseScriptResponse> {
  return requestJson<GenerateCaseScriptResponse>(
    buildUrl(`/api/v1/assets/cases/${encodeURIComponent(caseId)}/generate`),
    {
      method: "POST",
      body: JSON.stringify({
        page_url: payload.page_url,
        output_markdown: payload.output_markdown,
        annotations: payload.annotations,
        generation_options: {
          style: payload.generation_options?.style ?? "pytest_sync",
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

export type CreateRunRequest = {
  case_version_id: string;
  trigger?: string;
  status: string;
  started_at?: string;
  finished_at?: string;
  duration_ms?: number;
  result_summary?: Record<string, unknown>;
  report_url?: string;
};

export async function createRun(payload: CreateRunRequest): Promise<{
  run: {
    id: string;
    case_version_id: string;
    trigger: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    duration_ms: number | null;
    result_summary: Record<string, unknown>;
    report_url: string | null;
  };
}> {
  return requestJson(buildUrl("/api/v1/assets/runs"), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
