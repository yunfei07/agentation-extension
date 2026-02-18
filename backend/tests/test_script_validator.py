import pytest

from app.services.script_validator import ScriptValidationError, validate_and_extract_script


def test_validate_and_extract_script_accepts_plain_script():
    script = "from playwright.sync_api import Page\\n\\ndef test_home(page: Page):\\n    assert True"

    value = validate_and_extract_script(script)

    assert value.startswith("from playwright.sync_api")


def test_validate_and_extract_script_unwraps_fenced_block():
    value = validate_and_extract_script("```python\\nfrom playwright.sync_api import Page\\n\\ndef test_x(page: Page):\\n    pass\\n```")

    assert "def test_x" in value


def test_validate_and_extract_script_rejects_invalid_payload():
    with pytest.raises(ScriptValidationError):
        validate_and_extract_script("print('hello')")
