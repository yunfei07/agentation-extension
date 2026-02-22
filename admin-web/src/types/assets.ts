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

export type CreateRunResponse = {
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
    asset?: {
      case_id: string;
      version_id: string;
      version_no: number;
    };
  };
};

export type CaseListFilters = {
  module?: string;
  status?: string;
  sourceDomain?: string;
  tag?: string;
};
