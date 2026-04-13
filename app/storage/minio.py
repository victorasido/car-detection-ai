"""
storage/minio.py — DEPRECATED. DO NOT USE IN NEW CODE.

This module is kept only as a backward-compatibility shim for any
legacy code paths that may still import from it.

All new code must import from app.storage.object_store instead.
"""

import warnings

from app.storage.object_store import (
    save_frame,
    get_frame_data,
    get_public_url,
    get_presigned_url,
    _build_client as get_minio_client,
)

warnings.warn(
    "app.storage.minio is deprecated. Import from app.storage.object_store instead.",
    DeprecationWarning,
    stacklevel=2,
)

__all__ = ["save_frame", "get_frame_data", "get_public_url", "get_presigned_url", "get_minio_client"]