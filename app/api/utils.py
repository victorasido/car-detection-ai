import os
import tempfile
import cv2
import numpy as np
from fastapi import UploadFile, HTTPException
from app.config import (
    MAX_UPLOAD_SIZE_MB, EXTRACT_N_FRAMES, MAX_VIDEO_DURATION_SEC, 
    SELECT_SHARPEST_FRAMES_K
)
from app.pipeline.extractor import extract_frames_evenly, select_sharpest_frames

MAX_UPLOAD_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024
UPLOAD_CHUNK_SIZE = 1024 * 1024

ALLOWED_VIDEO_TYPES = [
    "video/mp4", "video/avi", "video/mov", "video/mkv",
    "video/quicktime", "video/matroska", "video/x-matroska", "video/webm",
]

ALLOWED_IMAGE_TYPES = [
    "image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic",
]

async def validate_video_upload(upload: UploadFile, label: str) -> str:
    if upload.content_type and upload.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"{label} harus berupa file video. Dapat: {upload.content_type}"
        )
    return await _persist_upload_to_temp(upload, label, ".mp4")

async def validate_any_upload(upload: UploadFile, label: str) -> tuple[str, str]:
    content_type = upload.content_type or ""
    if content_type in ALLOWED_VIDEO_TYPES:
        input_type, suffix = "video", ".mp4"
    elif content_type in ALLOWED_IMAGE_TYPES:
        input_type, suffix = "photo", ".jpg"
    else:
        raise HTTPException(
            status_code=400,
            detail=f"{label} harus foto (jpg/png/webp) atau video (mp4/mov/mkv). Dapat: {content_type}"
        )
    return await _persist_upload_to_temp(upload, label, suffix), input_type

async def _persist_upload_to_temp(upload: UploadFile, label: str, suffix: str) -> str:
    total_bytes = 0
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        while True:
            chunk = await upload.read(UPLOAD_CHUNK_SIZE)
            if not chunk:
                break
            total_bytes += len(chunk)
            if total_bytes > MAX_UPLOAD_BYTES:
                raise HTTPException(status_code=413, detail=f"{label} terlalu besar. Maksimal {MAX_UPLOAD_SIZE_MB}MB.")
            tmp.write(chunk)
        tmp.flush()
        tmp.close()
        await upload.seek(0)
        return tmp.name
    except Exception:
        tmp.close()
        if os.path.exists(tmp.name):
            os.unlink(tmp.name)
        raise

def _decode_image_from_path(path: str) -> np.ndarray:
    data = np.fromfile(path, dtype=np.uint8)
    frame = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Tidak bisa membaca file gambar.")
    return frame

def prepare_best_frame(path: str, input_type: str) -> tuple[np.ndarray, dict]:
    if input_type == "video":
        frames, media_info = extract_frames_evenly(path, n=EXTRACT_N_FRAMES)
        if media_info["duration_sec"] > MAX_VIDEO_DURATION_SEC:
            raise ValueError(f"Video terlalu panjang: {media_info['duration_sec']}s. Maksimal {MAX_VIDEO_DURATION_SEC}s.")
        sharp_frames, sharpness_scores = select_sharpest_frames(frames, k=1)
        best_frame = sharp_frames[0]
        media_info.update({"sharpness_scores": sharpness_scores, "frames_used": 1})
        return best_frame, media_info
    best_frame = _decode_image_from_path(path)
    h, w = best_frame.shape[:2]
    media_info = {
        "resolution": f"{w}x{h}",
        "input_type": "photo",
        "frames_extracted": 1,
        "frames_used": 1,
    }
    return best_frame, media_info
