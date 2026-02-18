from __future__ import annotations

import os
from pathlib import Path


def _resolve_env_path(explicit_path: str | Path | None) -> Path:
    if explicit_path:
        return Path(explicit_path).expanduser()

    env_override = os.getenv("AGENTATION_ENV_FILE")
    if env_override:
        return Path(env_override).expanduser()

    return Path(__file__).resolve().parents[2] / ".env"


def _strip_quotes(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1]
    return value


def load_env_file(path: str | Path | None = None, *, override_existing: bool = True) -> None:
    env_path = _resolve_env_path(path)
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = _strip_quotes(value.strip())

        if not key:
            continue

        if override_existing:
            os.environ[key] = value
        else:
            os.environ.setdefault(key, value)
