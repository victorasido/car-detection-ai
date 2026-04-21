from pydantic import BaseModel
from typing import List, Optional

class SimilarityResponse(BaseModel):
    session_id:            str
    similarity_percentage: float
    confidence:            str
    verdict:               str
    explanation:           str
    explanation_model:     str
    video_a_info:          dict
    video_b_info:          dict
    frame_scores:          List[float]
    frames_compared:       int
    embedding_model:       str
    device_used:           str
    processing_time_ms:    float
    stage:                 str
    note:                  str
    dataset_saved:         bool
    best_frame_a:          str
    best_frame_b:          str


class DamageItem(BaseModel):
    type:        str
    severity:    str
    location:    str
    description: str


class DamageResponse(BaseModel):
    session_id:             str
    input_type:             str
    damages:                List[DamageItem]
    overall_condition:      str
    condition_score:        float
    repair_urgency:         str
    estimated_damage_count: int
    analysis_notes:         str
    analysis_model:         str
    processing_time_ms:     float
    dataset_saved:          bool
    best_frame:             str


class ValuationAdjustment(BaseModel):
    label:  str
    type:   str
    amount: float
    note:   str


class ValuationResponse(BaseModel):
    session_id:             str
    input_type:             str
    damages:                List[DamageItem]
    overall_condition:      str
    condition_score:        float
    repair_urgency:         str
    estimated_damage_count: int
    estimated_value:        float
    estimated_value_min:    float
    estimated_value_max:    float
    reference_price:        float
    currency:               str
    pricing_confidence:     str
    pricing_notes:          str
    adjustment_breakdown:   List[ValuationAdjustment]
    analysis_model:         str
    processing_time_ms:     float
    dataset_saved:          bool
    best_frame:             str


class UserAuth(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type:   str


class AnnotationIn(BaseModel):
    analysis_id: str
    bboxes:      List[dict]


# ─────────────────────────────────────────────────────────
# Inspection Engine Schemas (Stage 6)
# ─────────────────────────────────────────────────────────

class InspectionSubmitResponse(BaseModel):
    """Returned immediately (202) when a video is submitted for inspection."""
    inspection_id: str
    status:        str    # always "pending" at submission time
    message:       str
    poll_url:      str


class InspectionStatusResponse(BaseModel):
    """Lightweight status + progress — safe to poll every few seconds."""
    inspection_id:  str
    status:         str   # pending | processing | done | failed
    created_at:     Optional[str] = None
    started_at:     Optional[str] = None
    completed_at:   Optional[str] = None
    error_message:  Optional[str] = None
    progress:       Optional[dict] = None


class BBoxItem(BaseModel):
    x:        int
    y:        int
    w:        int
    h:        int
    label:    str
    severity: Optional[str] = None


class FrameReviewIn(BaseModel):
    """Admin submits corrected bounding boxes for a single frame."""
    bboxes:         List[BBoxItem]
    is_verified:    bool            = True
    override_notes: Optional[str]  = None

