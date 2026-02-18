from pathlib import Path

from app.services.llm_client import OpenAICompatibleLLMClient


def test_from_env_loads_llm_settings_from_env_file(monkeypatch, tmp_path: Path):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "\n".join(
            [
                "LLM_BASE_URL=https://example-gateway.test/v1",
                "LLM_API_KEY=test-key-from-dotenv",
                "LLM_MODEL=gpt-4.1",
                "LLM_TIMEOUT=12",
            ]
        ),
        encoding="utf-8",
    )

    for key in ["LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL", "LLM_TIMEOUT"]:
        monkeypatch.delenv(key, raising=False)

    monkeypatch.setenv("AGENTATION_ENV_FILE", str(env_file))

    client = OpenAICompatibleLLMClient.from_env()

    assert client._config.base_url == "https://example-gateway.test/v1"
    assert client._config.api_key == "test-key-from-dotenv"
    assert client._config.model == "gpt-4.1"
    assert client._config.timeout_seconds == 12.0


def test_from_env_prioritizes_dotenv_values_over_existing_env_vars(
    monkeypatch, tmp_path: Path
):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "\n".join(
            [
                "LLM_BASE_URL=https://dotenv-priority.example/v1",
                "LLM_API_KEY=dotenv-priority-key",
                "LLM_MODEL=dotenv-priority-model",
                "LLM_TIMEOUT=34",
            ]
        ),
        encoding="utf-8",
    )

    monkeypatch.setenv("AGENTATION_ENV_FILE", str(env_file))
    monkeypatch.setenv("LLM_BASE_URL", "https://env-override.example/v1")
    monkeypatch.setenv("LLM_API_KEY", "env-override-key")
    monkeypatch.setenv("LLM_MODEL", "env-override-model")
    monkeypatch.setenv("LLM_TIMEOUT", "99")

    client = OpenAICompatibleLLMClient.from_env()

    assert client._config.base_url == "https://dotenv-priority.example/v1"
    assert client._config.api_key == "dotenv-priority-key"
    assert client._config.model == "dotenv-priority-model"
    assert client._config.timeout_seconds == 34.0


def test_from_env_supports_dashscope_api_key_fallback(monkeypatch, tmp_path: Path):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "\n".join(
            [
                "LLM_BASE_URL=https://dashscope.aliyuncs.com/api/v2/apps/protocols/compatible-mode/v1",
                "DASHSCOPE_API_KEY=dashscope-key-from-dotenv",
                "LLM_MODEL=qwen3.5-plus",
                "LLM_TIMEOUT=60",
            ]
        ),
        encoding="utf-8",
    )

    monkeypatch.setenv("AGENTATION_ENV_FILE", str(env_file))
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    monkeypatch.delenv("DASHSCOPE_API_KEY", raising=False)

    client = OpenAICompatibleLLMClient.from_env()

    assert (
        client._config.base_url
        == "https://dashscope.aliyuncs.com/api/v2/apps/protocols/compatible-mode/v1"
    )
    assert client._config.api_key == "dashscope-key-from-dotenv"
    assert client._config.model == "qwen3.5-plus"
