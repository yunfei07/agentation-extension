import asyncio
from types import SimpleNamespace

from app.services.llm_client import LLMConfig, OpenAICompatibleLLMClient


class FakeResponsesAPI:
    def __init__(self, response_obj: object):
        self._response_obj = response_obj
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return self._response_obj


class FakeOpenAI:
    instances = []
    response_obj = None

    def __init__(self, *, api_key, base_url, timeout):
        self.api_key = api_key
        self.base_url = base_url
        self.timeout = timeout
        self.responses = FakeResponsesAPI(FakeOpenAI.response_obj)
        FakeOpenAI.instances.append(self)


def test_generate_script_uses_openai_responses_api(monkeypatch):
    FakeOpenAI.instances = []
    FakeOpenAI.response_obj = SimpleNamespace(
        output_text="from playwright.sync_api import Page\n\ndef test_ok(page: Page):\n    assert True",
        usage=SimpleNamespace(model_dump=lambda: {"total_tokens": 123}),
        model="qwen3.5-plus",
    )
    monkeypatch.setattr("app.services.llm_client.OpenAI", FakeOpenAI)

    client = OpenAICompatibleLLMClient(
        LLMConfig(
            base_url="https://dashscope.aliyuncs.com/api/v2/apps/protocols/compatible-mode/v1",
            api_key="test-key",
            model="qwen3.5-plus",
            timeout_seconds=10,
        )
    )

    script, usage, model_name = asyncio.run(
        client.generate_script(
            messages=[
                {"role": "system", "content": "system prompt"},
                {"role": "user", "content": "hello"},
            ],
            model=None,
            temperature=0.1,
        )
    )

    assert "def test_ok" in script
    assert usage == {"total_tokens": 123}
    assert model_name == "qwen3.5-plus"

    assert len(FakeOpenAI.instances) == 1
    instance = FakeOpenAI.instances[0]
    assert instance.api_key == "test-key"
    assert (
        instance.base_url
        == "https://dashscope.aliyuncs.com/api/v2/apps/protocols/compatible-mode/v1"
    )
    assert instance.timeout == 10

    assert len(instance.responses.calls) == 1
    call = instance.responses.calls[0]
    assert call["model"] == "qwen3.5-plus"
    assert call["temperature"] == 0.1
    assert isinstance(call["input"], str)
    assert "[system]" in call["input"]
    assert "[user]" in call["input"]


def test_generate_script_extracts_text_from_response_output_blocks(monkeypatch):
    FakeOpenAI.instances = []
    FakeOpenAI.response_obj = {
        "output": [
            {
                "content": [
                    {
                        "text": "from playwright.sync_api import Page\n\ndef test_blocks(page: Page):\n    assert True"
                    }
                ]
            }
        ],
        "usage": {"total_tokens": 66},
        "model": "qwen-plus",
    }
    monkeypatch.setattr("app.services.llm_client.OpenAI", FakeOpenAI)

    client = OpenAICompatibleLLMClient(
        LLMConfig(
            base_url="https://api.openai.com/v1",
            api_key="test-key",
            model="qwen-plus",
            timeout_seconds=30,
        )
    )

    script, usage, model_name = asyncio.run(
        client.generate_script(
            messages=[{"role": "user", "content": "hello"}],
            model=None,
            temperature=None,
        )
    )

    assert "def test_blocks" in script
    assert usage == {"total_tokens": 66}
    assert model_name == "qwen-plus"


def test_generate_script_extracts_refusal_text_from_responses_payload(monkeypatch):
    FakeOpenAI.instances = []
    FakeOpenAI.response_obj = {
        "output": [
            {
                "type": "message",
                "content": [{"type": "refusal", "refusal": "request rejected"}],
            }
        ],
        "usage": {"total_tokens": 9},
        "model": "qwen-plus",
    }
    monkeypatch.setattr("app.services.llm_client.OpenAI", FakeOpenAI)

    client = OpenAICompatibleLLMClient(
        LLMConfig(
            base_url="https://api.openai.com/v1",
            api_key="test-key",
            model="qwen-plus",
            timeout_seconds=30,
        )
    )

    script, usage, model_name = asyncio.run(
        client.generate_script(
            messages=[{"role": "user", "content": "hello"}],
            model=None,
            temperature=None,
        )
    )

    assert script == "request rejected"
    assert usage == {"total_tokens": 9}
    assert model_name == "qwen-plus"
