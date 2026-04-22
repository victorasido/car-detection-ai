"""
cleanup_temp.py — Delete stale temporary files from the upload temp directory.

Run periodically (e.g., every hour via cron or Windows Task Scheduler):
  python cleanup_temp.py

A file is considered stale if it is older than MAX_AGE_HOURS.
Only files matching TEMP_GLOB are targeted; subdirectories are skipped.
"""

import os
import glob
import time
import tempfile

# ── Config ────────────────────────────────────────────────────────
# How old a file must be (in hours) before it is deleted.
MAX_AGE_HOURS = 2

# Glob patterns inside tempdir to clean up — matches typical FastAPI upload spill
TEMP_GLOBS = [
    "*.mp4", "*.mov", "*.mkv", "*.avi",   # video uploads
    "*.jpg", "*.jpeg", "*.png",            # image uploads
    "upload_*", "tmp_*",                   # generic prefixed temp files
]

TEMP_DIR = tempfile.gettempdir()
MAX_AGE_SECS = MAX_AGE_HOURS * 3600
# ─────────────────────────────────────────────────────────────────


def cleanup():
    now = time.time()
    deleted = 0
    errors = 0

    for pattern in TEMP_GLOBS:
        full_pattern = os.path.join(TEMP_DIR, pattern)
        for filepath in glob.glob(full_pattern):
            if not os.path.isfile(filepath):
                continue
            try:
                age = now - os.path.getmtime(filepath)
                if age > MAX_AGE_SECS:
                    os.unlink(filepath)
                    print(f"[Cleanup] Deleted stale temp file: {filepath} (age {age/3600:.1f}h)")
                    deleted += 1
            except OSError as exc:
                print(f"[Cleanup] Could not delete {filepath}: {exc}")
                errors += 1

    print(f"[Cleanup] Done — {deleted} files deleted, {errors} errors.")


if __name__ == "__main__":
    cleanup()
