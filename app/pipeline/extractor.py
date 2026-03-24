"""
pipeline/extractor.py — Frame extraction + sharpness filter
"""

import cv2
import numpy as np
from app.config import EXTRACT_N_FRAMES, TOP_K_FRAMES


def extract_frames_evenly(video_path: str, n: int = EXTRACT_N_FRAMES) -> tuple:
    """Ekstrak N frame tersebar merata sepanjang video."""
    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        raise ValueError(f"Tidak bisa membuka video: {video_path}")

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps          = cap.get(cv2.CAP_PROP_FPS)
    width        = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height       = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration_sec = total_frames / fps if fps > 0 else 0

    if total_frames == 0:
        raise ValueError("Video tidak memiliki frame (corrupt atau kosong)")

    actual_n  = min(n, total_frames)
    positions = np.linspace(0, total_frames - 1, actual_n + 2, dtype=int)[1:-1]

    frames = []
    for pos in positions:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(pos))
        ret, frame = cap.read()
        if ret and frame is not None:
            frames.append(frame)

    cap.release()

    if not frames:
        raise ValueError("Tidak berhasil mengekstrak frame apapun dari video")

    info = {
        "total_frames":     total_frames,
        "fps":              round(fps, 2),
        "resolution":       f"{width}x{height}",
        "duration_sec":     round(duration_sec, 2),
        "frames_extracted": len(frames),
        "frame_positions":  [int(p) for p in positions[:len(frames)]],
    }

    return frames, info


def compute_sharpness(frame: np.ndarray) -> float:
    """Laplacian variance — makin tinggi makin tajam."""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def select_sharpest_frames(frames: list, k: int = TOP_K_FRAMES) -> tuple:
    """Pilih K frame tersharp dari list frames."""
    scores        = [(i, compute_sharpness(f)) for i, f in enumerate(frames)]
    scores_sorted = sorted(scores, key=lambda x: x[1], reverse=True)
    top_indices   = [i for i, _ in scores_sorted[:k]]
    selected      = [frames[i] for i in top_indices]
    all_sharpness = [round(s, 2) for _, s in scores]
    return selected, all_sharpness