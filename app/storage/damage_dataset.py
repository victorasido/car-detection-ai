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
    analysis_notes    TEXT,
    analysis_model    TEXT,

    -- System info
    processing_time_ms FLOAT,

    -- Media metadata
    media_info      JSONB        -- resolution, fps, dll
  );
"""

import asyncio
import time
import numpy as np
import psycopg2
from typing import Optional
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
    media_info             JSONB,
    user_id                UUID
);

CREATE INDEX IF NOT EXISTS idx_damage_sessions ON damage_analyses(session_id);
"""

def init_damage_table():
    from app.storage.postgres import get_pool
    pool = get_pool()
    if not pool: return
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(INIT_SQL)
        conn.commit()
    finally:
        pool.putconn(conn)

async def save_damage_async(
    session_id:         str,
    frame:              np.ndarray,
    input_type:         str,
    damage_report:      dict,
    analysis_model:     str,
    processing_time_ms: float,
    media_info:         dict,
    user_id:            Optional[str] = None,
):
    """
    Save results to MinIO (image) and PostgreSQL (metadata) asynchronously.
    """
    # 1. Save frame to MinIO
    object_key = f"damages/{session_id}.jpg"
    loop = asyncio.get_event_loop()
    success = await loop.run_in_executor(None, save_frame, frame, object_key)
    
    if not success:
        print(f"[DamageDataset] Failed to save frame to MinIO for {session_id}")
        return

    # 2. Save metadata to Postgres
    from app.storage.postgres import get_pool
    pool = get_pool()
    if not pool: return

    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO damage_analyses (
                    session_id, input_type, frame_path, damages, 
                    overall_condition, condition_score, repair_urgency, 
                    estimated_damage_count, analysis_notes, analysis_model,
                    processing_time_ms, media_info, user_id
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                session_id,
                input_type,
                object_key,
                Json(damage_report.get("damages", [])),
                damage_report.get("overall_condition", "unknown"),
                damage_report.get("condition_score", 0.0),
                damage_report.get("repair_urgency", "unknown"),
                damage_report.get("estimated_damage_count", 0),
                damage_report.get("notes", ""),
                analysis_model,
                processing_time_ms,
                Json(media_info),
                user_id
            ))
        conn.commit()
        print(f"[DamageDataset] Saved metadata for {session_id} ✓")
    except Exception as e:
        print(f"[DamageDataset] DB Save failed: {e}")
        conn.rollback()
    finally:
        pool.putconn(conn)


async def get_damage_history(
    limit:              int = 20,
    user_id:            Optional[str] = None,
) -> list:
    """
    Retrieve recent damage analysis history.
    """
    from app.storage.postgres import get_pool
    pool = get_pool()
    if not pool: return []

    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            if user_id:
                cur.execute("""
                    SELECT id, session_id, input_type, frame_path, damages, 
                           overall_condition, condition_score, repair_urgency, 
                           estimated_damage_count, created_at
                    FROM damage_analyses
                    WHERE user_id = %s
                    ORDER BY created_at DESC LIMIT %s
                """, (user_id, limit))
            else:
                cur.execute("""
                    SELECT id, session_id, input_type, frame_path, damages, 
                           overall_condition, condition_score, repair_urgency, 
                           estimated_damage_count, created_at
                    FROM damage_analyses
                    ORDER BY created_at DESC LIMIT %s
                """, (limit,))
            
            rows = cur.fetchall()
            return [
                {
                    "id": str(r[0]),
                    "session_id": r[1],
                    "input_type": r[2],
                    "frame_path": r[3],
                    "damages": r[4],
                    "overall_condition": r[5],
                    "condition_score": r[6],
                    "repair_urgency": r[7],
                    "estimated_damage_count": r[8],
                    "created_at": r[9].isoformat()
                } for r in rows
            ]
    except Exception as e:
        print(f"[DamageDataset] History fetch failed: {e}")
        return []
    finally:
        pool.putconn(conn)