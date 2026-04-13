# Phase 3 Training Scaffold

This folder prepares reviewed damage annotations for YOLO training.

## Flow

1. Collect damage-analysis records from Phase 2.
2. Build a review manifest with `build_review_manifest(...)`.
3. Human annotators add bounding boxes and save reviewed JSONL.
4. Convert the reviewed JSONL into YOLO folders with `export_yolo_dataset(...)`.
5. Train with a command like:

```bash
yolo detect train data=app/training/output/data.yaml model=yolov8n.pt epochs=50 imgsz=640
```

## Reviewed JSONL format

Each line should look like:

```json
{
  "image_file": "C:/dataset/images/sample.jpg",
  "image_width": 1280,
  "image_height": 720,
  "split": "train",
  "annotations": [
    {"class": "dent", "bbox": [120, 80, 420, 240]}
  ]
}
```

`bbox` uses absolute pixel coordinates in `[x1, y1, x2, y2]` format.
