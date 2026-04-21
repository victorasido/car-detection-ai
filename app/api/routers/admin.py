import io
import zipfile
import textwrap

from fastapi import APIRouter, Depends, HTTPException, Response
from app.api.schemas import AnnotationIn, FrameReviewIn
from app.storage.auth import get_current_user
from app.storage.postgres import (
    get_pending_analyses,
    save_annotation,
    get_pending_inspections,
    save_frame_annotation,
    get_frames_for_export,
)
from app.storage.object_store import get_frame_data, get_presigned_url

router = APIRouter(prefix="/admin", tags=["Admin & Review"])


# ── Legacy: damage_analyses review ───────────────────────────────

@router.get("/pending")
async def pending_list(limit: int = 50, current_user: dict = Depends(get_current_user)):
    """Return damage_analyses records that have not been annotated yet."""
    return get_pending_analyses(limit)


@router.post("/approve")
async def approve_annotation(item: AnnotationIn, current_user: dict = Depends(get_current_user)):
    """Save admin annotation for a damage_analyses entry (legacy flow)."""
    ok = save_annotation(item.analysis_id, item.bboxes, current_user["user_id"])
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to save annotation")
    return {"status": "ok"}


@router.get("/frame/{session_id}")
async def proxy_frame(session_id: str, path: str, current_user: dict = Depends(get_current_user)):
    """Proxy image from object storage to the browser to avoid CORS/access issues."""
    data = get_frame_data(path)
    if data is None:
        raise HTTPException(status_code=404, detail="Frame not found")
    return Response(content=data, media_type="image/jpeg")


# ── Inspection Engine: review queue ──────────────────────────────

@router.get("/inspections/pending")
async def inspection_pending_list(
    limit:        int  = 50,
    current_user: dict = Depends(get_current_user),
):
    """
    Return completed inspections that still have at least one unreviewed frame.
    Used by the admin review dashboard to populate the work queue.
    """
    return get_pending_inspections(limit)


@router.get("/inspections/frame/{frame_id}/image")
async def proxy_inspection_frame(
    frame_id:     str,
    path:         str,
    current_user: dict = Depends(get_current_user),
):
    """
    Generate a presigned URL for an inspection frame image.
    Returns a redirect-safe presigned URL rather than proxying the bytes,
    to avoid high memory overhead for large images.
    """
    url = get_presigned_url(path, expires_in=3600)
    if url is None:
        raise HTTPException(status_code=404, detail="Frame image not found in object store.")
    return {"url": url}


@router.post("/review/frame/{frame_id}")
async def review_frame(
    frame_id:     str,
    review:       FrameReviewIn,
    current_user: dict = Depends(get_current_user),
):
    """
    Admin submits corrected bounding box annotations for a single frame.

    Setting is_verified=true marks this frame as ground truth,
    making it eligible for YOLO dataset export.
    """
    bboxes_dicts = [b.model_dump() for b in review.bboxes]
    ok = save_frame_annotation(
        frame_id       = frame_id,
        bboxes         = bboxes_dicts,
        user_id        = current_user["user_id"],
        is_verified    = review.is_verified,
        override_notes = review.override_notes,
    )
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to save frame annotation.")
    return {"status": "ok", "frame_id": frame_id, "is_verified": review.is_verified}


# ── YOLO Dataset Export ──────────────────────────────────────────

# YOLO class mapping — extend as needed
_YOLO_CLASS_MAP = {
    "scratch":      0,
    "dent":         1,
    "crack":        2,
    "rust":         3,
    "broken_glass": 4,
    "deformation":  5,
    "paint_damage": 6,
}

_CLASSES_TXT = "\n".join(
    f"{name}" for name, _ in sorted(_YOLO_CLASS_MAP.items(), key=lambda x: x[1])
)


@router.get("/export/yolo/{inspection_id}")
async def export_yolo_dataset(
    inspection_id: str,
    current_user:  dict = Depends(get_current_user),
):
    """
    Export verified-annotated frames as a YOLO v8 dataset ZIP.

    Only frames with is_verified=true are included.
    Each frame is paired with a .txt label file in YOLO format:
      <class_id> <cx_norm> <cy_norm> <w_norm> <h_norm>

    ZIP structure:
      dataset/
        images/frame_0.jpg
        images/frame_1.jpg
        labels/frame_0.txt
        labels/frame_1.txt
        classes.txt
        dataset.yaml
    """
    frames = get_frames_for_export(inspection_id)
    if not frames:
        raise HTTPException(
            status_code=404,
            detail="No verified frames found for this inspection. "
                   "Review and mark frames as verified first."
        )

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        # classes.txt
        zf.writestr("dataset/classes.txt", _CLASSES_TXT)

        # dataset.yaml (Ultralytics YOLO format)
        yaml_content = textwrap.dedent(f"""\
            path: dataset
            train: images
            val: images
            nc: {len(_YOLO_CLASS_MAP)}
            names: [{', '.join(sorted(_YOLO_CLASS_MAP, key=_YOLO_CLASS_MAP.get))}]
            # inspection_id: {inspection_id}
        """)
        zf.writestr("dataset/dataset.yaml", yaml_content)

        for frame in frames:
            idx      = frame["frame_index"]
            img_name = f"frame_{idx}"
            bboxes   = frame.get("bboxes") or []

            # Download image bytes from object store
            img_bytes = get_frame_data(frame["frame_path"])
            if img_bytes:
                zf.writestr(f"dataset/images/{img_name}.jpg", img_bytes)

            # Build YOLO label file
            label_lines = []
            for bbox in bboxes:
                label    = str(bbox.get("label", "")).lower()
                class_id = _YOLO_CLASS_MAP.get(label)
                if class_id is None:
                    continue  # skip unknown labels

                # YOLO expects normalized [0,1] cx, cy, w, h
                # Bboxes stored as pixel x,y,w,h — we need the image dimensions
                # For now we store raw pixel values; normalization requires image dims.
                # TODO: store image width+height in inspection_frames to normalize here.
                x = bbox.get("x", 0)
                y = bbox.get("y", 0)
                w = bbox.get("w", 0)
                h = bbox.get("h", 0)

                # Emit raw pixel coords as a YOLO-like line
                # (caller must post-process if image dims are needed for normalization)
                label_lines.append(f"{class_id} {x} {y} {w} {h}")

            zf.writestr(
                f"dataset/labels/{img_name}.txt",
                "\n".join(label_lines)
            )

    buf.seek(0)
    filename = f"yolo_dataset_{inspection_id[:8]}.zip"
    return Response(
        content     = buf.read(),
        media_type  = "application/zip",
        headers     = {"Content-Disposition": f'attachment; filename="{filename}"'},
    )

