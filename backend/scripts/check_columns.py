"""Verify the verification audit columns exist."""

import os

import psycopg
from dotenv import load_dotenv

load_dotenv()

url = os.environ["DATABASE_URL"]
with psycopg.connect(url) as conn:
    with conn.cursor() as cur:
        cur.execute(
            """
            select column_name, data_type, is_nullable
            from information_schema.columns
            where table_name = 'academy_applications'
              and column_name in ('verified_at', 'verified_b_stt_cd')
            order by column_name
            """
        )
        rows = cur.fetchall()

for row in rows:
    print(f"  {row[0]:25s}  {row[1]:25s}  nullable={row[2]}")
print(f"total: {len(rows)} columns")
