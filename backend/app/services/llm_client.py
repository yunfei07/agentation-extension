from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass
import json
from typing import Any

from app.config import load_env_file

try:
    from openai import OpenAI
except ModuleNotFoundError:  # pragma: no cover - exercised only in missing-dep envs
    OpenAI = None  # type: ignore[assignment]


@dataclass
class LLMConfig:
    base_url: str
    api_key: str
    model: str
    timeout_seconds: float = 60.0


class OpenAICompatibleLLMClient:
    def __init__(self, config: LLMConfig) -> None:
        self._config = config
        self._client = None

    @property
    def timeout_seconds(self) -> float:
        return self._config.timeout_seconds

    @classmethod
    def from_env(cls) -> "OpenAICompatibleLLMClient":
        load_env_file(override_existing=True)
        base_url = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/")
        api_key = os.getenv("LLM_API_KEY") or os.getenv("DASHSCOPE_API_KEY", "")
        model = os.getenv("LLM_MODEL", "gpt-4.1-mini")
        timeout_seconds = float(os.getenv("LLM_TIMEOUT", "60"))

        return cls(
            LLMConfig(
                base_url=base_url,
                api_key=api_key,
                model=model,
                timeout_seconds=timeout_seconds,
            )
        )

    async def generate_script(
        self,
        messages: list[dict[str, str]],
        model: str | None,
        temperature: float | None,
    ) -> tuple[str, dict[str, Any] | None, str]:
        resolved_model = model or self._config.model
        input_text = self._build_responses_input(messages)
        request_temperature = 0.2 if temperature is None else temperature
        client = self._get_client()

        response = await asyncio.to_thread(
            client.responses.create,
            model=resolved_model,
            input=input_text,
            temperature=request_temperature,
        )

        content = self._extract_responses_content(response)
        usage = self._extract_usage(response)
        model_name = getattr(response, "model", None) or resolved_model
        return content, usage, model_name

    def _get_client(self):
        if self._client is not None:
            return self._client

        if OpenAI is None:
            raise RuntimeError(
                "openai package is required. Install backend dependencies with "
                "'pip install -r requirements.txt'."
            )

        self._client = OpenAI(
            api_key=self._config.api_key or None,
            base_url=self._config.base_url,
            timeout=self._config.timeout_seconds,
        )
        return self._client

    @staticmethod
    def _build_responses_input(messages: list[dict[str, str]]) -> str:
        if not messages:
            return ""
        chunks: list[str] = []
        for message in messages:
            role = str(message.get("role", "user")).strip() or "user"
            content = str(message.get("content", "")).strip()
            if not content:
                continue
            chunks.append(f"[{role}]\n{content}")
        return "\n\n".join(chunks).strip()

    @staticmethod
    def _extract_usage(response: Any) -> dict[str, Any] | None:
        if isinstance(response, dict):
            usage_dict = response.get("usage") or response.get("token_usage")
            return usage_dict if isinstance(usage_dict, dict) else None

        usage = getattr(response, "usage", None)
        if usage is None:
            return None
        if isinstance(usage, dict):
            return usage
        if hasattr(usage, "model_dump"):
            dumped = usage.model_dump()
            return dumped if isinstance(dumped, dict) else None
        if hasattr(usage, "__dict__"):
            return dict(usage.__dict__)
        return None

    @staticmethod
    def _normalize_text(value: Any) -> str | None:
        if isinstance(value, str):
            normalized = value.strip()
            return normalized or None
        if value is None:
            return None
        if hasattr(value, "model_dump"):
            return OpenAICompatibleLLMClient._normalize_text(value.model_dump())
        if hasattr(value, "__dict__"):
            return OpenAICompatibleLLMClient._normalize_text(value.__dict__)
        if isinstance(value, dict):
            for key in ("text", "value", "content", "refusal", "summary", "message"):
                nested = OpenAICompatibleLLMClient._normalize_text(value.get(key))
                if nested:
                    return nested
            return None
        if isinstance(value, list):
            parts = []
            for item in value:
                text = OpenAICompatibleLLMClient._normalize_text(item)
                if text:
                    parts.append(text)
            if parts:
                return "\n".join(parts).strip()
            return None
        return None

    @staticmethod
    def _extract_responses_content(response: Any) -> str:
        output_text = OpenAICompatibleLLMClient._normalize_text(
            getattr(response, "output_text", None)
        )
        if output_text:
            return output_text

        output_items = OpenAICompatibleLLMClient._normalize_text(
            getattr(response, "output", None)
        )
        if output_items:
            return output_items

        data = (
            response.model_dump()
            if hasattr(response, "model_dump")
            else response
            if isinstance(response, dict)
            else None
        )
        if not isinstance(data, dict):
            raise ValueError("LLM response missing output text")

        output_items_raw = data.get("output") or []
        texts: list[str] = []
        for item in output_items_raw:
            if not isinstance(item, dict):
                continue
            item_text = OpenAICompatibleLLMClient._normalize_text(item.get("text"))
            if item_text:
                texts.append(item_text)
            for content in item.get("content") or []:
                text = OpenAICompatibleLLMClient._normalize_text(content)
                if text:
                    texts.append(text)

        if texts:
            return "\n".join(texts).strip()

        preview = OpenAICompatibleLLMClient._response_preview(data)
        raise ValueError(f"LLM response missing output text. response_preview={preview}")

    @staticmethod
    def _response_preview(data: dict[str, Any] | None) -> str:
        if data is None:
            return "<non-dict response>"
        try:
            raw = json.dumps(data, ensure_ascii=True)
        except Exception:
            return "<unserializable response>"
        if len(raw) > 600:
            return raw[:600] + "...(truncated)"
        return raw
