"""
Vehicle Similarity Microservice — Stage 5 (Refactored)
======================================================
Clean FastAPI app — all pipeline logic imported from modules.
Includes rate limiting, upload size limits, and input validation.

Flow: Upload 2 video → extract → CLIP embed → similarity score
      → frame terbaik + skor → GPT-4o-mini → explanation → JSON
      → (background) save frames + metadata ke MinIO/PostgreSQL
"""

import os
import time
import tempfile
import asyncio
from uuid import uuid4
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# ── Config imports ──────────────────────────────
from app.config import (
    CLIP_MODEL_NAME,
    GPT_MODEL,
    EXTRACT_N_FRAMES,
    TOP_K_FRAMES,
    OPENAI_API_KEY,
    DATASET_SAVING_ENABLED,
    RATE_LIMIT,
    MAX_UPLOAD_SIZE_MB,
    MAX_VIDEO_DURATION_SEC,
    ALLOWED_ORIGINS,
)

# ── Pipeline imports ────────────────────────────
from app.pipeline.extractor import extract_frames_evenly, select_sharpest_frames
from app.pipeline.embedder import generate_embedding, DEVICE
from app.pipeline.similarity import compare_frame_sets, get_verdict, get_confidence
from app.pipeline.explainer import generate_explanation, frame_to_base64

# ── Storage imports ─────────────────────────────
from app.storage.postgres import init_db, close_db
from app.storage.dataset import save_dataset_async


# ─────────────────────────────────────────────
# Rate Limiter
# ─────────────────────────────────────────────

limiter = Limiter(key_func=get_remote_address)


# ─────────────────────────────────────────────
# Lifespan — Startup + Shutdown
# ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize DB pool on startup, close on shutdown."""
    init_db()
    print("[Server] Startup complete ✓")
    yield
    close_db()
    print("[Server] Shutdown complete ✓")


# ─────────────────────────────────────────────
# FastAPI App
# ─────────────────────────────────────────────

app = FastAPI(
    title="Vehicle Similarity API",
    description="AI-powered visual similarity — CLIP + GPT-4o-mini explanation",
    version="5.1.0",
    lifespan=lifespan,
)

# Attach rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# Response Schema
# ─────────────────────────────────────────────

class SimilarityResponse(BaseModel):
    session_id: str
    similarity_percentage: float
    confidence: str
    verdict: str
    explanation: str
    explanation_model: str
    video_a_info: dict
    video_b_info: dict
    frame_scores: List[float]
    frames_compared: int
    embedding_model: str
    device_used: str
    processing_time_ms: float
    stage: str
    note: str
    dataset_saved: bool
    best_frame_a: str
    best_frame_b: str


# ─────────────────────────────────────────────
# Helper — Upload Validation
# ─────────────────────────────────────────────

MAX_UPLOAD_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024

ALLOWED_MIME_TYPES = [
    "video/mp4", "video/avi", "video/mov", "video/mkv", "video/quicktime",
    "video/matroska", "video/x-matroska", "video/webm",
]


async def validate_and_save_upload(upload: UploadFile, label: str) -> str:
    """
    Validate upload (MIME type + file size) and save to a temp file.
    Returns the temp file path.
    Raises HTTPException on validation failure.
    """
    # Check MIME type
    if upload.content_type and upload.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"{label} harus berupa file video (mp4, avi, mov, mkv, webm). "
                f"Dapat: {upload.content_type}"
            ),
        )

    # Read file content with size check
    content = await upload.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=(
                f"{label} terlalu besar: {len(content) / (1024*1024):.1f}MB. "
                f"Maksimal {MAX_UPLOAD_SIZE_MB}MB."
            ),
        )

    # Save to temp file
    tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    tmp.write(content)
    tmp.flush()
    tmp.close()
    return tmp.name


# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "service":           "Vehicle Similarity API",
        "version":           "5.1.0",
        "status":            "running",
        "embedding_model":   CLIP_MODEL_NAME,
        "explanation_model": GPT_MODEL,
        "device":            DEVICE.upper(),
        "openai_ready":      bool(OPENAI_API_KEY),
        "endpoints": {
            "compare": "POST /compare — Upload 2 video, dapatkan similarity + AI explanation",
            "health":  "GET /health — Cek status service",
            "docs":    "GET /docs — Swagger UI",
        }
    }


@app.get("/health")
def health_check():
    return {
        "status":            "ok",
        "stage":             "Dataset-v1",
        "embedding_model":   CLIP_MODEL_NAME,
        "explanation_model": GPT_MODEL,
        "device":            DEVICE.upper(),
        "openai_ready":      bool(OPENAI_API_KEY),
        "config": {
            "extract_n_frames":      EXTRACT_N_FRAMES,
            "top_k_frames":          TOP_K_FRAMES,
            "max_upload_size_mb":    MAX_UPLOAD_SIZE_MB,
            "max_video_duration_sec": MAX_VIDEO_DURATION_SEC,
            "rate_limit":            RATE_LIMIT,
        }
    }


@app.post("/compare", response_model=SimilarityResponse)
@limiter.limit(RATE_LIMIT)
async def compare_vehicles(
    request: Request,
    video_a: UploadFile = File(..., description="Video kendaraan pertama"),
    video_b: UploadFile = File(..., description="Video kendaraan kedua"),
):
    """
    Bandingkan dua video kendaraan — CLIP similarity + GPT-4o-mini explanation.

    Flow:
    1. Validate & save uploaded videos
    2. Extract N frame merata per video
    3. Pilih K frame tersharp (Laplacian)
    4. CLIP encode → cosine similarity → average
    5. Kirim frame terbaik ke GPT-4o-mini → explanation
    6. (Background) Save frames + metadata ke MinIO/PostgreSQL
    7. Return JSON
    """
    start_time = time.time()

    # ── Validate + save uploads ─────────────────
    path_a = await validate_and_save_upload(video_a, "video_a")
    path_b = await validate_and_save_upload(video_b, "video_b")

    try:
        # Step 1: Extract N frame merata
        frames_a, info_a = extract_frames_evenly(path_a, n=EXTRACT_N_FRAMES)
        frames_b, info_b = extract_frames_evenly(path_b, n=EXTRACT_N_FRAMES)

        # Duration sanity check
        for info, label in [(info_a, "video_a"), (info_b, "video_b")]:
            if info["duration_sec"] > MAX_VIDEO_DURATION_SEC:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"{label} terlalu panjang: {info['duration_sec']}s. "
                        f"Maksimal {MAX_VIDEO_DURATION_SEC}s."
                    ),
                )

        # Step 2: Pilih K frame tersharp
        sharp_a, sharpness_a = select_sharpest_frames(frames_a, k=TOP_K_FRAMES)
        sharp_b, sharpness_b = select_sharpest_frames(frames_b, k=TOP_K_FRAMES)

        info_a["sharpness_scores"] = sharpness_a
        info_b["sharpness_scores"] = sharpness_b
        info_a["frames_used"]      = len(sharp_a)
        info_b["frames_used"]      = len(sharp_b)

        # Step 3: CLIP encode + compare (returns embeddings too!)
        avg_score, frame_scores, emb_a, emb_b = compare_frame_sets(sharp_a, sharp_b)
        verdict    = get_verdict(avg_score)
        confidence = get_confidence(frame_scores)

        # Step 4: GPT explanation — frame tersharp (index 0 = paling tajam)
        best_frame_a = sharp_a[0]
        best_frame_b = sharp_b[0]

        explanation, explanation_model = generate_explanation(
            frame_a          = best_frame_a,
            frame_b          = best_frame_b,
            similarity_score = avg_score,
            verdict          = verdict,
            confidence       = confidence,
        )

        processing_time = round((time.time() - start_time) * 1000, 2)

        # Generate session_id untuk tracking
        session_id = str(uuid4())

        # Step 5: Trigger async saving — non-blocking
        dataset_saved = False
        if DATASET_SAVING_ENABLED:
            try:
                asyncio.create_task(save_dataset_async(
                    session_id            = session_id,
                    frames_a              = sharp_a,
                    frames_b              = sharp_b,
                    embedding_a           = emb_a,
                    embedding_b           = emb_b,
                    avg_score             = avg_score,
                    verdict               = verdict,
                    confidence            = confidence,
                    frame_scores          = frame_scores,
                    embedding_model       = CLIP_MODEL_NAME,
                    explanation_model     = explanation_model,
                    device_used           = DEVICE.upper(),
                    processing_time_ms    = processing_time,
                    video_a_info          = info_a,
                    video_b_info          = info_b,
                ))
                dataset_saved = True
            except Exception as e:
                print(f"[Warning] Background save failed: {e}")
                dataset_saved = False

        return SimilarityResponse(
            session_id              = session_id,
            similarity_percentage   = avg_score,
            confidence              = confidence,
            verdict                 = verdict,
            explanation             = explanation,
            explanation_model       = explanation_model,
            video_a_info            = info_a,
            video_b_info            = info_b,
            frame_scores            = frame_scores,
            frames_compared         = len(frame_scores),
            embedding_model         = CLIP_MODEL_NAME,
            device_used             = DEVICE.upper(),
            processing_time_ms      = processing_time,
            stage                   = "Dataset-v1",
            note                    = "Stage 5: CLIP + GPT-4o-mini + dataset saving.",
            dataset_saved           = dataset_saved,
            best_frame_a            = f"data:image/jpeg;base64,{frame_to_base64(best_frame_a)}",
            best_frame_b            = f"data:image/jpeg;base64,{frame_to_base64(best_frame_b)}",
        )

    except HTTPException:
        raise  # re-raise validation errors as-is

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

    finally:
        for path in [path_a, path_b]:
            if os.path.exists(path):
                os.unlink(path)