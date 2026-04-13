"""
Unit tests for Phase 3 dataset export helpers.
"""

import json
import os
import shutil
import sys
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.training.yolo_dataset import build_review_manifest, export_yolo_dataset


def _reset_workspace_dir(name: str) -> Path:
    path = Path(__file__).resolve().parent / ".tmp" / name
    if path.exists():
        shutil.rmtree(path, ignore_errors=True)
    path.mkdir(parents=True, exist_ok=True)
    return path


def test_build_review_manifest():
    tmpdir = _reset_workspace_dir("manifest_case")
    manifest_path = tmpdir / "review" / "manifest.jsonl"
    build_review_manifest(
        [
            {
                "session_id": "abc-123",
                "frame_path": "damage/abc-123/frame.jpg",
                "damages": [{"type": "dent"}, {"type": "scratch"}],
                "media_info": {"resolution": "640x480"},
                "analysis_notes": "Needs review",
            }
        ],
        manifest_path,
    )

    lines = manifest_path.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 1
    payload = json.loads(lines[0])
    assert payload["session_id"] == "abc-123"
    assert payload["suggested_damage_types"] == ["dent", "scratch"]
    assert payload["annotation_status"] == "pending"


def test_export_yolo_dataset():
    root = _reset_workspace_dir("export_case")
    image_dir = root / "images_src"
    image_dir.mkdir(parents=True, exist_ok=True)

    image_a = image_dir / "sample_a.jpg"
    image_b = image_dir / "sample_b.jpg"
    image_a.write_bytes(b"fake-jpg-a")
    image_b.write_bytes(b"fake-jpg-b")

    reviewed_path = root / "reviewed.jsonl"
    reviewed_path.write_text(
        "\n".join(
            [
                json.dumps(
                    {
                        "image_file": str(image_a),
                        "image_width": 1000,
                        "image_height": 500,
                        "split": "train",
                        "annotations": [{"class": "dent", "bbox": [100, 50, 400, 250]}],
                    }
                ),
                json.dumps(
                    {
                        "image_file": str(image_b),
                        "image_width": 800,
                        "image_height": 400,
                        "split": "val",
                        "annotations": [{"class": "scratch", "bbox": [80, 40, 240, 140]}],
                    }
                ),
            ]
        ),
        encoding="utf-8",
    )

    exported = export_yolo_dataset(reviewed_path, root / "yolo")

    train_label = Path(exported["dataset_root"]) / "labels" / "train" / "sample_a.txt"
    val_label = Path(exported["dataset_root"]) / "labels" / "val" / "sample_b.txt"
    data_yaml = Path(exported["data_yaml"])

    assert train_label.exists()
    assert val_label.exists()
    assert data_yaml.exists()
    assert exported["counts"]["train"] == 1
    assert exported["counts"]["val"] == 1

    train_line = train_label.read_text(encoding="utf-8").strip()
    assert train_line == "0 0.250000 0.300000 0.300000 0.400000"

    val_line = val_label.read_text(encoding="utf-8").strip()
    assert val_line == "1 0.200000 0.225000 0.200000 0.250000"


if __name__ == "__main__":
    try:
        test_build_review_manifest()
        test_export_yolo_dataset()
        print("phase3 training tests passed")
    finally:
        tmp_root = Path(__file__).resolve().parent / ".tmp"
        if tmp_root.exists():
            shutil.rmtree(tmp_root, ignore_errors=True)
