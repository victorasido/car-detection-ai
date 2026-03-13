"""
Vehicle Similarity Microservice — Stage 4
==========================================
Upgrade dari Stage 3:
  - GPT-4o-mini generate natural language explanation
  - Frame tersharp dikirim ke GPT sebagai gambar (base64)
  - Explanation kontekstual: mempertimbangkan skor + visual frame
  - API key via environment variable OPENAI_API_KEY
  - Explanation opsional: kalau API key tidak ada, tetap return JSON normal

Semua logic Stage 3 tetap utuh:
  - CLIP ViT-B/32 semantic embedding
  - 5 frame extraction merata
  - Sharpness filter Laplacian (pilih 3 terbaik)
  - Average cosine similarity + confidence

Flow: Upload 2 video → extract → CLIP embed → similarity score
      → frame terbaik + skor → GPT-4o-mini → explanation → JSON
"""

import cv2
import numpy as np
import tempfile
import os
import time
import base64
import torch
import clip
from PIL import Image
from openai import OpenAI
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional


# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────

EXTRACT_N_FRAMES  = 5
TOP_K_FRAMES      = 3
CLIP_MODEL_NAME   = "ViT-B/32"
GPT_MODEL         = "gpt-4o-mini"

# API key dari environment variable — JANGAN hardcode di sini
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")


# ─────────────────────────────────────────────
# CLIP Model — Singleton Loader
# ─────────────────────────────────────────────

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

print(f"[CLIP] Loading model '{CLIP_MODEL_NAME}' on {DEVICE.upper()}...")
_clip_model, _clip_preprocess = clip.load(CLIP_MODEL_NAME, device=DEVICE)
_clip_model.eval()
print(f"[CLIP] Model ready ✓  (device: {DEVICE.upper()})")


# ─────────────────────────────────────────────
# OpenAI Client — Lazy Init
# ─────────────────────────────────────────────
#
# Kenapa lazy (tidak di-init saat startup)?
# - Kalau API key tidak ada, server tetap bisa jalan
# - Explanation hanya di-skip, tidak crash
# - Lebih robust untuk deployment tanpa OpenAI

def get_openai_client() -> Optional[OpenAI]:
    """Return OpenAI client kalau API key tersedia, None kalau tidak."""
    if not OPENAI_API_KEY:
        return None
    return OpenAI(api_key=OPENAI_API_KEY)


# ─────────────────────────────────────────────
# FastAPI App
# ─────────────────────────────────────────────

app = FastAPI(
    title="Vehicle Similarity API",
    description="AI-powered visual similarity — CLIP + GPT-4o-mini explanation",
    version="4.0.0-stage4",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# Response Schema
# ─────────────────────────────────────────────

class SimilarityResponse(BaseModel):
    similarity_percentage: float
    confidence: str
    verdict: str
    explanation: str                  # BARU Stage 4 — GPT explanation
    explanation_model: str            # BARU Stage 4 — model yang dipakai
    video_a_info: dict
    video_b_info: dict
    frame_scores: List[float]
    frames_compared: int
    embedding_model: str
    device_used: str
    processing_time_ms: float
    stage: str
    note: str


# ─────────────────────────────────────────────
# Core Logic — Frame Extraction (Stage 2)
# ─────────────────────────────────────────────

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


# ─────────────────────────────────────────────
# Core Logic — Sharpness Filter (Stage 2)
# ─────────────────────────────────────────────

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


# ─────────────────────────────────────────────
# Core Logic — CLIP Embedding (Stage 3)
# ─────────────────────────────────────────────

def frame_to_pil(frame: np.ndarray) -> Image.Image:
    """Konversi OpenCV BGR → PIL RGB."""
    return Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))


def generate_embedding(frame: np.ndarray) -> np.ndarray:
    """CLIP ViT-B/32 → 512-d L2-normalized semantic vector."""
    pil_image    = frame_to_pil(frame)
    image_tensor = _clip_preprocess(pil_image).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        embedding = _clip_model.encode_image(image_tensor)
        embedding = embedding / embedding.norm(dim=-1, keepdim=True)

    return embedding.cpu().numpy().flatten()


# ─────────────────────────────────────────────
# Core Logic — Similarity (Stage 2)
# ─────────────────────────────────────────────

def cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    """Cosine similarity → persentase 0–100%."""
    dot   = np.dot(vec_a, vec_b)
    na    = np.linalg.norm(vec_a)
    nb    = np.linalg.norm(vec_b)
    if na == 0 or nb == 0: return 0.0
    return round(float(np.clip(dot / (na * nb), 0.0, 1.0)) * 100, 2)


def compare_frame_sets(frames_a: list, frames_b: list) -> tuple:
    """CLIP encode + pairwise compare + average."""
    pairs  = min(len(frames_a), len(frames_b))
    scores = [
        cosine_similarity(generate_embedding(frames_a[i]), generate_embedding(frames_b[i]))
        for i in range(pairs)
    ]
    return round(float(np.mean(scores)), 2) if scores else 0.0, scores


def get_verdict(score: float) -> str:
    if score >= 85:   return "HIGH_SIMILARITY"
    elif score >= 60: return "MODERATE_SIMILARITY"
    elif score >= 35: return "LOW_SIMILARITY"
    else:             return "DIFFERENT"


def get_confidence(scores: list) -> str:
    if len(scores) < 2: return "LOW"
    std = float(np.std(scores))
    if std < 5.0:    return "HIGH"
    elif std < 10.0: return "MEDIUM"
    else:            return "LOW"


# ─────────────────────────────────────────────
# Core Logic — GPT Explanation (BARU Stage 4)
# ─────────────────────────────────────────────

def frame_to_base64(frame: np.ndarray, quality: int = 85) -> str:
    """
    Konversi frame OpenCV → base64 JPEG string.

    Kenapa JPEG, bukan PNG?
    - JPEG jauh lebih kecil → biaya token GPT lebih rendah
    - Quality 85 = balance antara ukuran file dan ketajaman visual
    - GPT vision bisa baca JPEG dengan baik

    Return: base64 string siap dikirim ke OpenAI API
    """
    _, buffer  = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return base64.b64encode(buffer).decode("utf-8")


def generate_explanation(
    frame_a: np.ndarray,
    frame_b: np.ndarray,
    similarity_score: float,
    verdict: str,
    confidence: str,
) -> tuple:
    """
    Kirim 2 frame terbaik + skor ke GPT-4o-mini → natural language explanation.

    Kenapa kirim frame, bukan cuma angka?
    - GPT bisa lihat visual langsung → explanation lebih kontekstual
    - Bisa menyebut detail spesifik: warna, bentuk, orientasi kendaraan
    - Hasilnya jauh lebih bermakna daripada template string

    Prompt dirancang untuk:
    - Output bahasa Inggris
    - 3–5 kalimat detail
    - Berbasis visual + data skor, bukan asumsi

    Return: (explanation_text, model_name)
    """
    client = get_openai_client()

    # Fallback kalau tidak ada API key
    if client is None:
        return (
            f"Visual similarity score: {similarity_score}%. "
            f"Verdict: {verdict}. Confidence: {confidence}. "
            f"(AI explanation unavailable — set OPENAI_API_KEY to enable.)",
            "none"
        )

    # Encode kedua frame ke base64
    b64_a = frame_to_base64(frame_a)
    b64_b = frame_to_base64(frame_b)

    prompt = f"""You are a vehicle visual analysis expert.

You are given two video frames extracted from different vehicle videos, along with their computed similarity metrics:

- Similarity Score: {similarity_score}%
- Verdict: {verdict}
- Confidence: {confidence}

Analyze both images carefully and provide a detailed explanation of 3–5 sentences in English. Your explanation should:
1. Describe the visual characteristics you observe in both frames (vehicle type, color, shape, angle)
2. Explain whether the vehicles appear to be the same or different, and why
3. Reference the similarity score and what it means in context
4. Note any factors that might affect the accuracy (lighting, angle, occlusion, image quality)

Be specific and factual. Do not speculate beyond what is visually observable."""

    try:
        response = client.chat.completions.create(
            model=GPT_MODEL,
            max_tokens=300,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type":      "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{b64_a}", "detail": "low"},
                        },
                        {
                            "type":      "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{b64_b}", "detail": "low"},
                        },
                    ],
                }
            ],
        )
        explanation = response.choices[0].message.content.strip()
        return explanation, GPT_MODEL

    except Exception as e:
        # Kalau GPT gagal (rate limit, network, dll) → fallback ke template
        # Server tidak boleh crash hanya karena GPT error
        fallback = (
            f"The two video frames were compared using CLIP ViT-B/32 visual embeddings. "
            f"The similarity score is {similarity_score}%, resulting in a verdict of {verdict} "
            f"with {confidence} confidence. "
            f"(Detailed AI explanation unavailable: {str(e)})"
        )
        return fallback, f"{GPT_MODEL}-fallback"


# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "service":          "Vehicle Similarity API",
        "version":          "4.0.0-stage4",
        "status":           "running",
        "embedding_model":  CLIP_MODEL_NAME,
        "explanation_model": GPT_MODEL,
        "device":           DEVICE.upper(),
        "openai_ready":     bool(OPENAI_API_KEY),
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
        "stage":             "AI-Reason-v1",
        "embedding_model":   CLIP_MODEL_NAME,
        "explanation_model": GPT_MODEL,
        "device":            DEVICE.upper(),
        "openai_ready":      bool(OPENAI_API_KEY),
        "config": {
            "extract_n_frames": EXTRACT_N_FRAMES,
            "top_k_frames":     TOP_K_FRAMES,
        }
    }


@app.post("/compare", response_model=SimilarityResponse)
async def compare_vehicles(
    video_a: UploadFile = File(..., description="Video kendaraan pertama"),
    video_b: UploadFile = File(..., description="Video kendaraan kedua"),
):
    """
    Bandingkan dua video kendaraan — CLIP similarity + GPT-4o-mini explanation.

    **Upgrade dari Stage 3:**
    - Frame terbaik dikirim ke GPT-4o-mini sebagai gambar
    - GPT generate explanation 3–5 kalimat dalam English
    - Explanation kontekstual: visual + skor + kondisi frame
    - Graceful fallback kalau OpenAI tidak tersedia

    **Flow:**
    1. Upload & simpan video ke temp
    2. Extract 5 frame merata per video
    3. Pilih 3 frame tersharp (Laplacian)
    4. CLIP encode → cosine similarity → average
    5. Ambil frame tersharp masing-masing video
    6. Kirim ke GPT-4o-mini → natural language explanation
    7. Return JSON lengkap dengan explanation
    """
    start_time = time.time()

    allowed_types = ["video/mp4", "video/avi", "video/mov", "video/mkv", "video/quicktime"]
    for video, name in [(video_a, "video_a"), (video_b, "video_b")]:
        if video.content_type and video.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"{name} harus berupa file video (mp4, avi, mov, mkv). Dapat: {video.content_type}"
            )

    tmp_a = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    tmp_b = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)

    try:
        tmp_a.write(await video_a.read())
        tmp_a.flush()
        tmp_b.write(await video_b.read())
        tmp_b.flush()
        tmp_a.close()
        tmp_b.close()

        # Step 1: Extract 5 frame merata
        frames_a, info_a = extract_frames_evenly(tmp_a.name, n=EXTRACT_N_FRAMES)
        frames_b, info_b = extract_frames_evenly(tmp_b.name, n=EXTRACT_N_FRAMES)

        # Step 2: Pilih 3 frame tersharp
        sharp_a, sharpness_a = select_sharpest_frames(frames_a, k=TOP_K_FRAMES)
        sharp_b, sharpness_b = select_sharpest_frames(frames_b, k=TOP_K_FRAMES)

        info_a["sharpness_scores"] = sharpness_a
        info_b["sharpness_scores"] = sharpness_b
        info_a["frames_used"]      = len(sharp_a)
        info_b["frames_used"]      = len(sharp_b)

        # Step 3: CLIP encode + compare
        avg_score, frame_scores = compare_frame_sets(sharp_a, sharp_b)
        verdict    = get_verdict(avg_score)
        confidence = get_confidence(frame_scores)

        # Step 4: GPT explanation — pakai frame tersharp (index 0 = paling tajam)
        # Kirim frame terbaik dari masing-masing video
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

        return SimilarityResponse(
            similarity_percentage = avg_score,
            confidence            = confidence,
            verdict               = verdict,
            explanation           = explanation,
            explanation_model     = explanation_model,
            video_a_info          = info_a,
            video_b_info          = info_b,
            frame_scores          = frame_scores,
            frames_compared       = len(frame_scores),
            embedding_model       = CLIP_MODEL_NAME,
            device_used           = DEVICE.upper(),
            processing_time_ms    = processing_time,
            stage                 = "AI-Reason-v1",
            note                  = "Stage 4: CLIP similarity + GPT-4o-mini visual explanation.",
        )

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

    finally:
        for path in [tmp_a.name, tmp_b.name]:
            if os.path.exists(path):
                os.unlink(path)