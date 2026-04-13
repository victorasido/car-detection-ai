from fastapi import APIRouter, Depends, HTTPException, Response
from app.api.schemas import AnnotationIn
from app.storage.auth import get_current_user
from app.storage.postgres import get_pending_analyses, save_annotation
from app.storage.minio import get_frame_data

router = APIRouter(prefix="/admin", tags=["Admin & Review"])

@router.get("/pending")
async def pending_list(limit: int = 50, current_user: dict = Depends(get_current_user)):
    return get_pending_analyses(limit)


@router.post("/approve")
async def approve_annotation(item: AnnotationIn, current_user: dict = Depends(get_current_user)):
    ok = save_annotation(item.analysis_id, item.bboxes, current_user["user_id"])
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to save annotation")
    return {"status": "ok"}


@router.get("/frame/{session_id}")
async def proxy_frame(session_id: str, path: str, current_user: dict = Depends(get_current_user)):
    """Proxy image from MinIO to the browser to avoid CORS/access issues."""
    data = get_frame_data(path)
    if data is None:
        raise HTTPException(status_code=404, detail="Frame not found")
    return Response(content=data, media_type="image/jpeg")
