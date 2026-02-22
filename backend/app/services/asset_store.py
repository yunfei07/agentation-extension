from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.config import load_env_file


class AssetStoreError(Exception):
    pass


class AssetNotFoundError(AssetStoreError):
    pass


class AssetValidationError(AssetStoreError):
    pass


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def _json_loads(value: str | None, default: Any) -> Any:
    if not value:
        return default
    try:
        return json.loads(value)
    except Exception:
        return default


def _normalize_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


class AssetStore:
    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path
        self._lock = threading.Lock()
        self._initialized = False

    @classmethod
    def from_env(cls) -> "AssetStore":
        load_env_file(override_existing=True)
        configured = os.getenv("FLOWMARKER_ASSETS_DB")
        if configured:
            db_path = Path(configured).expanduser()
        else:
            db_path = Path(__file__).resolve().parents[2] / "data" / "assets.db"
        return cls(db_path)

    def init_db(self) -> None:
        with self._lock:
            if self._initialized:
                return

            self._db_path.parent.mkdir(parents=True, exist_ok=True)
            with self._connect() as conn:
                conn.executescript(
                    """
                    CREATE TABLE IF NOT EXISTS test_case_assets (
                      id TEXT PRIMARY KEY,
                      name TEXT NOT NULL,
                      module TEXT,
                      tags_json TEXT NOT NULL DEFAULT '[]',
                      status TEXT NOT NULL DEFAULT 'draft',
                      source_domain TEXT,
                      created_by TEXT,
                      created_at TEXT NOT NULL,
                      updated_at TEXT NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS test_case_versions (
                      id TEXT PRIMARY KEY,
                      case_id TEXT NOT NULL,
                      version_no INTEGER NOT NULL,
                      change_note TEXT,
                      annotation_snapshot TEXT NOT NULL,
                      prompt_snapshot TEXT,
                      model TEXT,
                      temperature REAL,
                      generated_script TEXT,
                      script_sha256 TEXT,
                      test_name TEXT,
                      created_at TEXT NOT NULL,
                      UNIQUE(case_id, version_no),
                      FOREIGN KEY(case_id) REFERENCES test_case_assets(id) ON DELETE CASCADE
                    );

                    CREATE TABLE IF NOT EXISTS test_steps (
                      id TEXT PRIMARY KEY,
                      case_version_id TEXT NOT NULL,
                      order_no INTEGER NOT NULL,
                      action TEXT,
                      expected TEXT,
                      selector_candidates_json TEXT NOT NULL DEFAULT '[]',
                      element_profile_json TEXT NOT NULL DEFAULT '{}',
                      FOREIGN KEY(case_version_id) REFERENCES test_case_versions(id) ON DELETE CASCADE
                    );

                    CREATE TABLE IF NOT EXISTS test_runs (
                      id TEXT PRIMARY KEY,
                      case_version_id TEXT NOT NULL,
                      trigger_source TEXT NOT NULL,
                      status TEXT NOT NULL,
                      started_at TEXT NOT NULL,
                      finished_at TEXT,
                      duration_ms INTEGER,
                      result_summary_json TEXT,
                      report_url TEXT,
                      FOREIGN KEY(case_version_id) REFERENCES test_case_versions(id) ON DELETE CASCADE
                    );

                    CREATE INDEX IF NOT EXISTS idx_case_versions_case_id ON test_case_versions(case_id);
                    CREATE INDEX IF NOT EXISTS idx_test_runs_version_id ON test_runs(case_version_id);
                    CREATE INDEX IF NOT EXISTS idx_test_steps_version_id ON test_steps(case_version_id);
                    """
                )

            self._initialized = True

    def list_cases(
        self,
        *,
        module: str | None = None,
        status: str | None = None,
        source_domain: str | None = None,
        tag: str | None = None,
    ) -> list[dict[str, Any]]:
        self.init_db()

        where_parts: list[str] = []
        values: list[Any] = []
        if module:
            where_parts.append("c.module = ?")
            values.append(module)
        if status:
            where_parts.append("c.status = ?")
            values.append(status)
        if source_domain:
            where_parts.append("c.source_domain = ?")
            values.append(source_domain)

        where_sql = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""

        with self._connect() as conn:
            rows = conn.execute(
                f"""
                SELECT
                  c.*,
                  (
                    SELECT MAX(v.version_no)
                    FROM test_case_versions v
                    WHERE v.case_id = c.id
                  ) AS latest_version_no,
                  (
                    SELECT v.test_name
                    FROM test_case_versions v
                    WHERE v.case_id = c.id
                    ORDER BY v.version_no DESC
                    LIMIT 1
                  ) AS latest_test_name,
                  (
                    SELECT r.status
                    FROM test_runs r
                    JOIN test_case_versions v ON v.id = r.case_version_id
                    WHERE v.case_id = c.id
                    ORDER BY r.started_at DESC
                    LIMIT 1
                  ) AS latest_run_status
                FROM test_case_assets c
                {where_sql}
                ORDER BY c.updated_at DESC
                """,
                values,
            ).fetchall()

        cases = [self._row_to_case_summary(row) for row in rows]
        if tag:
            cases = [c for c in cases if tag in c.get("tags", [])]
        return cases

    def get_case(self, case_id: str) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        self.init_db()

        with self._connect() as conn:
            case_row = conn.execute(
                """
                SELECT
                  c.*,
                  (
                    SELECT MAX(v.version_no)
                    FROM test_case_versions v
                    WHERE v.case_id = c.id
                  ) AS latest_version_no,
                  (
                    SELECT v.test_name
                    FROM test_case_versions v
                    WHERE v.case_id = c.id
                    ORDER BY v.version_no DESC
                    LIMIT 1
                  ) AS latest_test_name,
                  (
                    SELECT r.status
                    FROM test_runs r
                    JOIN test_case_versions v ON v.id = r.case_version_id
                    WHERE v.case_id = c.id
                    ORDER BY r.started_at DESC
                    LIMIT 1
                  ) AS latest_run_status
                FROM test_case_assets c
                WHERE c.id = ?
                """,
                [case_id],
            ).fetchone()

            if case_row is None:
                raise AssetNotFoundError(f"case not found: {case_id}")

            version_rows = conn.execute(
                """
                SELECT *
                FROM test_case_versions
                WHERE case_id = ?
                ORDER BY version_no DESC
                """,
                [case_id],
            ).fetchall()

            versions: list[dict[str, Any]] = []
            for row in version_rows:
                version = self._row_to_version(row)
                version["steps"] = self._load_steps(conn, version["id"])
                versions.append(version)

        return self._row_to_case_summary(case_row), versions

    def create_case(
        self,
        *,
        name: str,
        annotations: list[dict[str, Any]],
        module: str | None = None,
        tags: list[str] | None = None,
        status: str = "draft",
        source_domain: str | None = None,
        created_by: str | None = None,
        change_note: str | None = None,
        prompt_snapshot: str | None = None,
        model: str | None = None,
        temperature: float | None = None,
        generated_script: str | None = None,
        test_name: str | None = None,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        self.init_db()

        name_clean = _normalize_text(name)
        if not name_clean:
            raise AssetValidationError("case name is required")

        case_id = str(uuid.uuid4())
        now = _utc_now_iso()
        tags_value = tags or []

        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO test_case_assets (
                  id, name, module, tags_json, status, source_domain, created_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    case_id,
                    name_clean,
                    _normalize_text(module),
                    _json_dumps(tags_value),
                    status,
                    _normalize_text(source_domain),
                    _normalize_text(created_by),
                    now,
                    now,
                ],
            )

            version = self._insert_case_version(
                conn,
                case_id=case_id,
                annotations=annotations,
                change_note=change_note,
                prompt_snapshot=prompt_snapshot,
                model=model,
                temperature=temperature,
                generated_script=generated_script,
                test_name=test_name,
            )

            case_row = conn.execute(
                """
                SELECT
                  c.*,
                  (
                    SELECT MAX(v.version_no)
                    FROM test_case_versions v
                    WHERE v.case_id = c.id
                  ) AS latest_version_no,
                  (
                    SELECT v.test_name
                    FROM test_case_versions v
                    WHERE v.case_id = c.id
                    ORDER BY v.version_no DESC
                    LIMIT 1
                  ) AS latest_test_name,
                  NULL AS latest_run_status
                FROM test_case_assets c
                WHERE c.id = ?
                """,
                [case_id],
            ).fetchone()

        if case_row is None:
            raise AssetStoreError("failed to read created case")

        return self._row_to_case_summary(case_row), version

    def create_case_version(
        self,
        *,
        case_id: str,
        annotations: list[dict[str, Any]],
        change_note: str | None = None,
        prompt_snapshot: str | None = None,
        model: str | None = None,
        temperature: float | None = None,
        generated_script: str | None = None,
        test_name: str | None = None,
    ) -> dict[str, Any]:
        self.init_db()
        with self._connect() as conn:
            case_exists = conn.execute(
                "SELECT 1 FROM test_case_assets WHERE id = ?",
                [case_id],
            ).fetchone()
            if case_exists is None:
                raise AssetNotFoundError(f"case not found: {case_id}")

            return self._insert_case_version(
                conn,
                case_id=case_id,
                annotations=annotations,
                change_note=change_note,
                prompt_snapshot=prompt_snapshot,
                model=model,
                temperature=temperature,
                generated_script=generated_script,
                test_name=test_name,
            )

    def get_latest_annotation_snapshot(self, case_id: str) -> list[dict[str, Any]]:
        self.init_db()
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT annotation_snapshot
                FROM test_case_versions
                WHERE case_id = ?
                ORDER BY version_no DESC
                LIMIT 1
                """,
                [case_id],
            ).fetchone()

        if row is None:
            raise AssetNotFoundError(f"case has no versions: {case_id}")

        return _json_loads(row["annotation_snapshot"], [])

    def create_run(
        self,
        *,
        case_version_id: str,
        trigger: str,
        status: str,
        started_at: str | None,
        finished_at: str | None,
        duration_ms: int | None,
        result_summary: dict[str, Any] | None,
        report_url: str | None,
    ) -> dict[str, Any]:
        self.init_db()

        with self._connect() as conn:
            version_exists = conn.execute(
                "SELECT 1 FROM test_case_versions WHERE id = ?",
                [case_version_id],
            ).fetchone()
            if version_exists is None:
                raise AssetNotFoundError(f"case version not found: {case_version_id}")

            run_id = str(uuid.uuid4())
            started = started_at or _utc_now_iso()

            conn.execute(
                """
                INSERT INTO test_runs (
                  id, case_version_id, trigger_source, status, started_at,
                  finished_at, duration_ms, result_summary_json, report_url
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    run_id,
                    case_version_id,
                    trigger,
                    status,
                    started,
                    _normalize_text(finished_at),
                    duration_ms,
                    _json_dumps(result_summary or {}),
                    _normalize_text(report_url),
                ],
            )

            row = conn.execute(
                "SELECT * FROM test_runs WHERE id = ?",
                [run_id],
            ).fetchone()

        if row is None:
            raise AssetStoreError("failed to read created run")
        return self._row_to_run(row)

    def get_run(self, run_id: str) -> dict[str, Any]:
        self.init_db()
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM test_runs WHERE id = ?",
                [run_id],
            ).fetchone()
        if row is None:
            raise AssetNotFoundError(f"run not found: {run_id}")
        return self._row_to_run(row)

    def update_version_script(
        self,
        *,
        version_id: str,
        script: str,
        test_name: str | None = None,
    ) -> dict[str, Any]:
        self.init_db()
        script_clean = script.strip()
        script_sha256 = hashlib.sha256(script_clean.encode("utf-8")).hexdigest()

        with self._connect() as conn:
            version_row = conn.execute(
                "SELECT case_id FROM test_case_versions WHERE id = ?",
                [version_id],
            ).fetchone()
            if version_row is None:
                raise AssetNotFoundError(f"case version not found: {version_id}")

            conn.execute(
                """
                UPDATE test_case_versions
                SET generated_script = ?, script_sha256 = ?, test_name = COALESCE(?, test_name)
                WHERE id = ?
                """,
                [script_clean, script_sha256, _normalize_text(test_name), version_id],
            )
            conn.execute(
                "UPDATE test_case_assets SET updated_at = ? WHERE id = ?",
                [_utc_now_iso(), version_row["case_id"]],
            )

            row = conn.execute(
                "SELECT * FROM test_case_versions WHERE id = ?",
                [version_id],
            ).fetchone()

        if row is None:
            raise AssetStoreError("failed to read updated version")
        version = self._row_to_version(row)
        version["steps"] = []
        return version

    def _insert_case_version(
        self,
        conn: sqlite3.Connection,
        *,
        case_id: str,
        annotations: list[dict[str, Any]],
        change_note: str | None,
        prompt_snapshot: str | None,
        model: str | None,
        temperature: float | None,
        generated_script: str | None,
        test_name: str | None,
    ) -> dict[str, Any]:
        next_version_row = conn.execute(
            "SELECT COALESCE(MAX(version_no), 0) + 1 AS next_version_no FROM test_case_versions WHERE case_id = ?",
            [case_id],
        ).fetchone()
        version_no = int(next_version_row["next_version_no"] if next_version_row else 1)
        version_id = str(uuid.uuid4())
        now = _utc_now_iso()

        normalized_annotations = [
            a if isinstance(a, dict) else dict(a)
            for a in (annotations or [])
        ]
        script_clean = generated_script.strip() if isinstance(generated_script, str) else None
        script_sha256 = (
            hashlib.sha256(script_clean.encode("utf-8")).hexdigest()
            if script_clean
            else None
        )

        conn.execute(
            """
            INSERT INTO test_case_versions (
              id, case_id, version_no, change_note, annotation_snapshot,
              prompt_snapshot, model, temperature, generated_script,
              script_sha256, test_name, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                version_id,
                case_id,
                version_no,
                _normalize_text(change_note),
                _json_dumps(normalized_annotations),
                prompt_snapshot,
                _normalize_text(model),
                temperature,
                script_clean,
                script_sha256,
                _normalize_text(test_name),
                now,
            ],
        )

        steps = self._build_steps_from_annotations(version_id, normalized_annotations)
        for step in steps:
            conn.execute(
                """
                INSERT INTO test_steps (
                  id, case_version_id, order_no, action, expected,
                  selector_candidates_json, element_profile_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    step["id"],
                    version_id,
                    step["order_no"],
                    step["action"],
                    step["expected"],
                    _json_dumps(step["selector_candidates"]),
                    _json_dumps(step["element_profile"]),
                ],
            )

        conn.execute(
            "UPDATE test_case_assets SET updated_at = ? WHERE id = ?",
            [now, case_id],
        )

        row = conn.execute(
            "SELECT * FROM test_case_versions WHERE id = ?",
            [version_id],
        ).fetchone()
        if row is None:
            raise AssetStoreError("failed to read created version")

        version = self._row_to_version(row)
        version["steps"] = steps
        return version

    def _build_steps_from_annotations(
        self,
        case_version_id: str,
        annotations: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        steps: list[dict[str, Any]] = []
        for index, annotation in enumerate(annotations):
            selector_candidates = annotation.get("playwrightTopSelectors")
            if not isinstance(selector_candidates, list):
                selector_candidates = []

            element_profile = annotation.get("playwrightElementInfo")
            if not isinstance(element_profile, dict):
                element_profile = {
                    "element": annotation.get("element"),
                    "elementPath": annotation.get("elementPath"),
                    "fullPath": annotation.get("fullPath"),
                }

            step_action = _normalize_text(annotation.get("comment")) or f"Step {index + 1}"
            step_expected = _normalize_text(annotation.get("expected"))

            steps.append(
                {
                    "id": str(uuid.uuid4()),
                    "case_version_id": case_version_id,
                    "order_no": index + 1,
                    "action": step_action,
                    "expected": step_expected,
                    "selector_candidates": selector_candidates,
                    "element_profile": element_profile,
                }
            )

        return steps

    def _load_steps(self, conn: sqlite3.Connection, version_id: str) -> list[dict[str, Any]]:
        rows = conn.execute(
            """
            SELECT *
            FROM test_steps
            WHERE case_version_id = ?
            ORDER BY order_no ASC
            """,
            [version_id],
        ).fetchall()

        steps: list[dict[str, Any]] = []
        for row in rows:
            steps.append(
                {
                    "id": row["id"],
                    "order_no": int(row["order_no"]),
                    "action": row["action"],
                    "expected": row["expected"],
                    "selector_candidates": _json_loads(row["selector_candidates_json"], []),
                    "element_profile": _json_loads(row["element_profile_json"], {}),
                }
            )
        return steps

    def _row_to_case_summary(self, row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": row["id"],
            "name": row["name"],
            "module": row["module"],
            "tags": _json_loads(row["tags_json"], []),
            "status": row["status"],
            "source_domain": row["source_domain"],
            "created_by": row["created_by"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "latest_version_no": row["latest_version_no"],
            "latest_test_name": row["latest_test_name"],
            "latest_run_status": row["latest_run_status"],
        }

    def _row_to_version(self, row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": row["id"],
            "case_id": row["case_id"],
            "version_no": int(row["version_no"]),
            "change_note": row["change_note"],
            "annotation_snapshot": _json_loads(row["annotation_snapshot"], []),
            "prompt_snapshot": row["prompt_snapshot"],
            "model": row["model"],
            "temperature": row["temperature"],
            "generated_script": row["generated_script"],
            "script_sha256": row["script_sha256"],
            "test_name": row["test_name"],
            "created_at": row["created_at"],
        }

    def _row_to_run(self, row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": row["id"],
            "case_version_id": row["case_version_id"],
            "trigger": row["trigger_source"],
            "status": row["status"],
            "started_at": row["started_at"],
            "finished_at": row["finished_at"],
            "duration_ms": row["duration_ms"],
            "result_summary": _json_loads(row["result_summary_json"], {}),
            "report_url": row["report_url"],
        }

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._db_path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection
