"""
pipeline/damage_analyzer.py - GPT-4o Vision damage detection.

Analyze vehicle damage from a single image frame and normalize the result into
stable JSON for the rest of the backend.
"""

from __future__ import annotations

import base64
import json
import re

import cv2
import numpy as np
from openai import OpenAI

from app.config import OPENAI_API_KEY


DAMAGE_MODEL = "gpt-4o"
DAMAGE_MAX_TOKENS = 800
DAMAGE_IMG_QUALITY = 90
DAMAGE_IMG_DETAIL = "high"

DAMAGE_TYPES = [
    "dent",
    "scratch",
    "crack",
    "rust",
    "paint_damage",
    "broken_glass",
    "missing_part",
    "deformation",
    "burn_mark",
    "flood_damage",
]
DAMAGE_SEVERITIES = ["minor", "moderate", "severe"]
CONDITION_VALUES = ["excellent", "good", "fair", "poor", "severe"]
URGENCY_VALUES = ["none", "optional", "recommended", "urgent", "critical"]

_DAMAGE_TYPE_SET = set(DAMAGE_TYPES)
_DAMAGE_SEVERITY_SET = set(DAMAGE_SEVERITIES)
_CONDITION_SET = set(CONDITION_VALUES)
_URGENCY_SET = set(URGENCY_VALUES)


def get_openai_client() -> OpenAI | None:
    if not OPENAI_API_KEY:
        return None
    return OpenAI(api_key=OPENAI_API_KEY)


def frame_to_base64(frame: np.ndarray, quality: int = DAMAGE_IMG_QUALITY) -> str:
    """Convert OpenCV frame to base64 JPEG."""
    ok, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise ValueError("Failed to encode image frame")
    return base64.b64encode(buffer).decode("utf-8")


def _build_prompt() -> str:
    damage_types = ", ".join(DAMAGE_TYPES)
    severities = ", ".join(DAMAGE_SEVERITIES)
    conditions = ", ".join(CONDITION_VALUES)
    urgencies = ", ".join(URGENCY_VALUES)

    return f"""You are an expert vehicle damage inspector.

Analyze the vehicle image carefully and return exactly one JSON object.

Expected JSON schema:
{{
  "damages": [
    {{
      "type": "<one of: {damage_types}>",
      "severity": "<one of: {severities}>",
      "location": "<specific area such as front_bumper, rear_left_door, hood, windshield>",
      "description": "<1-2 short factual sentences>"
    }}
  ],
  "overall_condition": "<one of: {conditions}>",
  "condition_score": <float 0.0-10.0 where 10 is best>,
  "repair_urgency": "<one of: {urgencies}>",
  "estimated_damage_count": <integer>,
  "analysis_notes": "<1-2 short factual sentences>"
}}

Rules:
- Report only visible damage. If uncertain, do not invent damage.
- Use an empty damages array if no clear damage is visible.
- Use snake_case for location when possible.
- Keep descriptions factual and concise.
- Return JSON only. No markdown, code fences, or extra commentary."""


def analyze_damage(frame: np.ndarray) -> tuple[dict, str]:
    """
    Analyze damage from one OpenCV BGR frame.

    Returns:
        (normalized_report, model_name)
    """
    client = get_openai_client()
    if client is None:
        return _fallback_report("OpenAI API key not configured"), "none"

    try:
        b64_image = frame_to_base64(frame)
        response = client.chat.completions.create(
            model=DAMAGE_MODEL,
            max_tokens=DAMAGE_MAX_TOKENS,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": _build_prompt()},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{b64_image}",
                                "detail": DAMAGE_IMG_DETAIL,
                            },
                        },
                    ],
                }
            ],
        )

        raw = _extract_message_text(response.choices[0].message.content)
        payload = _extract_json_object(raw)
        report = json.loads(payload)
        if not isinstance(report, dict):
            raise ValueError("Model response is not a JSON object")
        return _validate_report(report), DAMAGE_MODEL
    except json.JSONDecodeError as exc:
        print(f"[DamageAnalyzer] JSON parse error: {exc}")
        return _fallback_report(f"JSON parse error: {exc}"), f"{DAMAGE_MODEL}-fallback"
    except Exception as exc:
        print(f"[DamageAnalyzer] Error: {exc}")
        return _fallback_report(str(exc)), f"{DAMAGE_MODEL}-fallback"


def _extract_message_text(content: object) -> str:
    """Normalize SDK message content into plain text."""
    if isinstance(content, str):
        return content.strip()

    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict):
                text = item.get("text")
                if isinstance(text, str):
                    parts.append(text)
            else:
                text = getattr(item, "text", None)
                if isinstance(text, str):
                    parts.append(text)
        return "\n".join(parts).strip()

    return str(content).strip()


def _extract_json_object(raw: str) -> str:
    """Extract the first JSON object from a model response."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError("No JSON object found in model response")
    return cleaned[start : end + 1]


def _validate_report(report: dict) -> dict:
    """Validate and sanitize model output into a stable backend schema."""
    raw_damages = report.get("damages", [])
    if not isinstance(raw_damages, list):
        raw_damages = []

    damages: list[dict] = []
    for item in raw_damages:
        if not isinstance(item, dict):
            continue

        damage_type = _sanitize_choice(item.get("type"), _DAMAGE_TYPE_SET, "scratch")
        severity = _sanitize_choice(item.get("severity"), _DAMAGE_SEVERITY_SET, "minor")
        location = _sanitize_location(item.get("location"))
        description = _sanitize_text(item.get("description"), fallback=f"Visible {damage_type} on {location}.")

        damages.append(
            {
                "type": damage_type,
                "severity": severity,
                "location": location,
                "description": description,
            }
        )

    score = _coerce_score(report.get("condition_score", 7.0))
    overall_condition = _sanitize_choice(
        report.get("overall_condition"),
        _CONDITION_SET,
        _condition_from_score(score),
    )
    repair_urgency = _sanitize_choice(
        report.get("repair_urgency"),
        _URGENCY_SET,
        _urgency_from_damages(damages),
    )
    analysis_notes = _sanitize_text(
        report.get("analysis_notes"),
        fallback=_notes_from_damages(damages, overall_condition),
    )

    return {
        "damages": damages,
        "overall_condition": overall_condition,
        "condition_score": round(score, 1),
        "repair_urgency": repair_urgency,
        "estimated_damage_count": len(damages),
        "analysis_notes": analysis_notes,
    }


def _sanitize_choice(value: object, allowed: set[str], fallback: str) -> str:
    token = str(value or "").strip().lower().replace(" ", "_").replace("-", "_")
    return token if token in allowed else fallback


def _sanitize_location(value: object) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    text = re.sub(r"_+", "_", text).strip("_")
    return text or "unknown_area"


def _sanitize_text(value: object, fallback: str) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    return text[:240] if text else fallback


def _coerce_score(value: object) -> float:
    try:
        score = float(value)
    except (TypeError, ValueError):
        score = 7.0
    return max(0.0, min(10.0, score))


def _condition_from_score(score: float) -> str:
    if score >= 8.5:
        return "excellent"
    if score >= 7.0:
        return "good"
    if score >= 5.0:
        return "fair"
    if score >= 3.0:
        return "poor"
    return "severe"


def _urgency_from_damages(damages: list[dict]) -> str:
    if not damages:
        return "none"

    severities = {item["severity"] for item in damages}
    if "severe" in severities:
        return "urgent" if len(damages) == 1 else "critical"
    if "moderate" in severities:
        return "recommended"
    return "optional"


def _notes_from_damages(damages: list[dict], overall_condition: str) -> str:
    if not damages:
        return f"No clear visible damage detected. Overall visible condition appears {overall_condition}."

    severity_mix = ", ".join(sorted({item["severity"] for item in damages}))
    return (
        f"Detected {len(damages)} visible damage area(s) with {severity_mix} severity levels. "
        f"Overall visible condition appears {overall_condition}."
    )


def _fallback_report(reason: str) -> dict:
    """Fallback report when the model is unavailable or returns invalid JSON."""
    return {
        "damages": [],
        "overall_condition": "unknown",
        "condition_score": 0.0,
        "repair_urgency": "unknown",
        "estimated_damage_count": 0,
        "analysis_notes": f"Analysis unavailable: {reason}",
    }
