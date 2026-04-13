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
    video_b_info          JSONB,
    user_id               UUID -- NULL for legacy, but required for new sessions
);

CREATE INDEX IF NOT EXISTS idx_comparisons_session_id  ON comparisons(session_id);
CREATE INDEX IF NOT EXISTS idx_comparisons_verdict     ON comparisons(verdict);
CREATE INDEX IF NOT EXISTS idx_comparisons_created_at  ON comparisons(created_at);
CREATE INDEX IF NOT EXISTS idx_comparisons_score       ON comparisons(similarity_percentage);

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    full_name       TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS damage_annotations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id     UUID NOT NULL REFERENCES damage_analyses(id) ON DELETE CASCADE,
    bboxes          JSONB NOT NULL, -- Array of [class_id, x1, y1, x2, y2] or similar
    reviewed_by     UUID REFERENCES users(id),
    reviewed_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_annotations_analysis ON damage_annotations(analysis_id);
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


def get_db_conn():
    """Generator for FastAPI Depends to handle pool.getconn / putconn."""
    if not _pool:
        raise Exception("Database pool not initialized")
    conn = _pool.getconn()
    try:
        yield conn
    finally:
        _pool.putconn(conn)


def get_user_by_username(username: str) -> Optional[dict]:
    if not _pool:
        return None
    conn = _pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, username, hashed_password FROM users WHERE username = %s", (username,))
            row = cur.fetchone()
            if row:
                return {"id": row[0], "username": row[1], "hashed_password": row[2]}
            return None
    finally:
        _pool.putconn(conn)

def create_user(username: str, hashed_password: str, full_name: Optional[str] = None) -> str:
    if not _pool:
        raise Exception("Database pool not initialized")
    conn = _pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (username, hashed_password, full_name) VALUES (%s, %s, %s) RETURNING id",
                (username, hashed_password, full_name)
            )
            user_id = cur.fetchone()[0]
        conn.commit()
        return user_id
    finally:
        _pool.putconn(conn)

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
    user_id:               Optional[str] = None,
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
                    processing_time_ms, video_a_info, video_b_info, user_id
                ) VALUES (
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s
                )
            """, (
                session_id, similarity_percentage, verdict, confidence,
                frame_scores, frames_compared,
                frame_a_paths, frame_b_paths,
                embedding_a, embedding_b,
                embedding_model, explanation_model, device_used,
                processing_time_ms, Json(video_a_info), Json(video_b_info), user_id
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

def get_pending_analyses(limit: int = 50) -> list:
    if not _pool:
        return []
    conn = _pool.getconn()
    try:
        with conn.cursor() as cur:
            # Join with annotations to find items that HAVEN'T been reviewed yet
            cur.execute("""
                SELECT d.id, d.session_id, d.frame_path, d.damages, d.media_info, d.created_at
                FROM damage_analyses d
                LEFT JOIN damage_annotations a ON d.id = a.analysis_id
                WHERE a.id IS NULL
                ORDER BY d.created_at DESC
                LIMIT %s
            """, (limit,))
            rows = cur.fetchall()
            return [
                {
                    "id": str(r[0]),
                    "session_id": r[1],
                    "frame_path": r[2],
                    "damages": r[3],
                    "media_info": r[4],
                    "created_at": r[5].isoformat(),
                }
                for r in rows
            ]
    finally:
        _pool.putconn(conn)

def save_annotation(analysis_id: str, bboxes: list, user_id: str) -> bool:
    if not _pool:
        return False
    conn = _pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO damage_annotations (analysis_id, bboxes, reviewed_by)
                VALUES (%s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET bboxes = EXCLUDED.bboxes, reviewed_at = NOW()
            """, (analysis_id, Json(bboxes), user_id))
        conn.commit()
        return True
    except Exception as e:
        print(f"[PostgreSQL] Save annotation failed: {e}")
        conn.rollback()
        return False
    finally:
        _pool.putconn(conn)