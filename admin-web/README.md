# FlowMarker Admin Web

Standalone React + shadcn/ui admin dashboard for FlowMarker test assets.

## Features

- Case list with filters (`module`, `status`, `tag`, `domain`, keyword)
- Case detail and version switch
- Version step/selector preview
- Generate new script version (`POST /api/v1/assets/cases/{case_id}/generate`)
- Report test runs (`POST /api/v1/assets/runs`)
- Configurable backend URL in UI and `.env`

## Quick Start

```bash
cd admin-web
cp .env.example .env
pnpm install
pnpm dev
```

Default URL: `http://localhost:3002`

## Environment

- `VITE_BACKEND_URL` (default: `http://localhost:8000`)

## Build

```bash
pnpm build
pnpm preview
```
