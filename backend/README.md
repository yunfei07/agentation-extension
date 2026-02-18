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

### Environment variables

- `LLM_BASE_URL` (default: `https://api.openai.com/v1`)
- `LLM_API_KEY` (optional if your gateway does not require it)
- `DASHSCOPE_API_KEY` (fallback when `LLM_API_KEY` is absent)
- `LLM_MODEL` (default: `gpt-4.1-mini`)
- `LLM_TIMEOUT` (seconds, default: `60`)
- `AGENTATION_ENV_FILE` (optional custom `.env` path)
- `EXTENSION_BACKEND_URL` (optional, used by extension build; default: `http://localhost:8000`)
- `EXTENSION_MODEL` (optional, used by extension build; fallback: `LLM_MODEL`)
- `EXTENSION_TEMPERATURE` (optional, used by extension build; fallback: `LLM_TEMPERATURE` or `0.2`)
- `EXTENSION_MCP_ENDPOINT` (optional, used by extension build; default: `http://localhost:4747`)

The backend auto-loads `backend/.env` on startup and `.env` values take priority over same-name shell environment variables.

Generation requests use the OpenAI SDK `client.responses.create(...)` flow.
