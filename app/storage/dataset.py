"""
storage/dataset.py — Async orchestrator: save frame + metadata with retry
"""

import asyncio
import time
import numpy as np
from app.storage.minio    import save_frame
from app.storage.postgres import save_metadata


MAX_RETRIES = 3
RETRY_DELAY = 1.0  # seconds, doubles per retry (exponential backoff)


async def save_dataset_async(
    session_id:         str,
    best_frame_a:       np.ndarray,
    best_frame_b:       np.ndarray,
    embedding_a:        list,
    embedding_b:        list,
    avg_score:          float,
    verdict:            str,
    confidence:         str,
    frame_scores:       list,
    embedding_model:    str,
    explanation_model:  str,
    device_used:        str,
    processing_time_ms: float,
    video_a_info:       dict,
    video_b_info:       dict,
) -> bool:
    """
    Save dataset di background thread — non-blocking.
    Retries up to 3 times with exponential backoff on failure.
    """
    def _save():
        frame_a_path = f"{session_id}/frame_a.jpg"
        frame_b_path = f"{session_id}/frame_b.jpg"

        for attempt in range(1, MAX_RETRIES + 1):
            ok_a  = save_frame(best_frame_a, frame_a_path)
            ok_b  = save_frame(best_frame_b, frame_b_path)
            ok_db = save_metadata(
                session_id            = session_id,
                similarity_percentage = avg_score,
                verdict               = verdict,
                confidence            = confidence,
                frame_scores          = frame_scores,
                frames_compared       = len(frame_scores),
                frame_a_path          = frame_a_path,
                frame_b_path          = frame_b_path,
                embedding_a           = embedding_a,
                embedding_b           = embedding_b,
                embedding_model       = embedding_model,
                explanation_model     = explanation_model,
                device_used           = device_used,
                processing_time_ms    = processing_time_ms,
                video_a_info          = video_a_info,
                video_b_info          = video_b_info,
            )

            if ok_a and ok_b and ok_db:
                print(f"[Dataset] Session {session_id} saved ✓ (attempt {attempt})")
                return True

            if attempt < MAX_RETRIES:
                delay = RETRY_DELAY * (2 ** (attempt - 1))
                print(f"[Dataset] Session {session_id} save incomplete, retrying in {delay}s (attempt {attempt}/{MAX_RETRIES})")
                time.sleep(delay)

        print(f"[Dataset] Session {session_id} save failed after {MAX_RETRIES} attempts ⚠")
        return False

    return await asyncio.to_thread(_save)