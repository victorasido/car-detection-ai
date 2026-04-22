import os
from celery import Celery
from celery.signals import worker_process_init, worker_init, worker_ready
from app.storage.postgres import init_db

redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "vehicle_inspection",
    broker=redis_url,
    backend=redis_url,
    include=["app.inspection.worker"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)


@worker_ready.connect
def warm_up_models(**kwargs):
    """Pre-load AI models to avoid cold-start latency on first task."""
    print("[Celery Worker] Warming up AI models (CLIP/Inspection)...")
    try:
        from app.pipeline.embedder import _get_clip
        from app.pipeline.inspection_analyzer import analyze_frame
        import numpy as np

        # Trigger lazy loads
        _get_clip()
        # Mock-run or just import to ensure weights are triggered
        analyze_frame(np.zeros((100, 100, 3), dtype=np.uint8), backend="mock")
        print("[Celery Worker] AI models warmed up successfully ✓")
    except Exception as e:
        print(f"[Celery Worker] WARN: Model warm-up failed: {e}")


@worker_process_init.connect
def init_worker_process(**kwargs):
    """Initialize database connection when prefork worker process starts."""
    print("[Celery Worker] Initializing DB connection (Process Init)...")
    init_db()


@worker_init.connect
def init_worker_main(**kwargs):
    """Initialize database connection in the main worker (for threads/solo pools)."""
    print("[Celery Worker] Initializing DB connection (Worker Init)...")
    init_db()
