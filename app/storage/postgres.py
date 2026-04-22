"""
storage/postgres.py — PostgreSQL with connection pooling
"""

import psycopg2
import time
from typing import Optional, List, Dict, Any
from psycopg2 import pool
from psycopg2.extras import Json
from app.config import POSTGRES_DSN

# ── Connection Pool ────────────────────────────
# Reuse connections instead of opening one per request.
# minconn=2: keep 2 warm connections ready
# maxconn=10: allow up to 10 concurrent connections
_pool = None

INIT_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    full_name       TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS damage_analyses (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id             TEXT NOT NULL,
    created_at             TIMESTAMPTZ DEFAULT NOW(),
    input_type             TEXT,
    frame_path             TEXT,
    damages                JSONB,
    overall_condition      TEXT,
    condition_score        FLOAT,
    repair_urgency         TEXT,
    estimated_damage_count INT,
    analysis_notes         TEXT,
    analysis_model         TEXT,
    processing_time_ms     FLOAT,
    media_info             JSONB,
    user_id                UUID
);

CREATE TABLE IF NOT EXISTS damage_annotations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id     UUID NOT NULL REFERENCES damage_analyses(id) ON DELETE CASCADE,
    bboxes          JSONB NOT NULL,
    reviewed_by     UUID REFERENCES users(id),
    reviewed_at     TIMESTAMPTZ DEFAULT NOW()
);

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
    user_id               UUID REFERENCES users(id)
);

-- ── Inspection Engine Tables (Stage 6) ───────────────────────────

CREATE TABLE IF NOT EXISTS inspections (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID REFERENCES users(id),
    vehicle_id         TEXT,
    status             TEXT NOT NULL DEFAULT 'pending',
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    started_at         TIMESTAMPTZ,
    completed_at       TIMESTAMPTZ,
    error_message      TEXT,
    video_path         TEXT,
    expected_frame_count INT,
    media_info         JSONB,
    progress_json      JSONB DEFAULT '{"frames_extracted": 0, "frames_analyzed": 0, "frames_total": 0}'::jsonb,
    processing_time_ms FLOAT,
    analysis_model     TEXT,
    device_used        TEXT
);

CREATE TABLE IF NOT EXISTS inspection_frames (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id   UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    frame_index     INT NOT NULL,
    frame_path      TEXT NOT NULL,
    sharpness_score FLOAT,
    timestamp_ms    FLOAT,
    embedding       FLOAT[],
    ai_damages      JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inspection_results (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id          UUID UNIQUE NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    overall_condition      TEXT,
    condition_score        FLOAT,
    repair_urgency         TEXT,
    damages                JSONB,
    estimated_damage_count INT,
    analysis_notes         TEXT,
    created_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS frame_annotations (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    frame_id       UUID NOT NULL UNIQUE REFERENCES inspection_frames(id) ON DELETE CASCADE,
    reviewed_by    UUID REFERENCES users(id),
    reviewed_at    TIMESTAMPTZ DEFAULT NOW(),
    is_verified    BOOLEAN DEFAULT FALSE,
    bboxes         JSONB NOT NULL,
    override_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_username          ON users(username);
CREATE INDEX IF NOT EXISTS idx_comparisons_session_id  ON comparisons(session_id);
CREATE INDEX IF NOT EXISTS idx_comparisons_created_at  ON comparisons(created_at);
CREATE INDEX IF NOT EXISTS idx_damage_sessions         ON damage_analyses(session_id);
CREATE INDEX IF NOT EXISTS idx_annotations_analysis    ON damage_annotations(analysis_id);
CREATE INDEX IF NOT EXISTS idx_inspections_user        ON inspections(user_id);
CREATE INDEX IF NOT EXISTS idx_inspections_status      ON inspections(status);
CREATE INDEX IF NOT EXISTS idx_inspections_created     ON inspections(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insp_frames_insp_id     ON inspection_frames(inspection_id);
CREATE INDEX IF NOT EXISTS idx_frame_annot_frame       ON frame_annotations(frame_id);
CREATE INDEX IF NOT EXISTS idx_insp_results_insp       ON inspection_results(inspection_id);
"""


def init_db():
    """Initialize connection pool + create tables with retry logic."""
    global _pool
    max_retries = 5
    for attempt in range(max_retries):
        try:
            print(f"[PostgreSQL] Initializing pool (attempt {attempt+1}/{max_retries})...")
            _pool = pool.ThreadedConnectionPool(minconn=2, maxconn=10, dsn=POSTGRES_DSN)
            conn = _pool.getconn()
            with conn.cursor() as cur:
                cur.execute(INIT_SQL)
            conn.commit()
            _pool.putconn(conn)
            print("[PostgreSQL] Pool initialized + tables ready ✓")
            
            # Seed default user
            seed_default_user()
            return  # Success, exit function
        except Exception as e:
            print(f"[PostgreSQL] Init warning: {e}")
            _pool = None
            if attempt < max_retries - 1:
                time.sleep(3)  # Wait 3 seconds before retrying
                
    print("[PostgreSQL] Failed to initialize after multiple attempts. Is the database running?")


def seed_default_user():
    """Create a default user 'victor' if none exists."""
    from app.storage.auth import get_password_hash
    
    if not _pool: return
    conn = _pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM users")
            count = cur.fetchone()[0]
            if count == 0:
                print("[Seed] Creating default user: victor")
                hashed = get_password_hash("victor123")
                cur.execute(
                    "INSERT INTO users (username, hashed_password, full_name) VALUES (%s, %s, %s)",
                    ("victor", hashed, "Victor AI Admin")
                )
        conn.commit()
    except Exception as e:
        print(f"[Seed] Failed to seed user: {e}")
        conn.rollback()
    finally:
        _pool.putconn(conn)


def close_db():
    """Close all connections in the pool. Call on shutdown."""
    global _pool
    if _pool:
        _pool.closeall()
        _pool = None
        print("[PostgreSQL] Pool closed ✓")

def get_pool():
    """Return the global connection pool instance."""
    return _pool

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


# ─────────────────────────────────────────────────────────────────
# Inspection Engine — DB Helpers (Stage 6)
# ─────────────────────────────────────────────────────────────────

def create_inspection(
    user_id: Optional[str],
    vehicle_id: Optional[str] = None,
    video_path: Optional[str] = None,
) -> Optional[str]:
    """Create a new inspection record in 'pending' state. Returns the UUID."""
    if not _pool:
        return None
    conn = _pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO inspections (user_id, vehicle_id, status, video_path)
                VALUES (%s, %s, 'pending', %s)
                RETURNING id
            """, (user_id, vehicle_id, video_path))
            row = cur.fetchone()
        conn.commit()
        return str(row[0]) if row else None
    except Exception as e:
        print(f"[PostgreSQL] create_inspection failed: {e}")
        conn.rollback()
        return None
    finally:
        _pool.putconn(conn)


def update_inspection_status(
    inspection_id: str,
    status: str,
    error: Optional[str] = None,
    media_info: Optional[dict] = None,
    processing_time_ms: Optional[float] = None,
    analysis_model: Optional[str] = None,
    device_used: Optional[str] = None,
    progress: Optional[dict] = None,
) -> bool:
    """Update inspection lifecycle fields (status, timestamps, error, progress)."""
    if not _pool:
        print(f"[PostgreSQL] ERROR: Database pool not initialized when updating status for {inspection_id}")
        return False
    conn = _pool.getconn()
    try:
        with conn.cursor() as cur:
            parts = ["status = %s"]
            vals: list = [status]

            if status == "processing":
                parts.append("started_at = NOW()")
            elif status in ("done", "failed"):
                parts.append("completed_at = NOW()")

            if error is not None:
                parts.append("error_message = %s")
                vals.append(error)
            if media_info is not None:
                parts.append("media_info = %s")
                vals.append(Json(media_info))
            if processing_time_ms is not None:
                parts.append("processing_time_ms = %s")
                vals.append(processing_time_ms)
            if analysis_model is not None:
                parts.append("analysis_model = %s")
                vals.append(analysis_model)
            if device_used is not None:
                parts.append("device_used = %s")
                vals.append(device_used)
            if progress is not None:
                parts.append("progress_json = %s")
                vals.append(Json(progress))
                if "frames_total" in progress:
                    parts.append("expected_frame_count = %s")
                    vals.append(progress["frames_total"])

            vals.append(inspection_id)
            cur.execute(
                f"UPDATE inspections SET {', '.join(parts)} WHERE id = %s",
                vals,
            )
        conn.commit()
        return True
    except Exception as e:
        print(f"[PostgreSQL] update_inspection_status failed: {e}")
        conn.rollback()
        return False
    finally:
        _pool.putconn(conn)


def save_inspection_frame(
    inspection_id: str,
    frame_index: int,
    frame_path: str,
    sharpness_score: float,
    embedding: Optional[list] = None,
    ai_damages: Optional[dict] = None,
    timestamp_ms: Optional[float] = None,
) -> Optional[str]:
    """Persist one extracted frame record. Returns the new frame UUID."""
    if not _pool:
        return None
    conn = _pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO inspection_frames
                    (inspection_id, frame_index, frame_path, sharpness_score,
                     embedding, ai_damages, timestamp_ms)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                inspection_id, frame_index, frame_path,
                sharpness_score, embedding,
                Json(ai_damages) if ai_damages else None,
                timestamp_ms,
            ))
            row = cur.fetchone()
        conn.commit()
        return str(row[0]) if row else None
    except Exception as e:
        print(f"[PostgreSQL] save_inspection_frame failed: {e}")
        conn.rollback()
        return None
    finally:
        _pool.putconn(conn)


def save_inspection_result(inspection_id: str, report: dict) -> bool:
    """Persist the aggregated inspection result."""
    if not _pool:
        return False
    conn = _pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO inspection_results
                    (inspection_id, overall_condition, condition_score, repair_urgency,
                     damages, estimated_damage_count, analysis_notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (inspection_id) DO UPDATE SET
                    overall_condition      = EXCLUDED.overall_condition,
                    condition_score        = EXCLUDED.condition_score,
                    repair_urgency         = EXCLUDED.repair_urgency,
                    damages                = EXCLUDED.damages,
                    estimated_damage_count = EXCLUDED.estimated_damage_count,
                    analysis_notes         = EXCLUDED.analysis_notes
            """, (
                inspection_id,
                report.get("overall_condition"),
                report.get("condition_score"),
                report.get("repair_urgency"),
                Json(report.get("damages", [])),
                report.get("estimated_damage_count", 0),
                report.get("analysis_notes", ""),
            ))
        conn.commit()
        return True
    except Exception as e:
        print(f"[PostgreSQL] save_inspection_result failed: {e}")
        conn.rollback()
        return False
    finally:
        _pool.putconn(conn)


def get_inspection_status(inspection_id: str) -> Optional[dict]:
    """Return minimal status fields — for the polling endpoint."""
    if not _pool:
        print(f"[PostgreSQL] ERROR: Database pool not initialized when fetching status for {inspection_id}")
        return None
    conn = _pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, status, created_at, started_at, completed_at,
                       error_message, progress_json
                FROM inspections WHERE id = %s
            """, (inspection_id,))
            row = cur.fetchone()
        if not row:
            return None
        return {
            "inspection_id": str(row[0]),
            "status":        row[1],
            "created_at":    row[2].isoformat() if row[2] else None,
            "started_at":    row[3].isoformat() if row[3] else None,
            "completed_at":  row[4].isoformat() if row[4] else None,
            "error_message": row[5],
            "progress":      row[6] or {},
        }
    finally:
        _pool.putconn(conn)


def get_inspection_result(inspection_id: str) -> Optional[dict]:
    """Return the full inspection result including per-frame data."""
    if not _pool:
        return None
    conn = _pool.getconn()
    try:
        with conn.cursor() as cur:
            # Main inspection row
            cur.execute("""
                SELECT i.id, i.vehicle_id, i.status, i.created_at,
                       i.processing_time_ms, i.analysis_model, i.device_used,
                       i.media_info,
                       r.overall_condition, r.condition_score, r.repair_urgency,
                       r.damages, r.estimated_damage_count, r.analysis_notes
                FROM inspections i
                LEFT JOIN inspection_results r ON r.inspection_id = i.id
                WHERE i.id = %s
            """, (inspection_id,))
            row = cur.fetchone()
            if not row:
                return None

            # Per-frame rows
            cur.execute("""
                SELECT f.id, f.frame_index, f.frame_path, f.sharpness_score,
                       f.ai_damages, f.timestamp_ms,
                       COALESCE(a.is_verified, FALSE) AS is_reviewed
                FROM inspection_frames f
                LEFT JOIN frame_annotations a ON a.frame_id = f.id
                WHERE f.inspection_id = %s
                ORDER BY f.frame_index
            """, (inspection_id,))
            frames = cur.fetchall()

        return {
            "inspection_id":          str(row[0]),
            "vehicle_id":             row[1],
            "status":                 row[2],
            "created_at":             row[3].isoformat() if row[3] else None,
            "processing_time_ms":     row[4],
            "analysis_model":         row[5],
            "device_used":            row[6],
            "media_info":             row[7],
            "overall_condition":      row[8],
            "condition_score":        row[9],
            "repair_urgency":         row[10],
            "damages":                row[11] or [],
            "estimated_damage_count": row[12] or 0,
            "analysis_notes":         row[13] or "",
            "frames": [
                {
                    "frame_id":       str(f[0]),
                    "frame_index":    f[1],
                    "frame_path":     f[2],
                    "sharpness_score": f[3],
                    "ai_damages":     f[4] or [],
                    "timestamp_ms":   f[5],
                    "is_reviewed":    f[6],
                }
                for f in frames
            ],
        }
    finally:
        _pool.putconn(conn)


def get_inspection_history(
    user_id: str,
    page: int = 1,
    per_page: int = 20,
) -> dict:
    """Return paginated inspection history for a user."""
    if not _pool:
        return {"items": [], "total": 0, "page": page}
    offset = (page - 1) * per_page
    conn = _pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM inspections WHERE user_id = %s",
                (user_id,)
            )
            total = cur.fetchone()[0]

            cur.execute("""
                SELECT i.id, i.vehicle_id, i.status, i.created_at,
                       r.condition_score, r.overall_condition, r.repair_urgency
                FROM inspections i
                LEFT JOIN inspection_results r ON r.inspection_id = i.id
                WHERE i.user_id = %s
                ORDER BY i.created_at DESC
                LIMIT %s OFFSET %s
            """, (user_id, per_page, offset))
            rows = cur.fetchall()

        return {
            "items": [
                {
                    "inspection_id":  str(r[0]),
                    "vehicle_id":     r[1],
                    "status":         r[2],
                    "created_at":     r[3].isoformat() if r[3] else None,
                    "condition_score":  r[4],
                    "overall_condition": r[5],
                    "repair_urgency":    r[6],
                }
                for r in rows
            ],
            "total":    total,
            "page":     page,
            "per_page": per_page,
        }
    finally:
        _pool.putconn(conn)


def increment_frames_analyzed(inspection_id: str) -> Optional[dict]:
    """
    Atomically increment frames_analyzed inside progress_json at the SQL level.

    Returns the UPDATED progress dict so the caller can check if aggregation
    should be triggered — no Python-level read-modify-write race.

    Uses jsonb_set + RETURNING to do everything in one round-trip.
    """
    if not _pool:
        return None
    conn = _pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE inspections
                SET progress_json = jsonb_set(
                    COALESCE(progress_json, '{}'::jsonb),
                    '{frames_analyzed}',
                    to_jsonb(
                        COALESCE((progress_json->>'frames_analyzed')::int, 0) + 1
                    )
                )
                WHERE id = %s
                RETURNING progress_json
            """, (inspection_id,))
            row = cur.fetchone()
        conn.commit()
        return row[0] if row else None
    except Exception as e:
        print(f"[PostgreSQL] increment_frames_analyzed failed: {e}")
        conn.rollback()
        return None
    finally:
        _pool.putconn(conn)


def save_frame_annotation(
    frame_id: str,
    bboxes: list,
    user_id: str,
    is_verified: bool = True,
    override_notes: Optional[str] = None,
) -> bool:
    """Insert or replace a human annotation on a single frame."""
    if not _pool:
        return False
    conn = _pool.getconn()
    try:
        with conn.cursor() as cur:
            # Upsert: one annotation row per frame (replace if re-reviewed)
            cur.execute("""
                INSERT INTO frame_annotations
                    (frame_id, bboxes, reviewed_by, is_verified, override_notes)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (frame_id) DO UPDATE SET
                    bboxes         = EXCLUDED.bboxes,
                    reviewed_by    = EXCLUDED.reviewed_by,
                    reviewed_at    = NOW(),
                    is_verified    = EXCLUDED.is_verified,
                    override_notes = EXCLUDED.override_notes
            """, (frame_id, Json(bboxes), user_id, is_verified, override_notes))
        conn.commit()
        return True
    except Exception as e:
        print(f"[PostgreSQL] save_frame_annotation failed: {e}")
        conn.rollback()
        return False
    finally:
        _pool.putconn(conn)


def get_frames_for_export(inspection_id: str) -> List[Dict[str, Any]]:
    """
    Fetch all verified-annotated frames for a given inspection.
    Used by the YOLO export endpoint.
    Returns only frames that have is_verified = true.
    """
    if not _pool:
        return []
    conn = _pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT f.id, f.frame_index, f.frame_path, a.bboxes
                FROM inspection_frames f
                INNER JOIN frame_annotations a ON a.frame_id = f.id
                WHERE f.inspection_id = %s AND a.is_verified = TRUE
                ORDER BY f.frame_index
            """, (inspection_id,))
            rows = cur.fetchall()
        return [
            {
                "frame_id":    str(r[0]),
                "frame_index": r[1],
                "frame_path":  r[2],
                "bboxes":      r[3] or [],
            }
            for r in rows
        ]
    finally:
        _pool.putconn(conn)


def get_pending_inspections(limit: int = 50) -> list:
    """Return unreviewed inspections for the admin queue."""
    if not _pool:
        return []
    conn = _pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT i.id, i.vehicle_id, i.status, i.created_at,
                       r.overall_condition, r.condition_score,
                       COUNT(f.id)                      AS total_frames,
                       COUNT(a.id)                      AS reviewed_frames
                FROM inspections i
                LEFT JOIN inspection_results r  ON r.inspection_id = i.id
                LEFT JOIN inspection_frames f   ON f.inspection_id = i.id
                LEFT JOIN frame_annotations a   ON a.frame_id = f.id AND a.is_verified = TRUE
                WHERE i.status = 'done'
                GROUP BY i.id, r.overall_condition, r.condition_score
                HAVING COUNT(f.id) > COUNT(a.id)   -- has at least one unreviewed frame
                ORDER BY i.created_at DESC
                LIMIT %s
            """, (limit,))
            rows = cur.fetchall()
        return [
            {
                "inspection_id":   str(r[0]),
                "vehicle_id":      r[1],
                "status":          r[2],
                "created_at":      r[3].isoformat() if r[3] else None,
                "overall_condition": r[4],
                "condition_score": r[5],
                "total_frames":    r[6],
                "reviewed_frames": r[7],
            }
            for r in rows
        ]
    finally:
        _pool.putconn(conn)