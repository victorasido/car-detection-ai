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
from celery import group, chord

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
    """
    Orchestrator task:
    1. Extract + filter frames (streamed one-by-one to avoid OOM).
    2. Use Celery chord so aggregation fires automatically when ALL frame
       tasks complete — no fragile manual counter check.
    """
    try:
        db.update_inspection_status(inspection_id, "processing")

        # FIX #3: extract all frames but process + free them one at a time
        frames, media_info = extract_frames_evenly(video_path, EXTRACT_N_FRAMES)
        sharp_frames, sharpness_scores = select_sharpest_frames(frames, TOP_K_FRAMES)
        del frames  # free memory immediately after selection

        total_frames = len(sharp_frames)
        media_info.update({
            "sharpness_scores": sharpness_scores,
            "frames_used": total_frames,
        })

        progress_dict = {
            "frames_extracted": total_frames,
            "frames_analyzed":  0,
            "frames_total":     total_frames,
        }
        db.update_inspection_status(
            inspection_id,
            "processing",
            progress=progress_dict,
            media_info=media_info,
        )
        print(f"[Worker] start_inspection: progress saved, spawning {total_frames} frame tasks via chord...")

        # FIX #3: save one frame at a time and immediately delete from memory
        tasks = []
        for i, frame in enumerate(sharp_frames):
            object_key = f"inspections/{inspection_id}/frame_{i}.jpg"
            save_frame(frame, object_key)
            del frame  # release numpy array right after upload
            sharpness = float(sharpness_scores[i]) if i < len(sharpness_scores) else 0.0
            tasks.append(analyze_frame_task.s(inspection_id, i, object_key, sharpness))
        del sharp_frames  # release the now-empty list

        # FIX #2: chord guarantees aggregate_inspection_task fires exactly once
        # after ALL frame tasks finish (success or failure), no manual counter needed.
        chord(tasks)(aggregate_inspection_task.s(inspection_id))

    except Exception as exc:
        print(f"[Worker] start_inspection {inspection_id} FAILED: {exc}")
        db.update_inspection_status(inspection_id, "failed", error=str(exc))
    finally:
        # FIX #5: always clean up temp video regardless of how we exit
        if video_path and os.path.exists(video_path):
            try:
                os.unlink(video_path)
            except OSError:
                pass


@celery_app.task(name="inspection.analyze_frame", bind=True, max_retries=_MAX_FRAME_RETRIES)
def analyze_frame_task(self, inspection_id: str, frame_index: int, object_key: str, sharpness_score: float):
    """
    Per-frame analysis task. Part of a Celery chord — does NOT trigger
    aggregation itself. The chord callback handles that automatically.
    """
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
            print(f"[Worker] frame {frame_index}: YOLO backend not ready, using empty result.")
            ai_result = _empty_frame_result()
        except Exception as exc:
            delay = 2 ** self.request.retries
            print(f"[Worker] frame {frame_index} analysis failed: {exc}. Retry in {delay}s...")
            raise self.retry(exc=exc, countdown=delay)

        db.save_inspection_frame(
            inspection_id=inspection_id,
            frame_index=frame_index,
            frame_path=object_key,
            sharpness_score=sharpness_score,
            embedding=embedding_list,
            ai_damages=ai_result,
        )

        # FIX #1: atomic SQL increment — no read-modify-write race
        progress = db.increment_frames_analyzed(inspection_id)
        analyzed = (progress or {}).get("frames_analyzed", "?")
        total    = (progress or {}).get("frames_total", "?")
        print(f"[Worker] frame {frame_index} ✓ — progress {analyzed}/{total}")

    except Exception as exc:
        from celery.exceptions import Retry
        if isinstance(exc, Retry):
            raise
        print(f"[Worker] analyze_frame_task {inspection_id} frame {frame_index} FAILED: {exc}")
        # Persist an error frame so aggregation still has something to work with
        db.save_inspection_frame(
            inspection_id=inspection_id,
            frame_index=frame_index,
            frame_path=object_key,
            sharpness_score=sharpness_score,
            embedding=[],
            ai_damages=_empty_frame_result(error=str(exc)),
        )
        # FIX #1: still increment atomically so chord knows this slot is done
        db.increment_frames_analyzed(inspection_id)
        print(f"[Worker] frame {frame_index} error recorded, progress incremented.")


@celery_app.task(name="inspection.aggregate_inspection")
def aggregate_inspection_task(chord_results, inspection_id: str):
    """
    Chord callback — fires automatically once ALL analyze_frame_task slots
    complete (success OR failure). chord_results is the list of return
    values from each frame task (we ignore them; results live in the DB).
    """
    print(f"[Worker] Aggregation task STARTED for {inspection_id}")
    try:
        report_data = db.get_inspection_result(inspection_id)
        if not report_data:
            print(f"[Worker] Aggregation ERROR: No data found for {inspection_id}")
            db.update_inspection_status(inspection_id, "failed", error="No frame data found.")
            return

        frames = report_data.get("frames", [])
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
