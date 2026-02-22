from __future__ import annotations

from pathlib import Path
import asyncio

from fastapi.testclient import TestClient

from app.main import app
from app.services.asset_store import AssetStore


class FakeLLMClient:
    async def generate_script(self, messages, model, temperature):
        return (
            "from playwright.sync_api import Page\\n\\n"
            "def test_assets_flow(page: Page):\\n"
            "    assert page is not None"
        )


class SlowLLMClient:
    timeout_seconds = 1.0

    async def generate_script(self, messages, model, temperature):
        await asyncio.sleep(0.05)
        return (
            "from playwright.sync_api import Page\\n\\n"
            "def test_assets_timeout(page: Page):\\n"
            "    assert page is not None"
        )


def build_annotation(idx: int = 1) -> dict:
    return {
        "id": f"a{idx}",
        "element": "Button",
        "elementPath": "body > button",
        "comment": f"check button {idx}",
        "x": 10,
        "y": 20,
        "timestamp": idx,
    }


def test_assets_case_crud_and_runs(monkeypatch, tmp_path: Path):
    from app.api.v1 import assets

    store = AssetStore(tmp_path / "assets.db")
    monkeypatch.setattr(assets, "asset_store", store)

    client = TestClient(app)

    created = client.post(
        "/api/v1/assets/cases",
        json={
            "name": "Checkout smoke",
            "module": "checkout",
            "tags": ["smoke", "critical"],
            "status": "active",
            "source_domain": "example.com",
            "annotations": [build_annotation(1)],
            "output_markdown": "## Page Feedback",
        },
    )

    assert created.status_code == 200
    created_body = created.json()
    case_id = created_body["case"]["id"]
    version_id = created_body["version"]["id"]
    assert created_body["version"]["version_no"] == 1

    listed = client.get("/api/v1/assets/cases")
    assert listed.status_code == 200
    list_body = listed.json()
    assert any(case["id"] == case_id for case in list_body)

    detailed = client.get(f"/api/v1/assets/cases/{case_id}")
    assert detailed.status_code == 200
    detail_body = detailed.json()
    assert detail_body["case"]["name"] == "Checkout smoke"
    assert len(detail_body["versions"]) == 1

    run = client.post(
        "/api/v1/assets/runs",
        json={
            "case_version_id": version_id,
            "trigger": "manual",
            "status": "passed",
            "duration_ms": 1200,
            "result_summary": {"passed": 1, "failed": 0},
        },
    )
    assert run.status_code == 200
    run_body = run.json()
    assert run_body["run"]["status"] == "passed"


def test_generate_from_case_creates_new_version_with_trace_header(monkeypatch, tmp_path: Path):
    from app.api.v1 import assets

    store = AssetStore(tmp_path / "assets.db")
    monkeypatch.setattr(assets, "asset_store", store)
    monkeypatch.setattr(assets, "llm_client", FakeLLMClient())

    client = TestClient(app)

    created = client.post(
        "/api/v1/assets/cases",
        json={
            "name": "Profile update",
            "annotations": [build_annotation(1)],
            "output_markdown": "## Initial",
        },
    )
    assert created.status_code == 200
    case_id = created.json()["case"]["id"]

    generated = client.post(
        f"/api/v1/assets/cases/{case_id}/generate",
        json={
            "page_url": "https://example.com/profile",
            "output_markdown": "## Playwright context",
            "generation_options": {"style": "pytest_sync", "include_comments": True},
        },
    )

    assert generated.status_code == 200
    generated_body = generated.json()
    assert generated_body["metadata"]["asset"]["case_id"] == case_id
    assert generated_body["metadata"]["asset"]["version_no"] == 2
    assert "# fm_case_id:" in generated_body["script"]
    assert "# fm_version:" in generated_body["script"]

    detail = client.get(f"/api/v1/assets/cases/{case_id}")
    assert detail.status_code == 200
    detail_body = detail.json()
    assert len(detail_body["versions"]) == 2


def test_assets_generate_uses_extension_timeout_override_for_legacy_client(
    monkeypatch, tmp_path: Path
):
    from app.api.v1 import assets

    store = AssetStore(tmp_path / "assets.db")
    monkeypatch.setattr(assets, "asset_store", store)
    monkeypatch.setattr(assets, "llm_client", SlowLLMClient())
    monkeypatch.setenv("EXTENSION_GENERATION_TIMEOUT_MS", "10")

    client = TestClient(app)

    created = client.post(
        "/api/v1/assets/cases",
        json={
            "name": "Timeout override",
            "annotations": [build_annotation(1)],
            "output_markdown": "## Initial",
        },
    )
    assert created.status_code == 200
    case_id = created.json()["case"]["id"]

    response = client.post(
        f"/api/v1/assets/cases/{case_id}/generate",
        json={
            "page_url": "https://example.com/profile",
            "output_markdown": "## Playwright context",
            "generation_options": {
                "style": "pytest_sync",
                "include_comments": True,
                "timeout_ms": 120000,
            },
        },
    )

    assert response.status_code == 504
    assert "10ms" in response.json()["detail"]
