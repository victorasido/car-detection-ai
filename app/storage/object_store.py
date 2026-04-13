"""
storage/object_store.py — Provider-agnostic object storage adapter.

Implements a clean interface that supports:
  - Local MinIO (dev)
  - AWS S3     (STORAGE_PROVIDER=s3)
  - Cloudflare R2 (STORAGE_PROVIDER=r2)

The rest of the codebase should ONLY import from this module,
never from minio.py or any provider-specific module directly.

Design: Adapter Pattern + Factory Function
"""

from __future__ import annotations

import cv2
import io
import numpy as np
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from typing import Optional

from app.config import (
    STORAGE_PROVIDER,
    STORAGE_ACCESS_KEY,
    STORAGE_SECRET_KEY,
    STORAGE_BUCKET,
    STORAGE_ENDPOINT,
    STORAGE_REGION,
    STORAGE_CDN_BASE_URL,
)


# ─────────────────────────────────────────────────────────
# Internal: Build the boto3 S3 client based on provider
# ─────────────────────────────────────────────────────────

def _build_client():
    """
    Build and return a boto3 S3 client configured for the active
    storage provider (MinIO / S3 / R2).

    All three are S3-API-compatible, so boto3 handles all of them —
    the only difference is the endpoint_url and regional config.
    """
    provider = STORAGE_PROVIDER.lower()

    # boto3 config: disable path-style for S3, enable for MinIO/R2
    use_path_style = provider in ("minio", "r2")

    boto_config = Config(
        signature_version="s3v4",
        s3={"addressing_style": "path" if use_path_style else "auto"},
        retries={"max_attempts": 3, "mode": "standard"},
    )

    kwargs = dict(
        service_name          = "s3",
        aws_access_key_id     = STORAGE_ACCESS_KEY,
        aws_secret_access_key = STORAGE_SECRET_KEY,
        config                = boto_config,
    )

    # S3 uses AWS's own routing — no endpoint_url needed
    if provider == "s3":
        kwargs["region_name"] = STORAGE_REGION
    else:
        # MinIO and Cloudflare R2 require explicit endpoint
        kwargs["endpoint_url"]  = STORAGE_ENDPOINT
        kwargs["region_name"]   = STORAGE_REGION or "auto"

    return boto3.client(**kwargs)


def _ensure_bucket(client) -> None:
    """Create bucket if it doesn't exist. Only meaningful for local MinIO."""
    if STORAGE_PROVIDER.lower() != "minio":
        # R2 and S3 buckets are pre-created via the provider's console/CLI
        return
    try:
        client.head_bucket(Bucket=STORAGE_BUCKET)
    except ClientError:
        client.create_bucket(Bucket=STORAGE_BUCKET)
        print(f"[Storage][MinIO] Bucket '{STORAGE_BUCKET}' created ✓")


# ─────────────────────────────────────────────────────────
# Public Interface — use these in the rest of the app
# ─────────────────────────────────────────────────────────

def save_frame(frame: np.ndarray, object_key: str) -> bool:
    """
    Encode an OpenCV frame as JPEG and upload it to the configured
    object storage provider.

    Args:
        frame:      OpenCV BGR image (np.ndarray)
        object_key: Storage path, e.g. "sessions/abc123/frame_a.jpg"

    Returns:
        True on success, False on failure.
    """
    try:
        client = _build_client()
        _ensure_bucket(client)

        _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 90])

        client.put_object(
            Bucket      = STORAGE_BUCKET,
            Key         = object_key,
            Body        = buffer.tobytes(),
            ContentType = "image/jpeg",
        )

        provider = STORAGE_PROVIDER.upper()
        print(f"[Storage][{provider}] Saved → {object_key}")
        return True

    except Exception as e:
        print(f"[Storage] save_frame failed ({object_key}): {e}")
        return False


def get_frame_data(object_key: str) -> Optional[bytes]:
    """
    Download raw image bytes from storage.

    Args:
        object_key: Storage path, e.g. "sessions/abc123/frame_a.jpg"

    Returns:
        Raw bytes on success, None on failure.
    """
    try:
        client = _build_client()
        response = client.get_object(Bucket=STORAGE_BUCKET, Key=object_key)
        return response["Body"].read()
    except Exception as e:
        print(f"[Storage] get_frame_data failed ({object_key}): {e}")
        return None


def get_public_url(object_key: str) -> str:
    """
    Return the publicly accessible CDN URL for a stored object.

    In development (MinIO): returns the direct MinIO URL.
    In production (S3/R2 with CDN): returns the CDN base URL + key.

    Args:
        object_key: Storage path, e.g. "sessions/abc123/frame_a.jpg"

    Returns:
        Full public URL string.
    """
    if STORAGE_CDN_BASE_URL:
        base = STORAGE_CDN_BASE_URL.rstrip("/")
        return f"{base}/{object_key}"

    # Fallback: construct direct URL from endpoint
    if STORAGE_ENDPOINT:
        base = STORAGE_ENDPOINT.rstrip("/")
        return f"{base}/{STORAGE_BUCKET}/{object_key}"

    # AWS S3 without a CDN
    return f"https://{STORAGE_BUCKET}.s3.{STORAGE_REGION}.amazonaws.com/{object_key}"


def get_presigned_url(object_key: str, expires_in: int = 3600) -> Optional[str]:
    """
    Generate a time-limited pre-signed URL for private object access.

    Useful for serving images in the Review Dashboard without making
    the bucket fully public.

    Args:
        object_key:  Storage path key.
        expires_in:  URL validity in seconds (default: 1 hour).

    Returns:
        Pre-signed URL string, or None on failure.
    """
    try:
        client = _build_client()
        url = client.generate_presigned_url(
            "get_object",
            Params     = {"Bucket": STORAGE_BUCKET, "Key": object_key},
            ExpiresIn  = expires_in,
        )
        return url
    except Exception as e:
        print(f"[Storage] get_presigned_url failed ({object_key}): {e}")
        return None
