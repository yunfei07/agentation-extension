# Agentation Script Backend

FastAPI service for generating Playwright Python scripts from Agentation annotation context.

## Run

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Use Python 3.12 or 3.13 for dependency compatibility.

From repo root you can also run:

```bash
make backend-setup
make backend-run
```

## API

- `GET /healthz`
- `POST /api/v1/scripts/playwright-python`
- `GET /api/v1/assets/cases`
- `POST /api/v1/assets/cases`
- `GET /api/v1/assets/cases/{case_id}`
- `POST /api/v1/assets/cases/{case_id}/generate`
- `POST /api/v1/assets/runs`
- `GET /api/v1/assets/runs/{run_id}`

### Script generation with asset tracking

`POST /api/v1/scripts/playwright-python` now accepts optional:

- `case_id`
- `change_note`

When `case_id` is provided, backend will:

1. create a new case version,
2. inject trace headers into the generated script (`fm_case_id`, `fm_version`, `fm_generated_at`, `fm_model`),
3. return `metadata.asset` with `case_id`, `version_id`, and `version_no`.

### Environment variables

- `LLM_BASE_URL` (default: `https://api.openai.com/v1`)
- `LLM_API_KEY` (optional if your gateway does not require it)
- `DASHSCOPE_API_KEY` (fallback when `LLM_API_KEY` is absent)
- `LLM_MODEL` (default: `gpt-4.1-mini`)
- `LLM_TIMEOUT` (seconds, default: `60`)
- `FLOWMARKER_ASSETS_DB` (optional SQLite file path; default: `backend/data/assets.db`)
- `AGENTATION_ENV_FILE` (optional custom `.env` path)
- `EXTENSION_BACKEND_URL` (optional, used by extension build; default: `http://localhost:8000`)
- `EXTENSION_MODEL` (optional, used by extension build; fallback: `LLM_MODEL`)
- `EXTENSION_TEMPERATURE` (optional, used by extension build; fallback: `LLM_TEMPERATURE` or `0.2`)
- `EXTENSION_MCP_ENDPOINT` (optional, used by extension build; default: `http://localhost:4747`)
- `EXTENSION_GENERATION_TIMEOUT_MS` (optional, used by extension build; default: `300000`)

The backend auto-loads `backend/.env` on startup and `.env` values take priority over same-name shell environment variables.

Generation requests use the OpenAI SDK `client.responses.create(...)` flow.
