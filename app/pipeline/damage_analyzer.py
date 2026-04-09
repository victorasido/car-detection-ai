"""
pipeline/damage_analyzer.py — GPT-4o Vision damage detection
=============================================================
Analisa kerusakan kendaraan dari frame gambar menggunakan GPT-4o Vision.

Flow:
  frame (np.ndarray) → base64 JPEG → GPT-4o Vision → JSON damage report

Output JSON:
  {
    "damages": [
      {
        "type": "dent",
        "severity": "moderate",
        "location": "front_bumper",
        "description": "Visible dent approximately 15cm wide..."
      }
    ],
    "overall_condition": "fair",
    "condition_score": 6.5,       ← 0-10 (10 = perfect)
    "repair_urgency": "recommended",
    "estimated_damage_count": 2,
    "analysis_notes": "..."
  }
"""

import json
import base64
import cv2
import numpy as np
from openai import OpenAI
from app.config import OPENAI_API_KEY

# ── Model config ────────────────────────────────────────────────
DAMAGE_MODEL       = "gpt-4o"          # Pakai gpt-4o (bukan mini) untuk akurasi lebih baik
DAMAGE_MAX_TOKENS  = 800
DAMAGE_IMG_QUALITY = 90                # Lebih tinggi dari similarity (butuh detail lebih)
DAMAGE_IMG_DETAIL  = "high"            # high = GPT analisa resolusi penuh

# ── Damage types ────────────────────────────────────────────────
DAMAGE_TYPES = [
    "dent", "scratch", "crack", "rust", "paint_damage",
    "broken_glass", "missing_part", "deformation", "burn_mark", "flood_damage"
]

# ── Condition labels ─────────────────────────────────────────────
CONDITION_LABELS = {
    (9, 10):  "excellent",
    (7, 8):   "good",
    (5, 6):   "fair",
    (3, 4):   "poor",
    (0, 2):   "severe",
}

URGENCY_LABELS = ["none", "optional", "recommended", "urgent", "critical"]


def get_openai_client() -> OpenAI | None:
    if not OPENAI_API_KEY:
        return None
    return OpenAI(api_key=OPENAI_API_KEY)


def frame_to_base64(frame: np.ndarray, quality: int = DAMAGE_IMG_QUALITY) -> str:
    """Konversi OpenCV frame → base64 JPEG."""
    _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return base64.b64encode(buffer).decode("utf-8")


def _build_prompt() -> str:
    return """You are an expert vehicle damage inspector with 20+ years of experience assessing vehicle condition for insurance, auctions, and resale.

Analyze the provided vehicle image carefully and return a JSON object with this EXACT structure:

{
  "damages": [
    {
      "type": "<one of: dent, scratch, crack, rust, paint_damage, broken_glass, missing_part, deformation, burn_mark, flood_damage>",
      "severity": "<one of: minor, moderate, severe>",
      "location": "<specific location, e.g. front_bumper, rear_left_door, hood, windshield, roof>",
      "description": "<1-2 sentences describing the damage specifically>"
    }
  ],
  "overall_condition": "<one of: excellent, good, fair, poor, severe>",
  "condition_score": <float 0.0-10.0, where 10 = perfect condition>,
  "repair_urgency": "<one of: none, optional, recommended, urgent, critical>",
  "estimated_damage_count": <integer>,
  "analysis_notes": "<1-2 sentences of overall assessment>"
}

Rules:
- If no damage is visible, return empty damages array and condition_score 8-10
- Be specific about locations (not just "front" but "front_left_bumper")
- Be conservative — only report what is clearly visible
- Return ONLY the JSON object, no markdown, no explanation"""


def analyze_damage(frame: np.ndarray) -> tuple[dict, str]:
    """
    Analisa kerusakan dari 1 frame menggunakan GPT-4o Vision.

    Args:
        frame: OpenCV BGR frame

    Returns:
        (damage_report: dict, model_used: str)

    damage_report keys:
        damages, overall_condition, condition_score,
        repair_urgency, estimated_damage_count, analysis_notes
    """
    client = get_openai_client()

    # Fallback jika tidak ada API key
    if client is None:
        return _fallback_report("OpenAI API key not configured"), "none"

    b64_image = frame_to_base64(frame)

    try:
        response = client.chat.completions.create(
            model      = DAMAGE_MODEL,
            max_tokens = DAMAGE_MAX_TOKENS,
            messages   = [{
                "role": "user",
                "content": [
                    {"type": "text", "text": _build_prompt()},
                    {
                        "type":      "image_url",
                        "image_url": {
                            "url":    f"data:image/jpeg;base64,{b64_image}",
                            "detail": DAMAGE_IMG_DETAIL,
                        },
                    },
                ],
            }],
        )

        raw = response.choices[0].message.content.strip()

        # Strip markdown code blocks kalau ada
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        report = json.loads(raw)
        return _validate_report(report), DAMAGE_MODEL

    except json.JSONDecodeError as e:
        print(f"[DamageAnalyzer] JSON parse error: {e}")
        return _fallback_report(f"JSON parse error: {str(e)}"), f"{DAMAGE_MODEL}-fallback"

    except Exception as e:
        print(f"[DamageAnalyzer] Error: {e}")
        return _fallback_report(str(e)), f"{DAMAGE_MODEL}-fallback"


def _validate_report(report: dict) -> dict:
    """Validasi & sanitize output GPT — pastikan semua field ada."""
    damages = report.get("damages", [])

    # Validasi setiap damage item
    validated_damages = []
    for d in damages:
        if not isinstance(d, dict):
            continue
        validated_damages.append({
            "type":        d.get("type", "unknown"),
            "severity":    d.get("severity", "minor"),
            "location":    d.get("location", "unknown"),
            "description": d.get("description", ""),
        })

    score = float(report.get("condition_score", 7.0))
    score = max(0.0, min(10.0, score))

    return {
        "damages":               validated_damages,
        "overall_condition":     report.get("overall_condition", "good"),
        "condition_score":       round(score, 1),
        "repair_urgency":        report.get("repair_urgency", "none"),
        "estimated_damage_count": len(validated_damages),
        "analysis_notes":        report.get("analysis_notes", ""),
    }


def _fallback_report(reason: str) -> dict:
    """Return fallback report ketika GPT tidak tersedia."""
    return {
        "damages":                [],
        "overall_condition":      "unknown",
        "condition_score":        0.0,
        "repair_urgency":         "unknown",
        "estimated_damage_count": 0,
        "analysis_notes":         f"Analysis unavailable: {reason}",
    }