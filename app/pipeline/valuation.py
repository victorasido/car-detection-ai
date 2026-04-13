"""
pipeline/valuation.py - baseline price estimation from visual damage output.

This is a deterministic valuation layer that converts damage analysis plus a
reference price into a conservative price range. It is intended as a Phase 1/2
backend baseline before a market-aware valuation model exists.
"""

from __future__ import annotations

from datetime import datetime


SEVERITY_DEDUCTION = {
    "minor": 0.015,
    "moderate": 0.045,
    "severe": 0.10,
}


def estimate_vehicle_value(
    reference_price: float,
    damage_report: dict,
    manufacture_year: int | None = None,
    mileage_km: int | None = None,
    currency: str = "IDR",
    current_year: int | None = None,
) -> dict:
    """Estimate a price range using a simple condition-adjusted baseline."""
    if reference_price <= 0:
        raise ValueError("reference_price must be greater than zero")

    current_year = current_year or datetime.utcnow().year
    condition_score = float(damage_report.get("condition_score", 0.0) or 0.0)
    damages = damage_report.get("damages", [])
    if not isinstance(damages, list):
        damages = []

    age_years = _compute_age(manufacture_year, current_year)
    age_deduction = min(age_years * 0.035, 0.28)
    mileage_deduction = _mileage_deduction(mileage_km)
    damage_deduction = min(sum(SEVERITY_DEDUCTION.get(item.get("severity"), 0.02) for item in damages), 0.35)
    condition_deduction = min(max(0.0, 8.5 - condition_score) * 0.02, 0.18)

    total_deduction = min(age_deduction + mileage_deduction + damage_deduction + condition_deduction, 0.72)
    multiplier = max(0.28, 1.0 - total_deduction)
    estimated_value = round(reference_price * multiplier, 2)

    uncertainty = min(0.12, 0.05 + (len(damages) * 0.01))
    min_value = round(estimated_value * (1 - uncertainty), 2)
    max_value = round(estimated_value * (1 + uncertainty), 2)

    breakdown = [
        _breakdown_item("base_price", reference_price, "Reference price before deductions."),
        _breakdown_item("age_adjustment", age_deduction, f"Vehicle age: {age_years} year(s)."),
        _breakdown_item("mileage_adjustment", mileage_deduction, _mileage_note(mileage_km)),
        _breakdown_item("damage_adjustment", damage_deduction, _damage_note(damages)),
        _breakdown_item("condition_adjustment", condition_deduction, f"Condition score: {round(condition_score, 1)}/10."),
    ]

    return {
        "reference_price": round(reference_price, 2),
        "estimated_value": estimated_value,
        "estimated_value_min": min_value,
        "estimated_value_max": max_value,
        "currency": currency.upper(),
        "pricing_confidence": _pricing_confidence(damages, condition_score),
        "adjustment_breakdown": breakdown,
        "pricing_notes": _pricing_notes(age_years, mileage_km, damages, condition_score),
    }


def _compute_age(manufacture_year: int | None, current_year: int) -> int:
    if manufacture_year is None:
        return 0
    if manufacture_year > current_year:
        raise ValueError("manufacture_year cannot be in the future")
    return max(0, current_year - manufacture_year)


def _mileage_deduction(mileage_km: int | None) -> float:
    if mileage_km is None:
        return 0.0
    if mileage_km < 0:
        raise ValueError("mileage_km cannot be negative")
    if mileage_km <= 20_000:
        return 0.0
    return min(((mileage_km - 20_000) / 10_000) * 0.006, 0.18)


def _mileage_note(mileage_km: int | None) -> str:
    if mileage_km is None:
        return "Mileage not provided."
    return f"Mileage considered: {mileage_km:,} km."


def _damage_note(damages: list[dict]) -> str:
    if not damages:
        return "No visible damage deduction applied."
    summary = {}
    for item in damages:
        severity = item.get("severity", "minor")
        summary[severity] = summary.get(severity, 0) + 1
    ordered = ", ".join(f"{count} {severity}" for severity, count in sorted(summary.items()))
    return f"Visible damage considered: {ordered}."


def _pricing_confidence(damages: list[dict], condition_score: float) -> str:
    if len(damages) >= 4 or condition_score <= 4.0:
        return "MEDIUM"
    return "HIGH" if len(damages) <= 2 else "MEDIUM"


def _pricing_notes(age_years: int, mileage_km: int | None, damages: list[dict], condition_score: float) -> str:
    parts = [
        f"Baseline valuation is adjusted from the provided reference price using visible condition score {round(condition_score, 1)}/10."
    ]
    if age_years:
        parts.append(f"Age adjustment applied for {age_years} year(s) of use.")
    if mileage_km is not None:
        parts.append(f"Mileage adjustment applied for {mileage_km:,} km.")
    if damages:
        parts.append(f"Visible damage count used in pricing: {len(damages)}.")
    else:
        parts.append("No visible damage was detected in the supplied media.")
    return " ".join(parts)


def _breakdown_item(name: str, value: float, note: str) -> dict:
    if name == "base_price":
        return {
            "label": name,
            "type": "absolute",
            "amount": round(value, 2),
            "note": note,
        }
    return {
        "label": name,
        "type": "deduction_ratio",
        "amount": round(value, 4),
        "note": note,
    }
