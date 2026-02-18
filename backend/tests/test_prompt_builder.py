from app.services.prompt_builder import build_generation_messages


def test_build_generation_messages_contains_contract():
    messages = build_generation_messages(
        page_url="https://example.com",
        output_markdown="## Page Feedback",
        annotations=[{"element": "Button", "comment": "Change label"}],
    )

    assert messages[0]["role"] == "system"
    assert "playwright.sync_api" in messages[0]["content"]
    assert "pytest" in messages[0]["content"]
    assert "https://example.com" in messages[1]["content"]
