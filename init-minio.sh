#!/bin/bash

# ── Init MinIO Bucket ────────────────────────────────
# Auto-create bucket "vehicle-dataset" saat MinIO startup
# Note: Runs inside docker network, uses "minio" as hostname

set -e

# Use docker internal hostname "minio" instead of localhost
MINIO_ENDPOINT=${MINIO_ENDPOINT:-http://minio:9000}
MINIO_BUCKET=${MINIO_BUCKET:-vehicle-dataset}
MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY:-minioadmin}
MINIO_SECRET_KEY=${MINIO_SECRET_KEY:-minioadmin}

echo "⏳ Waiting for MinIO at $MINIO_ENDPOINT..."
sleep 15  # Give MinIO time to fully start

# Configure mc alias
echo "🔧 Configuring MinIO client..."
mc alias set minio $MINIO_ENDPOINT $MINIO_ACCESS_KEY $MINIO_SECRET_KEY --api S3v4 || true

# Retry logic untuk create bucket
MAX_RETRIES=10
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    echo "🪣 Attempting to create bucket: $MINIO_BUCKET (attempt $((RETRY_COUNT+1))/$MAX_RETRIES)"
    
    # Create bucket jika belum ada
    if mc ls minio/$MINIO_BUCKET > /dev/null 2>&1; then
        echo "✅ Bucket already exists: $MINIO_BUCKET"
        exit 0
    fi
    
    if mc mb minio/$MINIO_BUCKET 2>/dev/null; then
        echo "✅ Bucket created successfully!"
        exit 0
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
        echo "   Retrying in 3 seconds..."
        sleep 3
    fi
done

echo "⚠️  Could not create bucket after $MAX_RETRIES attempts"
echo "   This might be okay if the bucket already exists"
exit 0
