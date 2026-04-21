"""
inspection/worker.py — Async background task runner for an inspection using Celery.

Pipeline:
  1. start_inspection_task: marks "processing", extracts frames, triggers analysis.
  2. analyze_frame_task: runs AI per-frame, persists to DB.
  3. check_aggregation_task: manual aggregation check after each frame is analyzed.
"""

import os
import time
from typing import Optional
from celery import group

from app.config import (
    EXTRACT_N_FRAMES,
    TOP_K_FRAMES,
    DATASET_SAVING_ENABLED,
    DEVICE,
)
from app.pipeline.extractor import extract_frames_evenly, select_sharpest_frames
from app.pipeline.embedder import generate_embedding
from app.pipeline.inspection_analyzer import analyze_frame, DAMAGE_MODEL
from app.inspection.aggregator import aggregate_results
from app.storage.object_store import save_frame
from app.storage import postgres as db
from app.inspection.celery_app import celery_app

_MAX_FRAME_RETRIES = 3


@celery_app.task(name="inspection.start_inspection")
def start_inspection_task(inspection_id: str, video_path: str, user_id: Optional[str] = None):
    start_time = time.time()
    try:
        db.update_inspection_status(inspection_id, "processing")

        frames, media_info = extract_frames_evenly(video_path, EXTRACT_N_FRAMES)
        sharp_frames, sharpness_scores = select_sharpest_frames(frames, TOP_K_FRAMES)

        total_frames = len(sharp_frames)
        media_info.update({
            "sharpness_scores": sharpness_scores,
            "frames_used": total_frames,
        })

        db.update_inspection_status(
            inspection_id,
            "processing",
            progress={
                "frames_extracted": total_frames,
                "frames_analyzed":  0,
                "frames_total":     total_frames,
            },
            media_info=media_info
        )

        # Build group of per-frame tasks
        tasks = []
        for i, frame in enumerate(sharp_frames):
            object_key = f"inspections/{inspection_id}/frame_{i}.jpg"
            if DATASET_SAVING_ENABLED:
                save_frame(frame, object_key)
            
            # Since we can't pass numpy arrays through celery, we pass the object_key 
            # and let the next task download it. 
            # But wait, local minio makes it fast!
            # However, the previous implementation did it all in-memory.
            # To emulate in-memory (Phase 1, keep it fast), we can't spawn a separate Celery task per frame 
            # if we pass large numpy arrays, unless we use redis backed by pickle, which is unsafe.
            # INSTEAD: we save to object_store, and the worker task downloads it.
            # Or better yet, we just run the per-frame loop IN THIS TASK as Phase 1 Celery "group" is tricky if we don't pass bytes.
            # Wait, user said: "Use Celery group + manual aggregation check (simpler)". 
            # So I must pass the frame... as bytes or via MinIO. I will pass the object_key.
            tasks.append(analyze_frame_task.s(inspection_id, i, object_key, float(sharpness_scores[i]) if i < len(sharpness_scores) else 0.0))

        # Start the group
        group(tasks).apply_async()

    except Exception as exc:
        print(f"[Worker] start_inspection {inspection_id} FAILED: {exc}")
        db.update_inspection_status(inspection_id, "failed", error=str(exc))
    finally:
        if video_path and os.path.exists(video_path):
            try:
                os.unlink(video_path)
            except OSError:
                pass


@celery_app.task(name="inspection.analyze_frame", bind=True, max_retries=_MAX_FRAME_RETRIES)
def analyze_frame_task(self, inspection_id: str, frame_index: int, object_key: str, sharpness_score: float):
    try:
        from app.storage.object_store import get_frame_data
        import numpy as np
        import cv2
        
        # Download frame from MinIO
        frame_bytes = get_frame_data(object_key)
        if not frame_bytes:
            raise Exception(f"Could not download frame {object_key} from MinIO")
            
        np_arr = np.frombuffer(frame_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        embedding = generate_embedding(frame)
        embedding_list = embedding.tolist()

        try:
            ai_result = analyze_frame(frame)
        except NotImplementedError:
            print(f"[Worker] analyze_frame NotImplementedError — backend not ready, skipping.")
            ai_result = _empty_frame_result()
        except Exception as exc:
            delay = 2 ** self.request.retries
            print(f"[Worker] analyze_frame attempt failed: {exc}. Retrying in {delay}s...")
            raise self.retry(exc=exc, countdown=delay)

        db.save_inspection_frame(
            inspection_id=inspection_id,
            frame_index=frame_index,
            frame_path=object_key,
            sharpness_score=sharpness_score,
            embedding=embedding_list,
            ai_damages=ai_result,
        )

        # Update progress
        status = db.get_inspection_status(inspection_id)
        if status:
            progress = status.get("progress", {})
            analyzed = progress.get("frames_analyzed", 0) + 1
            total = progress.get("frames_total", -1)
            
            progress["frames_analyzed"] = analyzed
            db.update_inspection_status(inspection_id, "processing", progress=progress)

            # Manual aggregation check
            if analyzed >= total and total > 0:
                aggregate_inspection_task.delay(inspection_id)

    except Exception as exc:
        if isinstance(exc, self.retry.Retry):
            raise
        print(f"[Worker] analyze_frame_task {inspection_id} frame {frame_index} FAILED: {exc}")
        ai_result = _empty_frame_result(error=str(exc))
        db.save_inspection_frame(
            inspection_id=inspection_id,
            frame_index=frame_index,
            frame_path=object_key,
            sharpness_score=sharpness_score,
            embedding=[],
            ai_damages=ai_result,
        )


@celery_app.task(name="inspection.aggregate_inspection")
def aggregate_inspection_task(inspection_id: str):
    try:
        report_data = db.get_inspection_result(inspection_id)
        if not report_data:
            return
            
        frames = report_data.get("frames", [])
        
        # Build frame results list
        frame_results = [
            {"frame_id": f["frame_id"], "ai_result": f["ai_damages"]}
            for f in frames
        ]
        
        report = aggregate_results(frame_results)
        db.save_inspection_result(inspection_id, report)

        db.update_inspection_status(
            inspection_id,
            "done",
            analysis_model=DAMAGE_MODEL,
            device_used=DEVICE.upper(),
        )
        print(f"[Worker] Inspection {inspection_id} aggregation complete ✓")
    except Exception as exc:
        print(f"[Worker] Inspection {inspection_id} aggregation FAILED: {exc}")
        db.update_inspection_status(inspection_id, "failed", error=str(exc))


def _empty_frame_result(error: Optional[str] = None) -> dict:
    return {
        "damages":           [],
        "overall_condition": "unknown",
        "condition_score":   0.0,
        "repair_urgency":    "none",
        "_error":            error,
    }
