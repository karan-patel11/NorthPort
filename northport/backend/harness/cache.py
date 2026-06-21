from __future__ import annotations

import hashlib
import json
import sqlite3
from pathlib import Path
from typing import Any


def content_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def content_hash_file(path: str | Path, *, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(chunk_size), b""):
            digest.update(chunk)
    return digest.hexdigest()


class ContentHashCache:
    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._init()

    def _init(self) -> None:
        with sqlite3.connect(self.path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS filing_cache (
                    hash TEXT PRIMARY KEY,
                    result_json TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
                """
            )

    def get(self, digest: str) -> dict[str, Any] | None:
        with sqlite3.connect(self.path) as conn:
            row = conn.execute("SELECT result_json FROM filing_cache WHERE hash = ?", (digest,)).fetchone()
        if row is None:
            return None
        return json.loads(row[0])

    def put(self, digest: str, result: dict[str, Any]) -> None:
        payload = json.dumps(result, sort_keys=True, default=str)
        with sqlite3.connect(self.path) as conn:
            conn.execute(
                """
                INSERT INTO filing_cache (hash, result_json)
                VALUES (?, ?)
                ON CONFLICT(hash) DO UPDATE SET result_json = excluded.result_json
                """,
                (digest, payload),
            )
