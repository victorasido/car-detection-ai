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
