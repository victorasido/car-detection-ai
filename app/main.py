"""
Vehicle Inspection API — Modular Version
=========================================
Refactored to use APIRouters for better maintainability.
"""

import time
import os
import sentry_sdk
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

sentry_sdk.init(
    dsn=os.environ.get("SENTRY_DSN", ""),
    traces_sample_rate=1.0,
    profiles_sample_rate=1.0,
)

from app.config import (
    OPENAI_API_KEY, DATASET_SAVING_ENABLED, ALLOWED_ORIGINS, 
    CLIP_MODEL_NAME, DEVICE, RATE_LIMIT
)
from app.pipeline.damage_analyzer import DAMAGE_MODEL
from app.storage.postgres import init_db, close_db
from app.storage.damage_dataset import init_damage_table

# Import Routers
from app.api.routers import auth, inspection, admin

# ─────────────────────────────────────────────
# Rate Limiter + Lifespan
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
    version     = "5.3.0",
    lifespan    = lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_methods=["*"], allow_headers=["*"])

# ─────────────────────────────────────────────
# Include Routers
# ─────────────────────────────────────────────

app.include_router(auth.router)
app.include_router(inspection.router)
app.include_router(admin.router)

# ─────────────────────────────────────────────
# General Endpoints
# ─────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "service":        "Vehicle Inspection API",
        "version":        "5.3.0",
        "status":         "running",
        "openai_ready":   bool(OPENAI_API_KEY),
        "dataset_saving": DATASET_SAVING_ENABLED,
        "endpoints": {
            "auth": "/auth/register, /auth/login, /auth/me",
            "inspection": "/compare, /analyze, /valuation",
            "admin": "/admin/pending, /admin/approve, /admin/frame/{id}",
            "health":  "/health",
            "docs":    "/docs",
        }
    }


@app.get("/health")
def health_check():
    return {
        "status":          "ok",
        "version":         "5.3.0",
        "embedding_model": CLIP_MODEL_NAME,
        "damage_model":    DAMAGE_MODEL,
        "device":          DEVICE.upper(),
        "openai_ready":    bool(OPENAI_API_KEY),
        "dataset_saving":  DATASET_SAVING_ENABLED,
    }
