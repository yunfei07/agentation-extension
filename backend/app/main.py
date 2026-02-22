from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.assets import router as assets_router
from app.api.v1.generation import router as generation_router

app = FastAPI(title="Agentation Script Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(generation_router, prefix="/api/v1")
app.include_router(assets_router, prefix="/api/v1")
