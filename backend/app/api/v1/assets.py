from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import (
    AssetReferenceMetadata,
    CaseDetailResponse,
    CaseGenerateRequest,
    CaseSummary,
    CreateCaseRequest,
    CreateCaseResponse,
    CreateRunRequest,
    CreateRunResponse,
    GenerateScriptResponse,
    ResponseMetadata,
    TestRunModel,
)
from app.services.asset_store import (
    AssetNotFoundError,
    AssetStore,
    AssetValidationError,
)
from app.services.llm_client import OpenAICompatibleLLMClient
from app.services.prompt_builder import build_generation_messages
from app.services.script_validator import (
    ScriptValidationError,
    extract_test_name,
    validate_and_extract_script,
)

router = APIRouter()
asset_store = AssetStore.from_env()
llm_client = OpenAICompatibleLLMClient.from_env()
LEGACY_EXTENSION_TIMEOUT_MS = 120_000


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _inject_trace_headers(
    script: str,
    *,
    case_id: str,
    version_no: int,
    model: str,
) -> str:
    normalized_script = script.strip()
    trace_lines = [
        f"# fm_case_id: {case_id}",
        f"# fm_version: {version_no}",
        f"# fm_generated_at: {_iso_now()}",
        f"# fm_model: {model}",
    ]

    shebang = ""
    body = normalized_script
    if normalized_script.startswith("#!"):
        first_line, _, rest = normalized_script.partition("\n")
        shebang = first_line
        body = rest.strip()

    trace_block = "\n".join(trace_lines)
    if shebang:
        return f"{shebang}\n{trace_block}\n\n{body}\n"
    return f"{trace_block}\n\n{body}\n"


def _resolve_extension_timeout_override_ms() -> int:
    raw = os.getenv("EXTENSION_GENERATION_TIMEOUT_MS", "300000").strip()
    try:
        value = int(raw)
    except ValueError:
        return 300_000
    return value if value > 0 else 300_000


def _resolve_generation_timeout_seconds(timeout_ms: int | None) -> float:
    if timeout_ms is not None:
        if timeout_ms <= 0:
            raise HTTPException(status_code=422, detail="timeout_ms must be > 0")
        if timeout_ms == LEGACY_EXTENSION_TIMEOUT_MS:
            timeout_ms = _resolve_extension_timeout_override_ms()
        return timeout_ms / 1000

    timeout_seconds = getattr(llm_client, "timeout_seconds", 60.0)
    return max(float(timeout_seconds), 0.1)


async def _generate_script(
    *,
    page_url: str,
    output_markdown: str,
    annotations: list[dict],
    model: str | None,
    temperature: float | None,
    timeout_ms: int | None,
) -> tuple[str, str, dict | None, str]:
    messages = build_generation_messages(
        page_url=page_url,
        output_markdown=output_markdown,
        annotations=annotations,
    )
    timeout_seconds = _resolve_generation_timeout_seconds(timeout_ms)

    try:
        generation_result = await asyncio.wait_for(
            llm_client.generate_script(
                messages=messages,
                model=model,
                temperature=temperature,
            ),
            timeout=timeout_seconds,
        )

        if isinstance(generation_result, tuple):
            raw_script, token_usage, model_name = generation_result
        else:
            raw_script = generation_result
            token_usage = None
            model_name = model or "unknown"

        script = validate_and_extract_script(raw_script)
        test_name = extract_test_name(script)
        return script, test_name, token_usage, model_name
    except TimeoutError as error:
        timeout_ms = int(timeout_seconds * 1000)
        resolved_model = model or getattr(
            getattr(llm_client, "_config", None),
            "model",
            "unknown",
        )
        raise HTTPException(
            status_code=504,
            detail=(
                f"LLM generation timed out after {timeout_ms}ms "
                f"(model={resolved_model}, annotations={len(annotations)})"
            ),
        ) from error
    except ScriptValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:  # pragma: no cover - external transport errors
        raise HTTPException(status_code=502, detail=f"LLM generation failed: {error}") from error


@router.get("/assets/cases", response_model=list[CaseSummary])
async def list_cases(
    module: str | None = Query(default=None),
    status: str | None = Query(default=None),
    source_domain: str | None = Query(default=None),
    tag: str | None = Query(default=None),
) -> list[CaseSummary]:
    return asset_store.list_cases(
        module=module,
        status=status,
        source_domain=source_domain,
        tag=tag,
    )


@router.get("/assets/cases/{case_id}", response_model=CaseDetailResponse)
async def get_case(case_id: str) -> CaseDetailResponse:
    try:
        case, versions = asset_store.get_case(case_id)
    except AssetNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

    return CaseDetailResponse(case=case, versions=versions)


@router.post("/assets/cases", response_model=CreateCaseResponse)
async def create_case(request: CreateCaseRequest) -> CreateCaseResponse:
    source_domain = request.source_domain
    if not source_domain and request.page_url:
        source_domain = urlparse(str(request.page_url)).hostname

    try:
        case, version = asset_store.create_case(
            name=request.name,
            module=request.module,
            tags=request.tags,
            status=request.status,
            source_domain=source_domain,
            created_by=request.created_by,
            annotations=[annotation.model_dump() for annotation in request.annotations],
            change_note=request.change_note,
            prompt_snapshot=request.output_markdown,
            model=request.model,
            temperature=request.temperature,
        )
    except AssetValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    return CreateCaseResponse(case=case, version=version)


@router.post(
    "/assets/cases/{case_id}/generate",
    response_model=GenerateScriptResponse,
)
async def generate_case_script(
    case_id: str,
    request: CaseGenerateRequest,
) -> GenerateScriptResponse:
    if request.generation_options.style != "pytest_sync":
        raise HTTPException(status_code=422, detail="Only pytest_sync style is supported")

    try:
        annotations = (
            [annotation.model_dump() for annotation in request.annotations]
            if request.annotations is not None
            else asset_store.get_latest_annotation_snapshot(case_id)
        )
    except AssetNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

    script, test_name, token_usage, model_name = await _generate_script(
        page_url=str(request.page_url),
        output_markdown=request.output_markdown,
        annotations=annotations,
        model=request.model,
        temperature=request.temperature,
        timeout_ms=request.generation_options.timeout_ms,
    )

    try:
        version = asset_store.create_case_version(
            case_id=case_id,
            annotations=annotations,
            change_note=request.change_note,
            prompt_snapshot=request.output_markdown,
            model=model_name,
            temperature=request.temperature,
            generated_script=script,
            test_name=test_name,
        )
    except AssetNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

    traced_script = _inject_trace_headers(
        script,
        case_id=case_id,
        version_no=version["version_no"],
        model=model_name,
    )
    asset_store.update_version_script(
        version_id=version["id"],
        script=traced_script,
        test_name=test_name,
    )

    return GenerateScriptResponse(
        script=traced_script,
        test_name=test_name,
        metadata=ResponseMetadata(
            model=model_name,
            warnings=[],
            token_usage=token_usage,
            asset=AssetReferenceMetadata(
                case_id=case_id,
                version_id=version["id"],
                version_no=version["version_no"],
            ),
        ),
    )


@router.post("/assets/runs", response_model=CreateRunResponse)
async def create_run(request: CreateRunRequest) -> CreateRunResponse:
    try:
        run = asset_store.create_run(
            case_version_id=request.case_version_id,
            trigger=request.trigger,
            status=request.status,
            started_at=request.started_at,
            finished_at=request.finished_at,
            duration_ms=request.duration_ms,
            result_summary=request.result_summary,
            report_url=str(request.report_url) if request.report_url else None,
        )
    except AssetNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

    return CreateRunResponse(run=run)


@router.get("/assets/runs/{run_id}", response_model=TestRunModel)
async def get_run(run_id: str) -> TestRunModel:
    try:
        run = asset_store.get_run(run_id)
    except AssetNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

    return TestRunModel(**run)
