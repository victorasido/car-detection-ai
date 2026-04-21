"""
pipeline/inspection_analyzer.py — Pluggable per-frame damage analysis adapter.

All pipeline callers use analyze_frame(). To switch AI backends:
  ANALYSIS_BACKEND=mock  → deterministic dummy (no OpenAI, dev/test)
  ANALYSIS_BACKEND=gpt   → GPT-4o Vision (requires OPENAI_API_KEY)
  ANALYSIS_BACKEND=yolo  → YOLO model inference (future)

Standardized output contract (ALL backends must return this shape):
{
  "damages": [
    {
      "type":        "scratch" | "dent" | "crack" | "rust" | "broken_glass" | "deformation" | "paint_damage",
      "severity":    "minor" | "moderate" | "severe",
      "location":    "front_bumper" | "hood" | "door_left" | "door_right" | "rear" | "roof" | "windshield" | "other",
      "description": str,
      "bbox":        { "x": int, "y": int, "w": int, "h": int } | None
    }
  ],
  "overall_condition": "excellent" | "good" | "fair" | "poor" | "critical",
  "condition_score":   float (0.0–100.0),
  "repair_urgency":    "none" | "low" | "medium" | "high" | "critical"
}
"""

import numpy as np
from app.config import ANALYSIS_BACKEND

# One consistent model name logged per backend
INSPECTION_MODEL_NAMES = {
    "mock": "mock-v1",
    "gpt":  "gpt-4o-mini",
    "yolo": "yolo-v8",
}

DAMAGE_MODEL = INSPECTION_MODEL_NAMES.get(ANALYSIS_BACKEND, "unknown")


def analyze_frame(frame: np.ndarray) -> dict:
    """
    Pluggable analysis adapter. Returns a standardized damage dict.
    All three backends conform to the same output contract (see module docstring).
    """
    backend = ANALYSIS_BACKEND.lower()

    if backend == "gpt":
        return _analyze_with_gpt(frame)
    elif backend == "yolo":
        return _analyze_with_yolo(frame)
    else:
        return _analyze_mock(frame)


# ── GPT Backend ──────────────────────────────────────────────────

def _analyze_with_gpt(frame: np.ndarray) -> dict:
    """
    Calls GPT-4o Vision for per-frame damage detection.
    Reuses the existing damage_analyzer pipeline — wraps and normalizes output.
    """
    from app.pipeline.damage_analyzer import analyze_damage
    report, _ = analyze_damage(frame)

    # Ensure each damage item has a bbox field (GPT doesn't produce spatial coords)
    for dmg in report.get("damages", []):
        dmg.setdefault("bbox", None)

    return report


# ── YOLO Backend (Future) ─────────────────────────────────────────

def _analyze_with_yolo(frame: np.ndarray) -> dict:
    """
    YOLO-based per-frame object detection.
    To activate: set ANALYSIS_BACKEND=yolo and load model weights here.

    Stub raises NotImplementedError until model is integrated.
    The worker catches this and falls back gracefully.
    """
    raise NotImplementedError(
        "YOLO backend is not yet integrated. "
        "Set ANALYSIS_BACKEND=gpt or ANALYSIS_BACKEND=mock."
    )


# ── Mock Backend ─────────────────────────────────────────────────

# Deterministic but varied mock so tests can assert specific structures.
_MOCK_SCENARIOS = [
    {
        "damages": [
            {
                "type": "scratch",
                "severity": "minor",
                "location": "front_bumper",
                "description": "Horizontal scratch approximately 15cm in length across the front bumper.",
                "bbox": None,
            }
        ],
        "overall_condition": "good",
        "condition_score": 78.0,
        "repair_urgency": "low",
    },
    {
        "damages": [
            {
                "type": "dent",
                "severity": "moderate",
                "location": "door_left",
                "description": "Noticeable dent on the left front door, approximately 10x8cm.",
                "bbox": None,
            },
            {
                "type": "paint_damage",
                "severity": "minor",
                "location": "door_left",
                "description": "Paint chipping around the dent area.",
                "bbox": None,
            },
        ],
        "overall_condition": "fair",
        "condition_score": 55.0,
        "repair_urgency": "medium",
    },
    {
        "damages": [],
        "overall_condition": "excellent",
        "condition_score": 95.0,
        "repair_urgency": "none",
    },
    {
        "damages": [
            {
                "type": "crack",
                "severity": "severe",
                "location": "windshield",
                "description": "Large crack across the lower third of the windshield.",
                "bbox": None,
            },
            {
                "type": "rust",
                "severity": "moderate",
                "location": "rear",
                "description": "Rust patches visible on the rear lower panel.",
                "bbox": None,
            },
        ],
        "overall_condition": "poor",
        "condition_score": 28.0,
        "repair_urgency": "high",
    },
]


def _analyze_mock(frame: np.ndarray) -> dict:
    """
    Deterministic mock analysis. Uses frame mean pixel value to pick a
    consistent scenario — same frame always produces the same output.
    """
    # Derive a consistent index from the frame content (not random)
    mean_val = int(frame.mean()) if frame is not None else 0
    scenario = _MOCK_SCENARIOS[mean_val % len(_MOCK_SCENARIOS)]

    import copy
    return copy.deepcopy(scenario)
