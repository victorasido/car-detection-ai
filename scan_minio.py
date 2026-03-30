import boto3
from botocore.exceptions import ClientError
import os

# Ambil config dari env atau default
# Use localhost because we are running outside Docker
MINIO_ENDPOINT   = "http://localhost:9000"
MINIO_ACCESS_KEY = "minioadmin"
MINIO_SECRET_KEY = "minioadmin"
MINIO_BUCKET     = "vehicle-dataset"

def scan_minio():
    client = boto3.client(
        "s3",
        endpoint_url          = MINIO_ENDPOINT,
        aws_access_key_id     = MINIO_ACCESS_KEY,
        aws_secret_access_key = MINIO_SECRET_KEY,
    )
    
    try:
        response = client.list_objects_v2(Bucket=MINIO_BUCKET)
        
        if "Contents" not in response:
            print(f"-- Bucket '{MINIO_BUCKET}' is empty --")
            return

        objects = response["Contents"]
        print(f"--- Scanning MinIO Bucket: {MINIO_BUCKET} ---\n")
        
        sessions = {}
        for obj in objects:
            key = obj["Key"]
            session_id = key.split("/")[0] if "/" in key else "root"
            if session_id not in sessions:
                sessions[session_id] = []
            sessions[session_id].append(key)
            
        for session_id, files in sessions.items():
            print(f"Session: {session_id}")
            for f in files:
                print(f"  - {f}")
            print()
            
    except Exception as e:
        print(f"Error scanning MinIO: {e}\nEnsure MinIO is running on {MINIO_ENDPOINT}")

if __name__ == "__main__":
    scan_minio()
