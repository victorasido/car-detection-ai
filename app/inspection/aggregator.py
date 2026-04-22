"""
inspection/aggregator.py — Roll up per-frame AI results → single inspection report.

Strategy:
  - condition_score : average across all frames
  - damages         : deduplicated by (type, location), highest severity wins
  - repair_urgency  : worst urgency across all frames
  - overall_condition: mapped from the averaged score
"""

from __future__ import annotations
from typing import List, Dict, Any


_SEVERITY_RANK = {"minor": 1, "moderate": 2, "severe": 3}
_URGENCY_RANK  = {"none": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}
_URGENCY_RANK_INV = {v: k for k, v in _URGENCY_RANK.items()}


def aggregate_results(frame_results: List[Dict[str, Any]]) -> dict:
    """
    Combine multiple per-frame AI results into one consolidated inspection report.

    Args:
        frame_results: list of dicts, each with keys:
            - frame_id   (str)
            - ai_result  (dict matching the inspection_analyzer contract)
            - sharpness  (float, optional — reserved for weighted scoring)

    Returns:
        Aggregated report dict ready for save_inspection_result().
    """
    if not frame_results:
        return _empty_report()

    all_damages: list = []
    scores:      list = []
    urgencies:   list = []

    for r in frame_results:
        ai = r.get("ai_result") or {}
        score = ai.get("condition_score")
        if score is not None:
            scores.append(float(score))
        urgency = ai.get("repair_urgency", "none")
        urgencies.append(urgency)
        all_damages.extend(ai.get("damages") or [])

    avg_score     = round(sum(scores) / len(scores), 1) if scores else 0.0
    worst_urgency = _worst_urgency(urgencies)
    deduped       = _deduplicate_damages(all_damages)
    condition     = _score_to_condition(avg_score)

    return {
        "overall_condition":      condition,
        "condition_score":        avg_score,
        "repair_urgency":         worst_urgency,
        "damages":                deduped,
        "estimated_damage_count": len(deduped),
        "analysis_notes":         _generate_notes(condition, deduped, worst_urgency),
    }


# ── Private helpers ──────────────────────────────────────────────

def _deduplicate_damages(damages: list) -> list:
    """
    Merge damage entries that appear in multiple frames by (type, location).

    FIX #4: Instead of silently dropping duplicates, we:
      - Keep the entry with the HIGHEST severity (most critical wins).
      - Record `occurrence_count` so "seen in 3 frames" is not lost.
      - Preserve `description` from the highest-severity instance.

    Two physically separate damages of the same type at the same location
    (e.g. two dents on door_left) cannot be distinguished without bbox data.
    When bbox support is added, switch the key to include spatial clustering.
    """
    seen: Dict[tuple, dict] = {}
    for dmg in damages:
        key = (
            str(dmg.get("type", "unknown")).lower(),
            str(dmg.get("location", "other")).lower(),
        )
        existing = seen.get(key)
        if existing is None:
            seen[key] = dict(dmg)
            seen[key]["occurrence_count"] = 1
        else:
            existing["occurrence_count"] = existing.get("occurrence_count", 1) + 1
            existing_rank = _SEVERITY_RANK.get(existing.get("severity", ""), 0)
            new_rank      = _SEVERITY_RANK.get(dmg.get("severity", ""), 0)
            if new_rank > existing_rank:
                # Upgrade severity + description, keep the running count
                count = existing["occurrence_count"]
                seen[key] = dict(dmg)
                seen[key]["occurrence_count"] = count
    return list(seen.values())


def _worst_urgency(urgencies: list) -> str:
    if not urgencies:
        return "none"
    worst_rank = max(_URGENCY_RANK.get(u, 0) for u in urgencies)
    return _URGENCY_RANK_INV.get(worst_rank, "none")


def _score_to_condition(score: float) -> str:
    if score >= 85:   return "excellent"
    elif score >= 70: return "good"
    elif score >= 50: return "fair"
    elif score >= 30: return "poor"
    else:             return "critical"


def _generate_notes(condition: str, damages: list, urgency: str) -> str:
    if not damages:
        return (
            f"Vehicle appears to be in {condition} condition "
            f"with no significant damage detected across inspected frames."
        )
    damage_types = sorted({d.get("type", "unknown") for d in damages})
    locations    = sorted({d.get("location", "unknown") for d in damages})
    return (
        f"Vehicle is in {condition} condition. "
        f"Detected {len(damages)} damage item(s): {', '.join(damage_types)} "
        f"on {', '.join(locations)}. "
        f"Repair urgency: {urgency}."
    )


def _empty_report() -> dict:
    return {
        "overall_condition":      "unknown",
        "condition_score":        0.0,
        "repair_urgency":         "none",
        "damages":                [],
        "estimated_damage_count": 0,
        "analysis_notes":         "No frames were available for analysis.",
    }
