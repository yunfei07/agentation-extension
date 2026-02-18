from __future__ import annotations

import json
from typing import Any

SYSTEM_PROMPT = """You are a senior QA automation engineer.
Generate only runnable Python code for Playwright using pytest and playwright.sync_api.
Hard requirements:
- Return one complete test module.
- Include imports and at least one test function named test_... .
- Use selectors and text from annotations when available.
- Include meaningful assertions.
- No pseudocode, no TODO placeholders.
- If context is insufficient, still return a best-effort executable test.
"""


def build_generation_messages(
    page_url: str,
    output_markdown: str,
    annotations: list[dict[str, Any]],
) -> list[dict[str, str]]:
    user_payload = {
        "page_url": page_url,
        "output_markdown": output_markdown,
        "annotations": annotations,
        "target_style": "pytest_sync",
        "python_api": "playwright.sync_api",
    }

    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": "Generate a Playwright test module from this context:\n"
            + json.dumps(user_payload, ensure_ascii=True, indent=2),
        },
    ]
