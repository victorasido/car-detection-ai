"""
Focused unit tests for Phase 1/2 backend logic that do not require CLIP,
FastAPI startup, or live OpenAI calls.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.pipeline.damage_analyzer import _validate_report
from app.pipeline.valuation import estimate_vehicle_value


def test_damage_report_validation():
    report = _validate_report(
        {
            "damages": [
                {
                    "type": "Dent",
                    "severity": "Severe",
                    "location": "Front Left Bumper",
                    "description": "Large dent is visible on the bumper.",
                },
                {
                    "type": "mystery",
                    "severity": "meh",
                    "location": "",
                    "description": "",
                },
                "ignore-me",
            ],
            "overall_condition": "bad",
            "condition_score": 4.7,
            "repair_urgency": "now",
            "analysis_notes": "",
        }
    )

    assert report["estimated_damage_count"] == 2
    assert report["damages"][0]["type"] == "dent"
    assert report["damages"][0]["severity"] == "severe"
    assert report["damages"][0]["location"] == "front_left_bumper"
    assert report["damages"][1]["type"] == "scratch"
    assert report["damages"][1]["severity"] == "minor"
    assert report["overall_condition"] == "poor"
    assert report["repair_urgency"] == "critical"
    assert report["analysis_notes"]


def test_vehicle_valuation():
    report = {
        "damages": [
            {"type": "scratch", "severity": "minor", "location": "hood", "description": "Small scratch"},
            {"type": "dent", "severity": "moderate", "location": "front_bumper", "description": "Moderate dent"},
        ],
        "overall_condition": "fair",
        "condition_score": 6.2,
        "repair_urgency": "recommended",
        "estimated_damage_count": 2,
        "analysis_notes": "Visible cosmetic damage.",
    }

    valuation = estimate_vehicle_value(
        reference_price=250_000_000,
        damage_report=report,
        manufacture_year=2021,
        mileage_km=48_000,
        currency="idr",
        current_year=2026,
    )

    assert valuation["currency"] == "IDR"
    assert valuation["estimated_value"] < valuation["reference_price"]
    assert valuation["estimated_value_min"] < valuation["estimated_value"] < valuation["estimated_value_max"]
    assert valuation["pricing_confidence"] in {"HIGH", "MEDIUM"}
    assert len(valuation["adjustment_breakdown"]) == 5


if __name__ == "__main__":
    test_damage_report_validation()
    test_vehicle_valuation()
    print("phase12 tests passed")
