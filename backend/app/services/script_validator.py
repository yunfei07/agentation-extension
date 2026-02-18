from __future__ import annotations

import re


class ScriptValidationError(ValueError):
    pass


CODE_BLOCK_RE = re.compile(r"```(?:python)?\s*(.*?)```", re.DOTALL | re.IGNORECASE)


def _unwrap_code_fence(script_text: str) -> str:
    match = CODE_BLOCK_RE.search(script_text)
    if match:
        return match.group(1).strip()
    return script_text.strip()


def _extract_test_name(script: str) -> str:
    match = re.search(r"def\s+(test_[A-Za-z0-9_]+)\s*\(", script)
    if not match:
        raise ScriptValidationError("LLM response does not include a pytest test function")
    return match.group(1)


def validate_and_extract_script(script_text: str) -> str:
    script = _unwrap_code_fence(script_text)

    if "playwright.sync_api" not in script:
        raise ScriptValidationError("Script must import playwright.sync_api")

    _extract_test_name(script)
    return script


def extract_test_name(script_text: str) -> str:
    script = _unwrap_code_fence(script_text)
    return _extract_test_name(script)
