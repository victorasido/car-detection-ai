"""
storage/damage_dataset.py — Save damage analysis results ke MinIO + PostgreSQL
==============================================================================
Schema PostgreSQL (auto-created):

  CREATE TABLE damage_analyses (
    id              UUID PRIMARY KEY,
    session_id      TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),

    -- Input info
    input_type      TEXT,        -- "photo" atau "video"
    frame_path      TEXT,        -- path di MinIO

    -- Damage report
    damages         JSONB,       -- array of damage objects
    overall_condition TEXT,
    condition_score   FLOAT,
    repair_urgency    TEXT,
    estimated_damage_count INT,
    analysis_notes  TEXT,

    -- Model info
    analysis_model  TEXT,
    processing_time_ms FLOAT,

    -- Media metadata
    media_info      JSONB        -- resolution, fps, dll
  );
"""

import asyncio
import time
import numpy as np
import psycopg2
from psycopg2.extras import Json
from app.storage.minio import save_frame
from app.config import POSTGRES_DSN

INIT_SQL = """
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
    media_info             JSONB
);

CREATE INDEX IF NOT EXISTS idx_damage_session    ON damage_analyses(session_id);
CREATE INDEX IF NOT EXISTS idx_damage_condition  ON damage_analyses(overall_condition);
CREATE INDEX IF NOT EXISTS idx_damage_score      ON damage_analyses(condition_score);
CREATE INDEX IF NOT EXISTS idx_damage_created_at ON damage_analyses(created_at);
"""

MAX_RETRIES  = 3
RETRY_DELAY  = 1.0


def init_damage_table():
    """Inisialisasi tabel damage_analyses saat startup."""
    try:
        conn = psycopg2.connect(POSTGRES_DSN)
        with conn.cursor() as cur:
            cur.execute(INIT_SQL)
        conn.commit()
        conn.close()
        print("[PostgreSQL] damage_analyses table ready ✓")
    except Exception as e:
        print(f"[PostgreSQL] damage table init warning: {e}")


def _save_damage_record(
    session_id:             str,
    frame_path:             str,
    input_type:             str,
    damage_report:          dict,
    analysis_model:         str,
    processing_time_ms:     float,
    media_info:             dict,
) -> bool:
    """Insert 1 record ke tabel damage_analyses."""
    try:
        conn = psycopg2.connect(POSTGRES_DSN)
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO damage_analyses (
                    session_id, input_type, frame_path,
                    damages, overall_condition, condition_score,
                    repair_urgency, estimated_damage_count, analysis_notes,
                    analysis_model, processing_time_ms, media_info
                ) VALUES (
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s
                )
            """, (
                session_id,
                input_type,
                frame_path,
                Json(damage_report.get("damages", [])),
                damage_report.get("overall_condition"),
                damage_report.get("condition_score"),
                damage_report.get("repair_urgency"),
                damage_report.get("estimated_damage_count", 0),
                damage_report.get("analysis_notes", ""),
                analysis_model,
                processing_time_ms,
                Json(media_info),
            ))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"[PostgreSQL] damage save failed: {e}")
        return False


async def save_damage_async(
    session_id:         str,
    frame:              np.ndarray,
    input_type:         str,
    damage_report:      dict,
    analysis_model:     str,
    processing_time_ms: float,
    media_info:         dict,
) -> bool:
    """
    Save frame ke MinIO + metadata ke PostgreSQL secara async (non-blocking).
    Retry up to MAX_RETRIES dengan exponential backoff.
    """
    def _save():
        frame_path = f"damage/{session_id}/frame.jpg"

        for attempt in range(1, MAX_RETRIES + 1):
            ok_frame = save_frame(frame, frame_path)
            if not ok_frame:
                if attempt < MAX_RETRIES:
                    delay = RETRY_DELAY * (2 ** (attempt - 1))
                    print(f"[DamageDataset] Frame save failed, retry in {delay}s (attempt {attempt})")
                    time.sleep(delay)
                continue

            ok_db = _save_damage_record(
                session_id         = session_id,
                frame_path         = frame_path,
                input_type         = input_type,
                damage_report      = damage_report,
                analysis_model     = analysis_model,
                processing_time_ms = processing_time_ms,
                media_info         = media_info,
            )

            if ok_db:
                print(f"[DamageDataset] Session {session_id} saved ✓ (attempt {attempt})")
                return True

            if attempt < MAX_RETRIES:
                delay = RETRY_DELAY * (2 ** (attempt - 1))
                time.sleep(delay)

        print(f"[DamageDataset] Session {session_id} save failed after {MAX_RETRIES} attempts ⚠")
        return False

    return await asyncio.to_thread(_save)