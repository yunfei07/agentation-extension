from __future__ import annotations

import asyncio

from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    GenerateScriptRequest,
    GenerateScriptResponse,
    ResponseMetadata,
)
from app.services.llm_client import OpenAICompatibleLLMClient
from app.services.prompt_builder import build_generation_messages
from app.services.script_validator import (
    ScriptValidationError,
    extract_test_name,
    validate_and_extract_script,
)

router = APIRouter()
llm_client = OpenAICompatibleLLMClient.from_env()


def resolve_generation_timeout_seconds(request: GenerateScriptRequest) -> float:
    timeout_ms = request.generation_options.timeout_ms
    if timeout_ms is not None:
        if timeout_ms <= 0:
            raise HTTPException(status_code=422, detail="timeout_ms must be > 0")
        return timeout_ms / 1000

    timeout_seconds = getattr(llm_client, "timeout_seconds", 60.0)
    return max(float(timeout_seconds), 0.1)


@router.post("/scripts/playwright-python", response_model=GenerateScriptResponse)
async def generate_playwright_python_script(
    request: GenerateScriptRequest,
) -> GenerateScriptResponse:
    if request.generation_options.style != "pytest_sync":
        raise HTTPException(status_code=422, detail="Only pytest_sync style is supported")

    messages = build_generation_messages(
        page_url=str(request.page_url),
        output_markdown=request.output_markdown,
        annotations=[a.model_dump() for a in request.annotations],
    )
    timeout_seconds = resolve_generation_timeout_seconds(request)

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
        raise HTTPException(
            status_code=504,
            detail=f"LLM generation timed out after {int(timeout_seconds * 1000)}ms",
        ) from error
    except ScriptValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:  # pragma: no cover - external transport errors
        raise HTTPException(status_code=502, detail=f"LLM generation failed: {error}") from error

    return GenerateScriptResponse(
        script=script,
        test_name=test_name,
        metadata=ResponseMetadata(
            model=model_name,
            warnings=[],
            token_usage=token_usage,
        ),
    )
