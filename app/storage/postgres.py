"""
storage/postgres.py — PostgreSQL with connection pooling
"""

import psycopg2
from psycopg2 import pool
from psycopg2.extras import Json
from app.config import POSTGRES_DSN

# ── Connection Pool ────────────────────────────
# Reuse connections instead of opening one per request.
# minconn=2: keep 2 warm connections ready
# maxconn=10: allow up to 10 concurrent connections
_pool = None

INIT_SQL = """
CREATE TABLE IF NOT EXISTS comparisons (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id            TEXT NOT NULL,
    created_at            TIMESTAMPTZ DEFAULT NOW(),

    similarity_percentage FLOAT,
    verdict               TEXT,
    confidence            TEXT,
    frame_scores          FLOAT[],
    frames_compared       INT,

    frame_a_paths         TEXT[],
    frame_b_paths         TEXT[],

    embedding_a           FLOAT[],
    embedding_b           FLOAT[],

    embedding_model       TEXT,
    explanation_model     TEXT,
    device_used           TEXT,
    processing_time_ms    FLOAT,

    video_a_info          JSONB,
    video_b_info          JSONB
);

CREATE INDEX IF NOT EXISTS idx_comparisons_session_id  ON comparisons(session_id);
CREATE INDEX IF NOT EXISTS idx_comparisons_verdict     ON comparisons(verdict);
CREATE INDEX IF NOT EXISTS idx_comparisons_created_at  ON comparisons(created_at);
CREATE INDEX IF NOT EXISTS idx_comparisons_score       ON comparisons(similarity_percentage);
"""


def init_db():
    """Initialize connection pool + create tables."""
    global _pool
    try:
        _pool = pool.SimpleConnectionPool(minconn=2, maxconn=10, dsn=POSTGRES_DSN)
        conn = _pool.getconn()
        with conn.cursor() as cur:
            cur.execute(INIT_SQL)
        conn.commit()
        _pool.putconn(conn)
        print("[PostgreSQL] Pool initialized + table ready ✓")
    except Exception as e:
        print(f"[PostgreSQL] Init warning: {e}")
        _pool = None


def close_db():
    """Close all connections in the pool. Call on shutdown."""
    global _pool
    if _pool:
        _pool.closeall()
        _pool = None
        print("[PostgreSQL] Pool closed ✓")


def save_metadata(
    session_id:            str,
    similarity_percentage: float,
    verdict:               str,
    confidence:            str,
    frame_scores:          list,
    frames_compared:       int,
    frame_a_paths:         list,
    frame_b_paths:         list,
    embedding_a:           list,
    embedding_b:           list,
    embedding_model:       str,
    explanation_model:     str,
    device_used:           str,
    processing_time_ms:    float,
    video_a_info:          dict,
    video_b_info:          dict,
) -> bool:
    """Simpan 1 record ke tabel comparisons. Return True kalau sukses."""
    if not _pool:
        print("[PostgreSQL] Pool not initialized, skipping save")
        return False

    conn = None
    try:
        conn = _pool.getconn()
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO comparisons (
                    session_id, similarity_percentage, verdict, confidence,
                    frame_scores, frames_compared,
                    frame_a_paths, frame_b_paths,
                    embedding_a, embedding_b,
                    embedding_model, explanation_model, device_used,
                    processing_time_ms, video_a_info, video_b_info
                ) VALUES (
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s
                )
            """, (
                session_id, similarity_percentage, verdict, confidence,
                frame_scores, frames_compared,
                frame_a_paths, frame_b_paths,
                embedding_a, embedding_b,
                embedding_model, explanation_model, device_used,
                processing_time_ms, Json(video_a_info), Json(video_b_info),
            ))
        conn.commit()
        return True
    except Exception as e:
        print(f"[PostgreSQL] Save failed: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            _pool.putconn(conn)