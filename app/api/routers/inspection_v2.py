"""
api/routers/inspection_v2.py — Async Vehicle Inspection Engine endpoints (Stage 6).

Endpoints:
  POST /inspection/analyze    → submit video, returns immediately with inspection_id
  GET  /inspection/status/:id → poll task lifecycle (pending/processing/done/failed)
  GET  /inspection/result/:id → fetch full inspection report once done
  GET  /inspection/history    → paginated history for the current user

All existing /compare, /analyze, /valuation routes in inspection.py are UNTOUCHED.
"""

import os
import asyncio
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, File, Form, UploadFile, HTTPException, Depends, Query, Request

from app.api.utils        import validate_video_upload
from app.api.schemas      import (
    InspectionSubmitResponse,
    InspectionStatusResponse,
)
from app.storage.auth     import get_current_user
from app.storage          import postgres as db
from app.inspection.worker import start_inspection_task
from app.storage.object_store import get_public_url

router = APIRouter(prefix="/inspection", tags=["Inspection Engine"])


# ─────────────────────────────────────────────────────────────────
# POST /inspection/analyze
# ─────────────────────────────────────────────────────────────────

@router.post("/analyze", response_model=InspectionSubmitResponse, status_code=202)
async def submit_inspection(
    request:    Request,
    file:       UploadFile = File(..., description="Inspection video (mp4/mov/mkv/avi)"),
    vehicle_id: Optional[str] = Form(None, description="Optional vehicle identifier (plate/VIN)"),
    current_user: dict = Depends(get_current_user),
):
    """
    Submit a single vehicle video for async inspection.

    Returns immediately (HTTP 202) with an inspection_id.
    Processing happens in the background — poll /inspection/status/{id}.
    """
    # Validate + stream to a temp file (reuse existing validated upload logic)
    tmp_path = await validate_video_upload(file, "file")

    user_id = current_user.get("user_id")

    # Create inspection record in DB (status = pending)
    inspection_id = db.create_inspection(
        user_id    = user_id,
        vehicle_id = vehicle_id,
        video_path = None,  # updated by worker after saving to object store
    )

    if not inspection_id:
        # Clean up temp file before raising
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise HTTPException(status_code=500, detail="Failed to create inspection record.")

    # Launch background task using Celery — non-blocking
    start_inspection_task.delay(
        inspection_id = inspection_id,
        video_path    = tmp_path,
        user_id       = user_id,
    )

    return InspectionSubmitResponse(
        inspection_id = inspection_id,
        status        = "pending",
        message       = "Video received. Processing in background.",
        poll_url      = f"/inspection/status/{inspection_id}",
    )


# ─────────────────────────────────────────────────────────────────
# GET /inspection/status/{inspection_id}
# ─────────────────────────────────────────────────────────────────

@router.get("/status/{inspection_id}", response_model=InspectionStatusResponse)
async def get_inspection_status(
    inspection_id: str,
    current_user:  dict = Depends(get_current_user),
):
    """
    Poll the lifecycle status of an inspection.

    Safe to call every 3–5 seconds. Returns progress counts
    so the mobile app can render a progress bar.
    """
    record = db.get_inspection_status(inspection_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Inspection not found.")

    return InspectionStatusResponse(**record)


# ─────────────────────────────────────────────────────────────────
# GET /inspection/result/{inspection_id}
# ─────────────────────────────────────────────────────────────────

@router.get("/result/{inspection_id}")
async def get_inspection_result(
    inspection_id: str,
    current_user:  dict = Depends(get_current_user),
):
    """
    Fetch the full inspection report.

    Call only after status == "done". Returns per-frame data including
    AI damage analysis and public URLs for each frame image.
    """
    record = db.get_inspection_result(inspection_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Inspection not found.")

    if record.get("status") not in ("done", "failed"):
        raise HTTPException(
            status_code=409,
            detail=f"Inspection is not yet complete (status: {record.get('status')})."
        )

    # Enrich frames with public CDN/presigned URLs
    for frame in record.get("frames", []):
        path = frame.get("frame_path")
        if path:
            frame["frame_url"] = get_public_url(path)
        else:
            frame["frame_url"] = None

    return record


# ─────────────────────────────────────────────────────────────────
# GET /inspection/history
# ─────────────────────────────────────────────────────────────────

@router.get("/history")
async def get_inspection_history(
    current_user: dict = Depends(get_current_user),
    page:         int  = Query(1,  ge=1,  description="Page number"),
    per_page:     int  = Query(20, ge=1, le=100, description="Items per page"),
):
    """
    Paginated inspection history for the authenticated user.

    Used by the mobile app to restore history after reinstall,
    and to show the user their past inspection list.
    """
    user_id = current_user.get("user_id")
    return db.get_inspection_history(user_id, page=page, per_page=per_page)
