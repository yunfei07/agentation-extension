from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    AssetReferenceMetadata,
    GenerateScriptRequest,
    GenerateScriptResponse,
    ResponseMetadata,
)
from app.services.asset_store import AssetNotFoundError, AssetStore
from app.services.llm_client import OpenAICompatibleLLMClient
from app.services.prompt_builder import build_generation_messages
from app.services.script_validator import (
    ScriptValidationError,
    extract_test_name,
    validate_and_extract_script,
)

router = APIRouter()
llm_client = OpenAICompatibleLLMClient.from_env()
asset_store = AssetStore.from_env()
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


def resolve_generation_timeout_seconds(request: GenerateScriptRequest) -> float:
    timeout_ms = request.generation_options.timeout_ms
    if timeout_ms is not None:
        if timeout_ms <= 0:
            raise HTTPException(status_code=422, detail="timeout_ms must be > 0")
        if timeout_ms == LEGACY_EXTENSION_TIMEOUT_MS:
            timeout_ms = _resolve_extension_timeout_override_ms()
        return timeout_ms / 1000

    timeout_seconds = getattr(llm_client, "timeout_seconds", 60.0)
    return max(float(timeout_seconds), 0.1)


@router.post("/scripts/playwright-python", response_model=GenerateScriptResponse)
async def generate_playwright_python_script(
    request: GenerateScriptRequest,
) -> GenerateScriptResponse:
    if request.generation_options.style != "pytest_sync":
        raise HTTPException(status_code=422, detail="Only pytest_sync style is supported")

    annotation_payloads = [a.model_dump() for a in request.annotations]
    messages = build_generation_messages(
        page_url=str(request.page_url),
        output_markdown=request.output_markdown,
        annotations=annotation_payloads,
    )
    timeout_seconds = resolve_generation_timeout_seconds(request)
    asset_metadata: AssetReferenceMetadata | None = None

    try:
        generation_result = await asyncio.wait_for(
            llm_client.generate_script(
                messages=messages,
                model=request.model,
                temperature=request.temperature,
            ),
            timeout=timeout_seconds,
        )

        if isinstance(generation_result, tuple):
            raw_script, token_usage, model_name = generation_result
        else:
            raw_script = generation_result
            token_usage = None
            model_name = request.model or "unknown"

        script = validate_and_extract_script(raw_script)
        test_name = extract_test_name(script)
    except TimeoutError as error:
        timeout_ms = int(timeout_seconds * 1000)
        model_name = request.model or getattr(
            getattr(llm_client, "_config", None),
            "model",
            "unknown",
        )
        raise HTTPException(
            status_code=504,
            detail=(
                f"LLM generation timed out after {timeout_ms}ms "
                f"(model={model_name}, annotations={len(annotation_payloads)})"
            ),
        ) from error
    except ScriptValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:  # pragma: no cover - external transport errors
        raise HTTPException(status_code=502, detail=f"LLM generation failed: {error}") from error

    if request.case_id:
        try:
            version = asset_store.create_case_version(
                case_id=request.case_id,
                annotations=annotation_payloads,
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
            case_id=request.case_id,
            version_no=version["version_no"],
            model=model_name,
        )
        asset_store.update_version_script(
            version_id=version["id"],
            script=traced_script,
            test_name=test_name,
        )
        script = traced_script
        asset_metadata = AssetReferenceMetadata(
            case_id=request.case_id,
            version_id=version["id"],
            version_no=version["version_no"],
        )

    return GenerateScriptResponse(
        script=script,
        test_name=test_name,
        metadata=ResponseMetadata(
            model=model_name,
            warnings=[],
            token_usage=token_usage,
            asset=asset_metadata,
        ),
    )
