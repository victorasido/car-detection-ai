"""
pipeline/embedder.py — CLIP model singleton + embedding generation
"""

import numpy as np
import torch
import clip
import cv2
from PIL import Image
from app.config import CLIP_MODEL_NAME

# ── CLIP Singleton — load sekali saat import ───
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

print(f"[CLIP] Loading model '{CLIP_MODEL_NAME}' on {DEVICE.upper()}...")
_clip_model, _clip_preprocess = clip.load(CLIP_MODEL_NAME, device=DEVICE)
_clip_model.eval()
print(f"[CLIP] Model ready ✓  (device: {DEVICE.upper()})")


def frame_to_pil(frame: np.ndarray) -> Image.Image:
    """Konversi OpenCV BGR → PIL RGB."""
    return Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))


def generate_embedding(frame: np.ndarray) -> np.ndarray:
    """CLIP ViT-B/32 → 512-d L2-normalized semantic vector."""
    pil_image    = frame_to_pil(frame)
    image_tensor = _clip_preprocess(pil_image).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        embedding = _clip_model.encode_image(image_tensor)
        embedding = embedding / embedding.norm(dim=-1, keepdim=True)

    return embedding.cpu().numpy().flatten()