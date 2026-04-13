"""
Vehicle Inspection API — Stage 5.2
====================================
Endpoints:
  POST /compare  — Vehicle similarity (CLIP + GPT-4o-mini)
  POST /analyze  — Damage detection (GPT-4o Vision) ← BARU
  GET  /health   — Health check
  GET  /docs     — Swagger UI
"""

import os
import time
import tempfile
import asyncio
import cv2
import numpy as np
from uuid import uuid4
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import (
    CLIP_MODEL_NAME, GPT_MODEL, EXTRACT_N_FRAMES, TOP_K_FRAMES,
    OPENAI_API_KEY, DATASET_SAVING_ENABLED, RATE_LIMIT,
    MAX_UPLOAD_SIZE_MB, MAX_VIDEO_DURATION_SEC, ALLOWED_ORIGINS,
)
from app.pipeline.extractor       import extract_frames_evenly, select_sharpest_frames
from app.pipeline.embedder        import DEVICE
from app.pipeline.similarity      import compare_frame_sets, get_verdict, get_confidence
from app.pipeline.explainer       import generate_explanation, frame_to_base64
from app.pipeline.damage_analyzer import analyze_damage, DAMAGE_MODEL
from app.pipeline.valuation       import estimate_vehicle_value
from app.storage.postgres         import init_db, close_db
from app.storage.dataset          import save_dataset_async
from app.storage.damage_dataset   import init_damage_table, save_damage_async


# ─────────────────────────────────────────────
# Rate Limiter + App
# ─────────────────────────────────────────────

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    init_damage_table()
    print("[Server] Startup complete ✓")
    yield
    close_db()
    print("[Server] Shutdown complete ✓")


app = FastAPI(
    title       = "Vehicle Inspection API",
    description = "AI-powered vehicle inspection — similarity + damage detection",
    version     = "5.2.0",
    lifespan    = lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_methods=["*"], allow_headers=["*"])


# ─────────────────────────────────────────────
# Response Schemas
# ─────────────────────────────────────────────

class SimilarityResponse(BaseModel):
    session_id:            str
    similarity_percentage: float
    confidence:            str
    verdict:               str
    explanation:           str
    explanation_model:     str
    video_a_info:          dict
    video_b_info:          dict
    frame_scores:          List[float]
    frames_compared:       int
    embedding_model:       str
    device_used:           str
    processing_time_ms:    float
    stage:                 str
    note:                  str
    dataset_saved:         bool
    best_frame_a:          str
    best_frame_b:          str


class DamageItem(BaseModel):
    type:        str
    severity:    str
    location:    str
    description: str


class DamageResponse(BaseModel):
    session_id:             str
    input_type:             str
    damages:                List[DamageItem]
    overall_condition:      str
    condition_score:        float
    repair_urgency:         str
    estimated_damage_count: int
    analysis_notes:         str
    analysis_model:         str
    processing_time_ms:     float
    dataset_saved:          bool
    best_frame:             str


class ValuationAdjustment(BaseModel):
    label:  str
    type:   str
    amount: float
    note:   str


class ValuationResponse(BaseModel):
    session_id:             str
    input_type:             str
    damages:                List[DamageItem]
    overall_condition:      str
    condition_score:        float
    repair_urgency:         str
    estimated_damage_count: int
    estimated_value:        float
    estimated_value_min:    float
    estimated_value_max:    float
    reference_price:        float
    currency:               str
    pricing_confidence:     str
    pricing_notes:          str
    adjustment_breakdown:   List[ValuationAdjustment]
    analysis_model:         str
    processing_time_ms:     float
    dataset_saved:          bool
    best_frame:             str


# ─────────────────────────────────────────────
# Upload Validation Helpers
# ─────────────────────────────────────────────

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
    """Validasi video upload. Return temp file path."""
    if upload.content_type and upload.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"{label} harus berupa file video. Dapat: {upload.content_type}"
        )
    return await _persist_upload_to_temp(upload, label, ".mp4")


async def validate_any_upload(upload: UploadFile, label: str) -> tuple[str, str]:
    """
    Validasi foto atau video. Return (temp_file_path, input_type).
    input_type = "photo" atau "video"
    """
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
    """Stream upload to a temp file to avoid reading the full body into RAM."""
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
    """Load the best frame from uploaded photo/video for downstream analysis."""
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


# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "service":        "Vehicle Inspection API",
        "version":        "5.2.0",
        "status":         "running",
        "openai_ready":   bool(OPENAI_API_KEY),
        "dataset_saving": DATASET_SAVING_ENABLED,
        "endpoints": {
            "compare": "POST /compare — 2 video → similarity score",
            "analyze": "POST /analyze — foto/video → damage detection",
            "valuation": "POST /valuation - foto/video + harga referensi -> estimasi nilai",
            "health":  "GET /health",
            "docs":    "GET /docs",
        }
    }


@app.get("/health")
def health_check():
    return {
        "status":          "ok",
        "version":         "5.2.0",
        "embedding_model": CLIP_MODEL_NAME,
        "damage_model":    DAMAGE_MODEL,
        "device":          DEVICE.upper(),
        "openai_ready":    bool(OPENAI_API_KEY),
        "dataset_saving":  DATASET_SAVING_ENABLED,
    }


@app.post("/compare", response_model=SimilarityResponse)
@limiter.limit(RATE_LIMIT)
async def compare_vehicles(
    request: Request,
    video_a: UploadFile = File(..., description="Video kendaraan pertama"),
    video_b: UploadFile = File(..., description="Video kendaraan kedua"),
):
    """Bandingkan 2 video kendaraan — CLIP similarity + GPT-4o-mini explanation."""
    start_time = time.time()
    path_a = await validate_video_upload(video_a, "video_a")
    path_b = await validate_video_upload(video_b, "video_b")

    try:
        frames_a, info_a = extract_frames_evenly(path_a, n=EXTRACT_N_FRAMES)
        frames_b, info_b = extract_frames_evenly(path_b, n=EXTRACT_N_FRAMES)

        for info, label in [(info_a, "video_a"), (info_b, "video_b")]:
            if info["duration_sec"] > MAX_VIDEO_DURATION_SEC:
                raise HTTPException(status_code=400, detail=f"{label} terlalu panjang. Maksimal {MAX_VIDEO_DURATION_SEC}s.")

        sharp_a, sharpness_a = select_sharpest_frames(frames_a, k=TOP_K_FRAMES)
        sharp_b, sharpness_b = select_sharpest_frames(frames_b, k=TOP_K_FRAMES)

        info_a.update({"sharpness_scores": sharpness_a, "frames_used": len(sharp_a)})
        info_b.update({"sharpness_scores": sharpness_b, "frames_used": len(sharp_b)})

        avg_score, frame_scores, emb_a, emb_b = compare_frame_sets(sharp_a, sharp_b)
        verdict    = get_verdict(avg_score)
        confidence = get_confidence(frame_scores)

        best_frame_a = sharp_a[0]
        best_frame_b = sharp_b[0]

        explanation, explanation_model = generate_explanation(
            frame_a=best_frame_a, frame_b=best_frame_b,
            similarity_score=avg_score, verdict=verdict, confidence=confidence,
        )

        processing_time = round((time.time() - start_time) * 1000, 2)
        session_id      = str(uuid4())

        dataset_saved = False
        if DATASET_SAVING_ENABLED:
            try:
                asyncio.create_task(save_dataset_async(
                    session_id=session_id, frames_a=sharp_a, frames_b=sharp_b,
                    embedding_a=emb_a, embedding_b=emb_b, avg_score=avg_score,
                    verdict=verdict, confidence=confidence, frame_scores=frame_scores,
                    embedding_model=CLIP_MODEL_NAME, explanation_model=explanation_model,
                    device_used=DEVICE.upper(), processing_time_ms=processing_time,
                    video_a_info=info_a, video_b_info=info_b,
                ))
                dataset_saved = True
            except Exception as e:
                print(f"[Warning] Compare dataset save failed: {e}")

        return SimilarityResponse(
            session_id=session_id, similarity_percentage=avg_score,
            confidence=confidence, verdict=verdict, explanation=explanation,
            explanation_model=explanation_model, video_a_info=info_a, video_b_info=info_b,
            frame_scores=frame_scores, frames_compared=len(frame_scores),
            embedding_model=CLIP_MODEL_NAME, device_used=DEVICE.upper(),
            processing_time_ms=processing_time, stage="Dataset-v1",
            note="Stage 5: CLIP + GPT-4o-mini + dataset saving.",
            dataset_saved=dataset_saved,
            best_frame_a=f"data:image/jpeg;base64,{frame_to_base64(best_frame_a)}",
            best_frame_b=f"data:image/jpeg;base64,{frame_to_base64(best_frame_b)}",
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")
    finally:
        for path in [path_a, path_b]:
            if os.path.exists(path):
                os.unlink(path)


@app.post("/analyze", response_model=DamageResponse)
@limiter.limit(RATE_LIMIT)
async def analyze_vehicle(
    request: Request,
    file: UploadFile = File(..., description="Foto atau video kendaraan"),
):
    """
    Analisa kerusakan kendaraan dari foto atau video.

    - Foto (jpg/png/webp): langsung dianalisa
    - Video (mp4/mov/mkv): extract frame tersharp, lalu analisa

    Return: damage list, condition score (0-10), repair urgency, analysis notes.
    """
    start_time = time.time()
    tmp_path   = None

    try:
        # Step 1: Validate & save
        tmp_path, input_type = await validate_any_upload(file, "file")

        # Step 2: Dapatkan frame terbaik
        if input_type == "video":
            frames, media_info = extract_frames_evenly(tmp_path, n=EXTRACT_N_FRAMES)

            if media_info["duration_sec"] > MAX_VIDEO_DURATION_SEC:
                raise HTTPException(
                    status_code=400,
                    detail=f"Video terlalu panjang: {media_info['duration_sec']}s. Maksimal {MAX_VIDEO_DURATION_SEC}s."
                )

            sharp_frames, sharpness_scores = select_sharpest_frames(frames, k=1)
            best_frame = sharp_frames[0]
            media_info.update({"sharpness_scores": sharpness_scores, "frames_used": 1})

        else:
            # Foto — baca langsung
            img_array  = np.frombuffer(open(tmp_path, "rb").read(), dtype=np.uint8)
            best_frame = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

            if best_frame is None:
                raise HTTPException(status_code=422, detail="Tidak bisa membaca file gambar.")

            h, w = best_frame.shape[:2]
            media_info = {
                "resolution":       f"{w}x{h}",
                "input_type":       "photo",
                "frames_extracted": 1,
                "frames_used":      1,
            }

        # Step 3: GPT-4o Vision → damage analysis
        damage_report, analysis_model = await asyncio.to_thread(analyze_damage, best_frame)

        processing_time = round((time.time() - start_time) * 1000, 2)
        session_id      = str(uuid4())

        # Step 4: Save dataset background
        dataset_saved = False
        if DATASET_SAVING_ENABLED:
            try:
                asyncio.create_task(save_damage_async(
                    session_id         = session_id,
                    frame              = best_frame.copy(),
                    input_type         = input_type,
                    damage_report      = damage_report,
                    analysis_model     = analysis_model,
                    processing_time_ms = processing_time,
                    media_info         = media_info,
                ))
                dataset_saved = True
            except Exception as e:
                print(f"[Warning] Damage dataset save failed: {e}")

        # Step 5: Return
        return DamageResponse(
            session_id             = session_id,
            input_type             = input_type,
            damages                = damage_report.get("damages", []),
            overall_condition      = damage_report.get("overall_condition", "unknown"),
            condition_score        = damage_report.get("condition_score", 0.0),
            repair_urgency         = damage_report.get("repair_urgency", "unknown"),
            estimated_damage_count = damage_report.get("estimated_damage_count", 0),
            analysis_notes         = damage_report.get("analysis_notes", ""),
            analysis_model         = analysis_model,
            processing_time_ms     = processing_time,
            dataset_saved          = dataset_saved,
            best_frame             = f"data:image/jpeg;base64,{frame_to_base64(best_frame)}",
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


@app.post("/valuation", response_model=ValuationResponse)
@limiter.limit(RATE_LIMIT)
async def valuate_vehicle(
    request: Request,
    file: UploadFile = File(..., description="Foto atau video kendaraan"),
    reference_price: float = Form(..., description="Harga referensi kendaraan dalam kondisi normal"),
    manufacture_year: Optional[int] = Form(None, description="Tahun kendaraan"),
    mileage_km: Optional[int] = Form(None, description="Kilometer kendaraan"),
    currency: str = Form("IDR", description="Kode mata uang"),
):
    """
    Estimasi nilai kendaraan menggunakan foto/video, hasil damage analysis,
    dan harga referensi yang diberikan client.
    """
    start_time = time.time()
    tmp_path = None

    try:
        tmp_path, input_type = await validate_any_upload(file, "file")

        try:
            best_frame, media_info = await asyncio.to_thread(prepare_best_frame, tmp_path, input_type)
        except ValueError as e:
            message = str(e)
            status_code = 400 if "terlalu panjang" in message else 422
            raise HTTPException(status_code=status_code, detail=message)

        damage_report, analysis_model = await asyncio.to_thread(analyze_damage, best_frame)
        valuation = estimate_vehicle_value(
            reference_price=reference_price,
            damage_report=damage_report,
            manufacture_year=manufacture_year,
            mileage_km=mileage_km,
            currency=currency,
        )

        processing_time = round((time.time() - start_time) * 1000, 2)
        session_id = str(uuid4())

        media_info.update(
            {
                "reference_price": reference_price,
                "manufacture_year": manufacture_year,
                "mileage_km": mileage_km,
                "currency": currency.upper(),
            }
        )

        dataset_saved = False
        if DATASET_SAVING_ENABLED:
            try:
                asyncio.create_task(
                    save_damage_async(
                        session_id=session_id,
                        frame=best_frame.copy(),
                        input_type=input_type,
                        damage_report=damage_report,
                        analysis_model=analysis_model,
                        processing_time_ms=processing_time,
                        media_info=media_info,
                    )
                )
                dataset_saved = True
            except Exception as e:
                print(f"[Warning] Valuation dataset save failed: {e}")

        return ValuationResponse(
            session_id=session_id,
            input_type=input_type,
            damages=damage_report.get("damages", []),
            overall_condition=damage_report.get("overall_condition", "unknown"),
            condition_score=damage_report.get("condition_score", 0.0),
            repair_urgency=damage_report.get("repair_urgency", "unknown"),
            estimated_damage_count=damage_report.get("estimated_damage_count", 0),
            estimated_value=valuation["estimated_value"],
            estimated_value_min=valuation["estimated_value_min"],
            estimated_value_max=valuation["estimated_value_max"],
            reference_price=valuation["reference_price"],
            currency=valuation["currency"],
            pricing_confidence=valuation["pricing_confidence"],
            pricing_notes=valuation["pricing_notes"],
            adjustment_breakdown=valuation["adjustment_breakdown"],
            analysis_model=analysis_model,
            processing_time_ms=processing_time,
            dataset_saved=dataset_saved,
            best_frame=f"data:image/jpeg;base64,{frame_to_base64(best_frame)}",
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
