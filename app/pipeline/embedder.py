"""
pipeline/embedder.py — CLIP model singleton + embedding generation
"""

import numpy as np
import torch
import clip
import cv2
from PIL import Image
from app.config import CLIP_MODEL_NAME

# ── CLIP Singleton — Lazy Load ───
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

_clip_model = None
_clip_preprocess = None

def _get_clip():
    """Lazy loader for CLIP model. Only loads into memory when first requested."""
    global _clip_model, _clip_preprocess
    if _clip_model is None:
        print(f"[CLIP] Lazy loading model '{CLIP_MODEL_NAME}' on {DEVICE.upper()}...")
        _clip_model, _clip_preprocess = clip.load(CLIP_MODEL_NAME, device=DEVICE)
        _clip_model.eval()
        print(f"[CLIP] Model ready [ok] (device: {DEVICE.upper()})")
    return _clip_model, _clip_preprocess


def frame_to_pil(frame: np.ndarray) -> Image.Image:
    """Konversi OpenCV BGR → PIL RGB."""
    return Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))


def generate_embedding(frame: np.ndarray) -> np.ndarray:
    """CLIP ViT-B/32 → 512-d L2-normalized semantic vector."""
    model, preprocess = _get_clip()
    pil_image    = frame_to_pil(frame)
    image_tensor = preprocess(pil_image).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        embedding = model.encode_image(image_tensor)
        embedding = embedding / embedding.norm(dim=-1, keepdim=True)

    return embedding.cpu().numpy().flatten()
