import asyncio

from fastapi.testclient import TestClient

from app.main import app


class FakeClient:
    async def generate_script(self, messages, model, temperature):
        return "from playwright.sync_api import Page\\n\\ndef test_checkout(page: Page):\\n    assert page is not None"


class SlowFakeClient:
    timeout_seconds = 1.0

    async def generate_script(self, messages, model, temperature):
        await asyncio.sleep(0.05)
        return "from playwright.sync_api import Page\\n\\ndef test_timeout(page: Page):\\n    assert page is not None"


def test_generate_script_endpoint(monkeypatch):
    from app.api.v1 import generation

    monkeypatch.setattr(generation, "llm_client", FakeClient())

    client = TestClient(app)

    response = client.post(
        "/api/v1/scripts/playwright-python",
        json={
            "page_url": "https://example.com/checkout",
            "output_markdown": "## Page Feedback",
            "annotations": [
                {
                    "id": "a1",
                    "element": "Button",
                    "elementPath": "body > button",
                    "comment": "primary action should be visible",
                    "x": 10,
                    "y": 20,
                    "timestamp": 1,
                }
            ],
            "generation_options": {"style": "pytest_sync", "include_comments": True},
            "model": "gpt-4.1-mini",
            "temperature": 0.1,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert "def test_checkout" in data["script"]
    assert data["metadata"]["model"] == "gpt-4.1-mini"


def test_generate_script_endpoint_times_out(monkeypatch):
    from app.api.v1 import generation

    monkeypatch.setattr(generation, "llm_client", SlowFakeClient())

    client = TestClient(app)

    response = client.post(
        "/api/v1/scripts/playwright-python",
        json={
            "page_url": "https://example.com/checkout",
            "output_markdown": "## Page Feedback",
            "annotations": [],
            "generation_options": {
                "style": "pytest_sync",
                "include_comments": True,
                "timeout_ms": 10,
            },
            "model": "gpt-4.1-mini",
            "temperature": 0.1,
        },
    )

    assert response.status_code == 504
    assert "timed out" in response.json()["detail"]
