import cv2
import numpy as np
import boto3
from botocore.exceptions import ClientError
from app.config import MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET


def get_minio_client():
    return boto3.client(
        "s3",
        endpoint_url          = MINIO_ENDPOINT,
        aws_access_key_id     = MINIO_ACCESS_KEY,
        aws_secret_access_key = MINIO_SECRET_KEY,
    )


def ensure_bucket_exists(client):
    """Buat bucket kalau belum ada."""
    try:
        client.head_bucket(Bucket=MINIO_BUCKET)
    except ClientError:
        client.create_bucket(Bucket=MINIO_BUCKET)
        print(f"[MinIO] Bucket '{MINIO_BUCKET}' created ✓")


def save_frame(frame: np.ndarray, object_key: str) -> bool:
    """
    Simpan 1 frame OpenCV ke MinIO sebagai JPEG.
    Object key format: {session_id}/frame_a.jpg
    Return True kalau sukses.
    """
    try:
        client = get_minio_client()
        ensure_bucket_exists(client)

        _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
        client.put_object(
            Bucket      = MINIO_BUCKET,
            Key         = object_key,
            Body        = buffer.tobytes(),
            ContentType = "image/jpeg",
        )
        return True
    except Exception as e:
        print(f"[MinIO] Save failed ({object_key}): {e}")
        return False