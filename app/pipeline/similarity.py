"""
pipeline/similarity.py — Cosine similarity + verdict + confidence
"""

import numpy as np
from app.pipeline.embedder import generate_embedding


def cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    """Cosine similarity → persentase 0–100%."""
    dot = np.dot(vec_a, vec_b)
    na  = np.linalg.norm(vec_a)
    nb  = np.linalg.norm(vec_b)
    if na == 0 or nb == 0:
        return 0.0
    return round(float(np.clip(dot / (na * nb), 0.0, 1.0)) * 100, 2)


def compare_frame_sets(frames_a: list, frames_b: list) -> tuple:
    """
    CLIP encode + pairwise compare + average.
    Return: (avg_score, frame_scores, best_emb_a, best_emb_b)
    """
    pairs      = min(len(frames_a), len(frames_b))
    scores     = []
    emb_a_list = []
    emb_b_list = []

    for i in range(pairs):
        ea = generate_embedding(frames_a[i])
        eb = generate_embedding(frames_b[i])
        emb_a_list.append(ea)
        emb_b_list.append(eb)
        scores.append(cosine_similarity(ea, eb))

    avg_score  = round(float(np.mean(scores)), 2) if scores else 0.0
    best_emb_a = emb_a_list[0].tolist() if emb_a_list else []
    best_emb_b = emb_b_list[0].tolist() if emb_b_list else []

    return avg_score, scores, best_emb_a, best_emb_b


def get_verdict(score: float) -> str:
    if score >= 85:   return "HIGH_SIMILARITY"
    elif score >= 60: return "MODERATE_SIMILARITY"
    elif score >= 35: return "LOW_SIMILARITY"
    else:             return "DIFFERENT"


def get_confidence(scores: list) -> str:
    if len(scores) < 2:
        return "LOW"
    std = float(np.std(scores))
    if std < 5.0:    return "HIGH"
    elif std < 10.0: return "MEDIUM"
    else:            return "LOW"