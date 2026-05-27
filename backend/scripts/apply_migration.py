"""Apply a SQL migration file to the Supabase Postgres DB.

Usage:
    python scripts/apply_migration.py <path-to-sql-file>

Connects via DATABASE_URL from .env (session pooler, IPv4 safe).
Wraps the file's SQL in a single transaction — all-or-nothing.
Does NOT track applied migrations (no migrations table). Intended for dev: idempotent
re-runs are the responsibility of the SQL author (use IF NOT EXISTS where reasonable).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg
from dotenv import load_dotenv

load_dotenv()


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: apply_migration.py <sql-file>", file=sys.stderr)
        return 2

    sql_path = Path(sys.argv[1]).resolve()
    if not sql_path.is_file():
        print(f"not found: {sql_path}", file=sys.stderr)
        return 2

    url = os.environ.get("DATABASE_URL")
    if not url:
        print("DATABASE_URL missing in env (see backend/.env)", file=sys.stderr)
        return 2

    sql = sql_path.read_text(encoding="utf-8")
    if not sql.strip():
        print("empty SQL file", file=sys.stderr)
        return 2

    print(f"applying {sql_path.name} ({len(sql)} bytes)")
    with psycopg.connect(url, autocommit=False) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
    print("OK committed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
