"""
pipeline/explainer.py — GPT-4o-mini visual explanation
"""

import base64
import cv2
import numpy as np
from openai import OpenAI
from app.config import OPENAI_API_KEY, GPT_MODEL


def get_openai_client():
    """Return OpenAI client kalau API key tersedia, None kalau tidak."""
    if not OPENAI_API_KEY:
        return None
    return OpenAI(api_key=OPENAI_API_KEY)


def frame_to_base64(frame: np.ndarray, quality: int = 85) -> str:
    """Konversi frame OpenCV → base64 JPEG string."""
    _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return base64.b64encode(buffer).decode("utf-8")


def generate_explanation(
    frame_a:          np.ndarray,
    frame_b:          np.ndarray,
    similarity_score: float,
    verdict:          str,
    confidence:       str,
) -> tuple:
    """
    Kirim 2 frame terbaik + skor ke GPT-4o-mini → natural language explanation.
    Return: (explanation_text, model_name)
    """
    client = get_openai_client()

    if client is None:
        return (
            f"Visual similarity score: {similarity_score}%. "
            f"Verdict: {verdict}. Confidence: {confidence}. "
            f"(AI explanation unavailable — set OPENAI_API_KEY to enable.)",
            "none"
        )

    prompt = f"""You are a vehicle visual analysis expert.

You are given two video frames extracted from different vehicle videos, along with their computed similarity metrics:

- Similarity Score: {similarity_score}%
- Verdict: {verdict}
- Confidence: {confidence}

Analyze both images carefully and provide a detailed explanation of 3–5 sentences in English. Your explanation should:
1. Describe the visual characteristics you observe in both frames (vehicle type, color, shape, angle)
2. Explain whether the vehicles appear to be the same or different, and why
3. Reference the similarity score and what it means in context
4. Note any factors that might affect the accuracy (lighting, angle, occlusion, image quality)

Be specific and factual. Do not speculate beyond what is visually observable."""

    try:
        response = client.chat.completions.create(
            model      = GPT_MODEL,
            max_tokens = 300,
            messages   = [{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{frame_to_base64(frame_a)}", "detail": "low"}},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{frame_to_base64(frame_b)}", "detail": "low"}},
                ],
            }],
        )
        return response.choices[0].message.content.strip(), GPT_MODEL

    except Exception as e:
        fallback = (
            f"The two video frames were compared using CLIP ViT-B/32 visual embeddings. "
            f"The similarity score is {similarity_score}%, resulting in a verdict of {verdict} "
            f"with {confidence} confidence. (Detailed AI explanation unavailable: {str(e)})"
        )
        return fallback, f"{GPT_MODEL}-fallback"