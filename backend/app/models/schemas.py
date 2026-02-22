from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class AnnotationPayload(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    element: str
    elementPath: str
    comment: str
    x: float
    y: float
    timestamp: int


class GenerationOptions(BaseModel):
    style: str = "pytest_sync"
    include_comments: bool = True
    timeout_ms: int | None = None


class GenerateScriptRequest(BaseModel):
    page_url: HttpUrl
    output_markdown: str
    annotations: list[AnnotationPayload] = Field(default_factory=list)
    generation_options: GenerationOptions = Field(default_factory=GenerationOptions)
    model: str | None = None
    temperature: float | None = None
    case_id: str | None = None
    change_note: str | None = None


class AssetReferenceMetadata(BaseModel):
    case_id: str
    version_id: str
    version_no: int


class ResponseMetadata(BaseModel):
    model: str
    warnings: list[str] = Field(default_factory=list)
    token_usage: dict[str, Any] | None = None
    asset: AssetReferenceMetadata | None = None


class GenerateScriptResponse(BaseModel):
    script: str
    test_name: str
    metadata: ResponseMetadata


class CreateCaseRequest(BaseModel):
    name: str
    module: str | None = None
    tags: list[str] = Field(default_factory=list)
    status: str = "draft"
    source_domain: str | None = None
    created_by: str | None = None
    page_url: HttpUrl | None = None
    output_markdown: str | None = None
    annotations: list[AnnotationPayload] = Field(default_factory=list)
    change_note: str | None = None
    model: str | None = None
    temperature: float | None = None


class CaseSummary(BaseModel):
    id: str
    name: str
    module: str | None = None
    tags: list[str] = Field(default_factory=list)
    status: str
    source_domain: str | None = None
    created_by: str | None = None
    created_at: str
    updated_at: str
    latest_version_no: int | None = None
    latest_test_name: str | None = None
    latest_run_status: str | None = None


class TestStepModel(BaseModel):
    id: str
    order_no: int
    action: str | None = None
    expected: str | None = None
    selector_candidates: list[dict[str, Any]] = Field(default_factory=list)
    element_profile: dict[str, Any] = Field(default_factory=dict)


class CaseVersionModel(BaseModel):
    id: str
    case_id: str
    version_no: int
    change_note: str | None = None
    annotation_snapshot: list[dict[str, Any]] = Field(default_factory=list)
    prompt_snapshot: str | None = None
    model: str | None = None
    temperature: float | None = None
    generated_script: str | None = None
    script_sha256: str | None = None
    test_name: str | None = None
    created_at: str
    steps: list[TestStepModel] = Field(default_factory=list)


class CreateCaseResponse(BaseModel):
    case: CaseSummary
    version: CaseVersionModel


class CaseDetailResponse(BaseModel):
    case: CaseSummary
    versions: list[CaseVersionModel] = Field(default_factory=list)


class CaseGenerateRequest(BaseModel):
    page_url: HttpUrl
    output_markdown: str
    annotations: list[AnnotationPayload] | None = None
    generation_options: GenerationOptions = Field(default_factory=GenerationOptions)
    model: str | None = None
    temperature: float | None = None
    change_note: str | None = None


class CreateRunRequest(BaseModel):
    case_version_id: str
    trigger: str = "manual"
    status: str
    started_at: str | None = None
    finished_at: str | None = None
    duration_ms: int | None = None
    result_summary: dict[str, Any] | None = None
    report_url: HttpUrl | None = None


class TestRunModel(BaseModel):
    id: str
    case_version_id: str
    trigger: str
    status: str
    started_at: str
    finished_at: str | None = None
    duration_ms: int | None = None
    result_summary: dict[str, Any] | None = None
    report_url: str | None = None


class CreateRunResponse(BaseModel):
    run: TestRunModel
