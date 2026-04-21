"""
config.py — Semua environment variable & konstanta
Satu tempat untuk semua config, tidak tersebar di mana-mana.

Stage 6: reads .env.production in production, .env in development.
Use python-dotenv or Docker --env-file to inject these at runtime.
"""

import os

# Load .env file if python-dotenv is available (local dev convenience)
try:
    from dotenv import load_dotenv
    load_dotenv(override=False)  # override=False: env vars set by Docker/shell take priority
except ImportError:
    pass

# ── Pipeline ───────────────────────────────────
DEVICE           = os.environ.get("DEVICE", "cpu")
EXTRACT_N_FRAMES = int(os.environ.get("EXTRACT_N_FRAMES", "5"))
TOP_K_FRAMES     = int(os.environ.get("TOP_K_FRAMES", "3"))
CLIP_MODEL_NAME  = "ViT-B/32"
GPT_MODEL        = "gpt-4o-mini"

# ── Inspection Engine ──────────────────────────
# ANALYSIS_BACKEND: "mock" | "gpt" | "yolo"
#   mock → deterministic dummy (no OpenAI cost) — safe default for local dev
#   gpt  → GPT-4o Vision (requires OPENAI_API_KEY)
#   yolo → YOLO inference (future, requires trained weights)
ANALYSIS_BACKEND   = os.environ.get("ANALYSIS_BACKEND", "mock")
WORKER_CONCURRENCY = int(os.environ.get("WORKER_CONCURRENCY", "2"))

# ── OpenAI ─────────────────────────────────────
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

# ── Object Storage (MinIO / AWS S3 / Cloudflare R2) ───────
# Set STORAGE_PROVIDER to one of: minio | s3 | r2
STORAGE_PROVIDER    = os.environ.get("STORAGE_PROVIDER",    "minio")
STORAGE_ACCESS_KEY  = os.environ.get("STORAGE_ACCESS_KEY",  os.environ.get("MINIO_ACCESS_KEY", "minioadmin"))
STORAGE_SECRET_KEY  = os.environ.get("STORAGE_SECRET_KEY",  os.environ.get("MINIO_SECRET_KEY", "minioadmin"))
STORAGE_BUCKET      = os.environ.get("STORAGE_BUCKET",      os.environ.get("MINIO_BUCKET",     "vehicle-dataset"))
STORAGE_ENDPOINT    = os.environ.get("STORAGE_ENDPOINT",    os.environ.get("MINIO_ENDPOINT",   "http://minio:9000"))
STORAGE_REGION      = os.environ.get("STORAGE_REGION",      "us-east-1")
STORAGE_CDN_BASE_URL = os.environ.get("STORAGE_CDN_BASE_URL", "")

# Legacy aliases (kept for backward compatibility)
MINIO_ENDPOINT   = STORAGE_ENDPOINT
MINIO_ACCESS_KEY = STORAGE_ACCESS_KEY
MINIO_SECRET_KEY = STORAGE_SECRET_KEY
MINIO_BUCKET     = STORAGE_BUCKET

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

# ── Auth ───────────────────────────────────────
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "super-secret-key-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 1 week