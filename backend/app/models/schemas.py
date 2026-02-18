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


class ResponseMetadata(BaseModel):
    model: str
    warnings: list[str] = Field(default_factory=list)
    token_usage: dict[str, Any] | None = None


class GenerateScriptResponse(BaseModel):
    script: str
    test_name: str
    metadata: ResponseMetadata
