"""
config.py — Semua environment variable & konstanta
Satu tempat untuk semua config, tidak tersebar di mana-mana.
"""

import os

# ── Pipeline ───────────────────────────────────
EXTRACT_N_FRAMES = int(os.environ.get("EXTRACT_N_FRAMES", "5"))
TOP_K_FRAMES     = int(os.environ.get("TOP_K_FRAMES", "3"))
CLIP_MODEL_NAME  = "ViT-B/32"
GPT_MODEL        = "gpt-4o-mini"

# ── OpenAI ─────────────────────────────────────
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

# ── MinIO ──────────────────────────────────────
MINIO_ENDPOINT   = os.environ.get("MINIO_ENDPOINT",   "http://minio:9000")
MINIO_ACCESS_KEY = os.environ.get("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.environ.get("MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET     = os.environ.get("MINIO_BUCKET",     "vehicle-dataset")

# ── PostgreSQL ─────────────────────────────────
POSTGRES_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@postgres:5432/vehicledb"
)

# ── Feature Flag ───────────────────────────────
DATASET_SAVING_ENABLED = os.environ.get("DATASET_SAVING", "true").lower() == "true"

# ── Security ───────────────────────────────────
RATE_LIMIT             = os.environ.get("RATE_LIMIT", "30/minute")
MAX_UPLOAD_SIZE_MB     = int(os.environ.get("MAX_UPLOAD_SIZE_MB", "100"))
MAX_VIDEO_DURATION_SEC = int(os.environ.get("MAX_VIDEO_DURATION_SEC", "600"))
ALLOWED_ORIGINS        = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:8000"
).split(",")