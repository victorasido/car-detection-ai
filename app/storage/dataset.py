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
    frames_a:           list,  # List[np.ndarray]
    frames_b:           list,  # List[np.ndarray]
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
    Saves all frames used in comparison to MinIO.
    Retries up to 3 times with exponential backoff on failure.
    """
    def _save():
        # List to keep track of successful paths
        paths_a = []
        paths_b = []

        for attempt in range(1, MAX_RETRIES + 1):
            success_a = True
            success_b = True
            current_paths_a = []
            current_paths_b = []

            # Save frames A
            for i, frame in enumerate(frames_a):
                path = f"{session_id}/frame_a_{i}.jpg"
                if save_frame(frame, path):
                    current_paths_a.append(path)
                else:
                    success_a = False
                    break

            # Save frames B
            if success_a:
                for i, frame in enumerate(frames_b):
                    path = f"{session_id}/frame_b_{i}.jpg"
                    if save_frame(frame, path):
                        current_paths_b.append(path)
                    else:
                        success_b = False
                        break

            if success_a and success_b:
                ok_db = save_metadata(
                    session_id            = session_id,
                    similarity_percentage = avg_score,
                    verdict               = verdict,
                    confidence            = confidence,
                    frame_scores          = frame_scores,
                    frames_compared       = len(frame_scores),
                    frame_a_paths         = current_paths_a,
                    frame_b_paths         = current_paths_b,
                    embedding_a           = embedding_a,
                    embedding_b           = embedding_b,
                    embedding_model       = embedding_model,
                    explanation_model     = explanation_model,
                    device_used           = device_used,
                    processing_time_ms    = processing_time_ms,
                    video_a_info          = video_a_info,
                    video_b_info          = video_b_info,
                )
                if ok_db:
                    print(f"[Dataset] Session {session_id} saved ({len(current_paths_a) + len(current_paths_b)} frames) ✓ (attempt {attempt})")
                    return True

            if attempt < MAX_RETRIES:
                delay = RETRY_DELAY * (2 ** (attempt - 1))
                print(f"[Dataset] Session {session_id} save incomplete, retrying in {delay}s (attempt {attempt}/{MAX_RETRIES})")
                time.sleep(delay)

        print(f"[Dataset] Session {session_id} save failed after {MAX_RETRIES} attempts ⚠")
        return False

    return await asyncio.to_thread(_save)