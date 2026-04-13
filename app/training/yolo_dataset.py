"""
training/yolo_dataset.py - Stage 3 helpers for reviewed damage annotations.

This module bridges Phase 2 outputs into a YOLO-ready dataset:
- build review manifests for human annotation
- convert reviewed bbox annotations into YOLO label files
- write data.yaml for training
"""

from __future__ import annotations

import json
import random
import shutil
import psycopg2
import boto3
from pathlib import Path
from app.config import POSTGRES_DSN, MINIO_BUCKET, MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY

from app.pipeline.damage_analyzer import DAMAGE_TYPES


YOLO_DAMAGE_CLASSES = list(DAMAGE_TYPES)
_CLASS_TO_ID = {label: idx for idx, label in enumerate(YOLO_DAMAGE_CLASSES)}


def build_review_manifest(records: list[dict], manifest_path: str | Path) -> Path:
    """
    Persist a lightweight review manifest from damage-analysis records.

    Expected record keys:
    - session_id
    - frame_path
    - damages
    - media_info
    """
    manifest_file = Path(manifest_path)
    manifest_file.parent.mkdir(parents=True, exist_ok=True)

    with manifest_file.open("w", encoding="utf-8") as handle:
        for record in records:
            item = {
                "session_id": record.get("session_id"),
                "frame_path": record.get("frame_path"),
                "image_file": record.get("image_file"),
                "suggested_damage_types": _suggested_types(record.get("damages", [])),
                "media_info": record.get("media_info", {}),
                "annotation_status": "pending",
                "notes": record.get("analysis_notes", ""),
            }
            handle.write(json.dumps(item, ensure_ascii=True) + "\n")

    return manifest_file


def export_from_db(output_dir: str | Path) -> dict:
    """
    Pulls reviewed annotations from PostgreSQL, downloads images from MinIO,
    and builds a YOLO dataset.
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # 1. Connect to DB
    conn = psycopg2.connect(POSTGRES_DSN)
    cur = conn.cursor()
    
    # 2. Get reviewed annotations
    cur.execute("""
        SELECT a.bboxes, d.frame_path, d.media_info
        FROM damage_annotations a
        JOIN damage_analyses d ON a.analysis_id = d.id
    """)
    rows = cur.fetchall()
    
    # 3. Setup MinIO
    s3 = boto3.client("s3", endpoint_url=MINIO_ENDPOINT, 
                     aws_access_key_id=MINIO_ACCESS_KEY, 
                     aws_secret_access_key=MINIO_SECRET_KEY)
    
    samples = []
    for bboxes, frame_path, media_info in rows:
        # Download image
        local_img = output_path / "raw_images" / Path(frame_path).name
        local_img.parent.mkdir(parents=True, exist_ok=True)
        
        try:
            s3.download_file(MINIO_BUCKET, frame_path, str(local_img))
        except Exception as e:
            print(f"Failed to download {frame_path}: {e}")
            continue

        res = media_info.get("resolution", "1280x720").split("x")
        w, h = int(res[0]), int(res[1])
        
        samples.append({
            "image_file": str(local_img),
            "image_width": w,
            "image_height": h,
            "annotations": [{"class": b["class"], "bbox": [b["x1"], b["y1"], b["x2"], b["y2"]]} for b in bboxes],
            "split": None
        })

    conn.close()

    # Create a temp reviewed_annotations.jsonl
    temp_jsonl = output_path / "reviewed_temp.jsonl"
    with temp_jsonl.open("w") as f:
        for s in samples:
            f.write(json.dumps(s) + "\n")

    return export_yolo_dataset(temp_jsonl, output_path)


def export_yolo_dataset(
    reviewed_annotations_path: str | Path,
    output_dir: str | Path,
    *,
    train_ratio: float = 0.8,
    seed: int = 42,
) -> dict:
    """
    Convert reviewed bbox annotations JSONL into YOLO dataset folders.

    JSONL schema per line:
    {
      "image_file": "C:/.../image.jpg",
      "split": "train|val",           # optional
      "annotations": [
        {"class": "dent", "bbox": [x1, y1, x2, y2]}
      ]
    }
    """
    samples = _load_reviewed_annotations(reviewed_annotations_path)
    if not samples:
        raise ValueError("No reviewed annotations found")

    dataset_root = Path(output_dir)
    for split in ("train", "val"):
        (dataset_root / "images" / split).mkdir(parents=True, exist_ok=True)
        (dataset_root / "labels" / split).mkdir(parents=True, exist_ok=True)

    assigned = _assign_splits(samples, train_ratio=train_ratio, seed=seed)
    counts = {"train": 0, "val": 0, "boxes": 0}

    for sample in assigned:
        split = sample["split"]
        image_src = Path(sample["image_file"])
        if not image_src.exists():
            raise FileNotFoundError(f"Image not found: {image_src}")

        image_dst = dataset_root / "images" / split / image_src.name
        shutil.copy2(image_src, image_dst)

        label_dst = dataset_root / "labels" / split / f"{image_src.stem}.txt"
        yolo_lines = [
            _bbox_to_yolo_line(annotation, sample["image_width"], sample["image_height"])
            for annotation in sample["annotations"]
        ]
        label_dst.write_text("\n".join(yolo_lines), encoding="utf-8")

        counts[split] += 1
        counts["boxes"] += len(yolo_lines)

    yaml_path = write_data_yaml(dataset_root)
    return {
        "dataset_root": str(dataset_root),
        "data_yaml": str(yaml_path),
        "class_names": YOLO_DAMAGE_CLASSES,
        "counts": counts,
    }


def write_data_yaml(output_dir: str | Path) -> Path:
    dataset_root = Path(output_dir)
    yaml_path = dataset_root / "data.yaml"
    names = ", ".join(f"'{label}'" for label in YOLO_DAMAGE_CLASSES)
    yaml_text = (
        f"path: {dataset_root.as_posix()}\n"
        "train: images/train\n"
        "val: images/val\n"
        f"names: [{names}]\n"
    )
    yaml_path.write_text(yaml_text, encoding="utf-8")
    return yaml_path


def _load_reviewed_annotations(reviewed_annotations_path: str | Path) -> list[dict]:
    path = Path(reviewed_annotations_path)
    samples: list[dict] = []

    with path.open("r", encoding="utf-8") as handle:
        for line_number, raw in enumerate(handle, start=1):
            line = raw.strip()
            if not line:
                continue
            payload = json.loads(line)
            samples.append(_validate_reviewed_sample(payload, line_number))

    return samples


def _validate_reviewed_sample(payload: dict, line_number: int) -> dict:
    if not isinstance(payload, dict):
        raise ValueError(f"Line {line_number}: sample must be an object")

    image_file = payload.get("image_file")
    if not image_file:
        raise ValueError(f"Line {line_number}: image_file is required")

    image_width = int(payload.get("image_width") or 0)
    image_height = int(payload.get("image_height") or 0)
    if image_width <= 0 or image_height <= 0:
        raise ValueError(f"Line {line_number}: image_width and image_height must be > 0")

    annotations = payload.get("annotations", [])
    if not isinstance(annotations, list):
        raise ValueError(f"Line {line_number}: annotations must be a list")

    validated_annotations = []
    for idx, annotation in enumerate(annotations, start=1):
        if not isinstance(annotation, dict):
            raise ValueError(f"Line {line_number}: annotation #{idx} must be an object")

        label = str(annotation.get("class", "")).strip().lower()
        if label not in _CLASS_TO_ID:
            raise ValueError(f"Line {line_number}: unknown class '{label}'")

        bbox = annotation.get("bbox")
        if not isinstance(bbox, list) or len(bbox) != 4:
            raise ValueError(f"Line {line_number}: bbox must be [x1, y1, x2, y2]")

        x1, y1, x2, y2 = [float(value) for value in bbox]
        if x2 <= x1 or y2 <= y1:
            raise ValueError(f"Line {line_number}: invalid bbox coordinates")

        validated_annotations.append({"class": label, "bbox": [x1, y1, x2, y2]})

    split = payload.get("split")
    if split is not None and split not in {"train", "val"}:
        raise ValueError(f"Line {line_number}: split must be 'train' or 'val'")

    return {
        "image_file": str(image_file),
        "image_width": image_width,
        "image_height": image_height,
        "annotations": validated_annotations,
        "split": split,
    }


def _assign_splits(samples: list[dict], *, train_ratio: float, seed: int) -> list[dict]:
    if not 0 < train_ratio < 1:
        raise ValueError("train_ratio must be between 0 and 1")

    explicit = [sample for sample in samples if sample["split"] in {"train", "val"}]
    implicit = [sample for sample in samples if sample["split"] is None]

    random.Random(seed).shuffle(implicit)
    cutoff = int(round(len(implicit) * train_ratio))

    assigned = []
    for idx, sample in enumerate(implicit):
        clone = dict(sample)
        clone["split"] = "train" if idx < cutoff else "val"
        assigned.append(clone)

    assigned.extend(explicit)
    return assigned


def _bbox_to_yolo_line(annotation: dict, image_width: int, image_height: int) -> str:
    x1, y1, x2, y2 = _clamp_bbox(annotation["bbox"], image_width, image_height)
    class_id = _CLASS_TO_ID[annotation["class"]]

    box_w = max(0.0, x2 - x1)
    box_h = max(0.0, y2 - y1)
    center_x = x1 + (box_w / 2.0)
    center_y = y1 + (box_h / 2.0)

    return " ".join(
        [
            str(class_id),
            f"{center_x / image_width:.6f}",
            f"{center_y / image_height:.6f}",
            f"{box_w / image_width:.6f}",
            f"{box_h / image_height:.6f}",
        ]
    )


def _clamp_bbox(bbox: list[float], image_width: int, image_height: int) -> tuple[float, float, float, float]:
    x1, y1, x2, y2 = bbox
    x1 = min(max(x1, 0.0), float(image_width))
    y1 = min(max(y1, 0.0), float(image_height))
    x2 = min(max(x2, 0.0), float(image_width))
    y2 = min(max(y2, 0.0), float(image_height))

    if x2 <= x1 or y2 <= y1:
        raise ValueError("Bounding box becomes invalid after clamping")

    return x1, y1, x2, y2


def _suggested_types(damages: object) -> list[str]:
    if not isinstance(damages, list):
        return []

    suggestions = []
    for item in damages:
        if not isinstance(item, dict):
            continue
        label = str(item.get("type", "")).strip().lower()
        if label in _CLASS_TO_ID and label not in suggestions:
            suggestions.append(label)
    return suggestions
