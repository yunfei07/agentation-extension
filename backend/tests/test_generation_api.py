import asyncio

from fastapi.testclient import TestClient

from app.main import app
from app.services.asset_store import AssetStore


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


def test_generate_script_endpoint_uses_extension_timeout_override_for_legacy_client(
    monkeypatch,
):
    from app.api.v1 import generation

    monkeypatch.setattr(generation, "llm_client", SlowFakeClient())
    monkeypatch.setenv("EXTENSION_GENERATION_TIMEOUT_MS", "10")

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
                "timeout_ms": 120000,
            },
            "model": "gpt-4.1-mini",
            "temperature": 0.1,
        },
    )

    assert response.status_code == 504
    assert "10ms" in response.json()["detail"]


def test_generate_script_endpoint_with_case_id_tracks_asset_metadata(
    monkeypatch, tmp_path
):
    from app.api.v1 import generation

    store = AssetStore(tmp_path / "assets.db")
    case, _ = store.create_case(
        name="checkout case",
        annotations=[
            {
                "id": "seed-1",
                "element": "Button",
                "elementPath": "body > button",
                "comment": "click checkout",
                "x": 1,
                "y": 2,
                "timestamp": 1,
            }
        ],
        prompt_snapshot="## initial",
    )
    monkeypatch.setattr(generation, "asset_store", store, raising=False)
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
            "case_id": case["id"],
            "change_note": "add checkout coverage",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["metadata"]["asset"]["case_id"] == case["id"]
    assert payload["metadata"]["asset"]["version_no"] == 2
    assert "# fm_case_id:" in payload["script"]
    assert "# fm_version:" in payload["script"]
