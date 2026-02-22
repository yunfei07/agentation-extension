<img src="./package/logo.svg" alt="Agentation" width="50" />

[![npm version](https://img.shields.io/npm/v/agentation)](https://www.npmjs.com/package/agentation)
[![downloads](https://img.shields.io/npm/dm/agentation)](https://www.npmjs.com/package/agentation)

**[Agentation](https://agentation.dev)** is an agent-agnostic visual feedback tool. Click elements on your page, add notes, and copy structured output that helps AI coding agents find the exact code you're referring to.

## Install

```bash
npm install agentation -D
```

## Usage

```tsx
import { Agentation } from 'agentation';

function App() {
  return (
    <>
      <YourApp />
      <Agentation />
    </>
  );
}
```

The toolbar appears in the bottom-right corner. Click to activate, then click any element to annotate it.

## Monorepo Packages

- `package/`: publishable `agentation` React package
- `mcp/`: Node-based annotation sync + MCP server
- `extension/`: Chrome extension that embeds Agentation and adds Playwright (Python) generation UI
- `backend/`: FastAPI service that calls an LLM (OpenAI-compatible API) to generate scripts

## Browser Extension

Build extension assets:

```bash
pnpm extension:build
```

The extension reads runtime config from `backend/.env` during build.
Config keys:

- `EXTENSION_BACKEND_URL` (default: `http://localhost:8000`)
- `EXTENSION_MODEL` (fallback: `LLM_MODEL`, default: `qwen3.5-plus`)
- `EXTENSION_TEMPERATURE` (fallback: `LLM_TEMPERATURE`, default: `0.2`)
- `EXTENSION_MCP_ENDPOINT` (default: `http://localhost:4747`)
- `EXTENSION_GENERATION_TIMEOUT_MS` (default: `300000`)

Load `extension/dist` as an unpacked extension in Chrome.

## One-Command Local Stack

From repo root:

```bash
make backend-setup
make stack-up
```

`make stack-up` does three things:

- builds the extension bundle
- starts MCP (`http://localhost:4747`)
- starts FastAPI (`http://localhost:8000`)

You can also use npm scripts:

```bash
pnpm backend:setup
pnpm stack:up
```

## FastAPI Script Backend

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The extension calls `POST /api/v1/scripts/playwright-python` to request Playwright (Python) tests.
Use Python 3.12 or 3.13 for backend dependency compatibility.

Asset APIs are also available:

- `GET /api/v1/assets/cases`
- `POST /api/v1/assets/cases`
- `GET /api/v1/assets/cases/{case_id}`
- `POST /api/v1/assets/cases/{case_id}/generate`
- `POST /api/v1/assets/runs`
- `GET /api/v1/assets/runs/{run_id}`

When generation includes a `case_id`, backend appends trace headers (`fm_case_id`, `fm_version`, `fm_generated_at`, `fm_model`) to script output and returns linked `metadata.asset`.

## Features

- **Click to annotate** - Click any element with automatic selector identification
- **Toolbar toggle by domain** - Click the browser extension icon to switch Agentation on/off for the current domain (all open tabs on that domain sync to the same state)
- **Text selection** - Select text to annotate specific content
- **Multi-select** - Drag to select multiple elements at once
- **Area selection** - Drag to annotate any region, even empty space
- **Animation pause** - Freeze all animations (CSS, JS, videos) to capture specific states
- **Structured output** - Copy markdown with selectors, positions, and context
- **Persistent annotations** - Annotation data is saved locally and remains until you clear it
- **Dark/light mode** - Matches your preference or set manually
- **Zero dependencies** - Pure CSS animations, no runtime libraries

## How it works

Agentation captures class names, selectors, and element positions so AI agents can `grep` for the exact code you're referring to. Instead of describing "the blue button in the sidebar," you give the agent `.sidebar > button.primary` and your feedback.

## Requirements

- React 18+

## 插件构建方式

```bash
pnpm extension:build
```

## 插件使用方式

1. 打开 Chrome 扩展程序页面（chrome://extensions/）。
2. 打开右上角的“开发者模式”开关。
3. 点击“加载已解压的扩展程序”，选择 `extension/dist` 目录。

## 服务端启动方式

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --log-level debug
```
