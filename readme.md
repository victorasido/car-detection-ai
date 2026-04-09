# Vehicle Similarity Microservice — Stage 5

> AI-powered visual comparison pipeline  
> Upload 2 video → CLIP embedding → cosine similarity → GPT explanation → dataset saving

---

## Struktur Project

```
vehicle-similarity/
├── app/
│   ├── main.py                  ← FastAPI app + endpoints
│   ├── config.py                ← env variable & konstanta
│   ├── pipeline/
│   │   ├── extractor.py         ← frame extraction + sharpness filter
│   │   ├── embedder.py          ← CLIP model + embedding generation
│   │   ├── similarity.py        ← cosine similarity + verdict + confidence
│   │   └── explainer.py         ← GPT-4o-mini visual explanation
│   └── storage/
│       ├── minio.py             ← save frame JPG ke MinIO
│       ├── postgres.py          ← save metadata + embedding ke PostgreSQL
│       └── dataset.py           ← async orchestrator saving
├── frontend/                    ← React UI
│   └── src/
│       └── components/          ← UI Components (DropZone, ResultCard, dsb)
├── test/
│   └── test_api.py              ← unit test + integration test
├── .env                         ← API keys & credentials (jangan di-commit!)
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
└── requirements.txt
```

---

## Setup & Jalankan

### Prasyarat
- Docker & Docker Compose terinstall
- OpenAI API key (opsional — untuk GPT explanation)

### 1. Clone & konfigurasi `.env`

```bash
git clone <repo-url>
cd cars
```

Isi file `.env`:

```env
OPENAI_API_KEY=sk-xxxx       # opsional

MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=vehicle-dataset

POSTGRES_PASSWORD=postgres

# Pipeline tuning (Optional)
EXTRACT_N_FRAMES=5           # frame tersebar merata (default: 5)
TOP_K_FRAMES=3               # pilih K tersharp (default: 3)

DATASET_SAVING=true          # set false untuk disable saving sementara

# Security & Limits (Optional)
RATE_LIMIT="30/minute"       # rate limiter API (default: 30/minute)
MAX_UPLOAD_SIZE_MB=100       # max upload per video (default: 100)
MAX_VIDEO_DURATION_SEC=600   # max durasi per video (default: 600)
```

### 2. Jalankan semua service

```bash
docker-compose up --build
```

Service yang berjalan:

| Service    | URL                          | Keterangan              |
|------------|------------------------------|-------------------------|
| Backend    | http://localhost:8000        | FastAPI + CLIP          |
| Frontend   | http://localhost:3000        | React UI                |
| MinIO API  | http://localhost:9000        | Object storage          |
| MinIO UI   | http://localhost:9001        | Web console (minioadmin/minioadmin) |
| PostgreSQL | localhost:5432               | Metadata + embeddings   |

---

## Test

### Manual test via curl

```bash
curl -X POST http://localhost:8000/compare \
  -F "video_a=@video1.mp4" \
  -F "video_b=@video2.mp4"
```

### Swagger UI

Buka browser: http://localhost:8000/docs

### Unit test

```bash
python test/test_api.py
```

### Integration test (server harus running)

```bash
python test/test_api.py --integration
```

---

## Contoh Response

```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "similarity_percentage": 91.3,
  "confidence": "HIGH",
  "verdict": "HIGH_SIMILARITY",
  "explanation": "Both frames show a silver sedan with matching body lines and roof profile...",
  "explanation_model": "gpt-4o-mini",
  "video_a_info": {
    "total_frames": 120,
    "fps": 30.0,
    "resolution": "1920x1080",
    "duration_sec": 4.0,
    "frames_extracted": 5,
    "frames_used": 3,
    "sharpness_scores": [312.4, 287.1, 201.3, 189.2, 145.6]
  },
  "video_b_info": { "..." : "..." },
  "frame_scores": [92.1, 90.8, 91.0],
  "frames_compared": 3,
  "embedding_model": "CLIP-ViT-B/32",
  "device_used": "CPU",
  "processing_time_ms": 1240.5,
  "dataset_saved": true,
  "stage": "Dataset-v1",
  "note": "Stage 5: CLIP + GPT-4o-mini + auto dataset saving.",
  "best_frame_a": "data:image/jpeg;base64,...",
  "best_frame_b": "data:image/jpeg;base64,..."
}
```

---

## Verdict Logic

| Score   | Verdict             |
|---------|---------------------|
| ≥ 85%   | HIGH_SIMILARITY     |
| 60–84%  | MODERATE_SIMILARITY |
| 35–59%  | LOW_SIMILARITY      |
| < 35%   | DIFFERENT           |

---

## Endpoints

| Method | Path     | Deskripsi                              |
|--------|----------|----------------------------------------|
| GET    | /        | Info service + status                  |
| GET    | /health  | Health check                           |
| GET    | /docs    | Swagger UI                             |
| POST   | /compare | Upload 2 video → similarity + dataset  |

---

## Pipeline Tuning

### Frame Extraction Strategy (Recommended: 5 → 3)

| Config | Use Case | Pros | Cons |
|--------|----------|------|------|
| 5 extract → **3 sharpest** ✅ | **General use** | High accuracy, robust to blur | Slightly slower |
| 5 extract → 2 sharpest | Speed priority | Faster processing | Lower redundancy |
| 1 frame middle | High-speed, controlled | Fastest | Unreliable, sensitive to blur |

**Current default (EXTRACT_N_FRAMES=5, TOP_K_FRAMES=3)** balances accuracy & speed optimally.

Adjust via `.env` to experiment:
```env
# For speed (fast API response)
EXTRACT_N_FRAMES=5
TOP_K_FRAMES=2

# For ultra-accuracy (best precision)
EXTRACT_N_FRAMES=8
TOP_K_FRAMES=4
```

---

## Pipeline (Stage 5)

```
Video A ──┐
           ├─→ extract_frames_evenly()     ← 5 frame tersebar merata
Video B ──┘        ↓
               select_sharpest_frames()    ← pilih 3 frame tersharp (Laplacian)
                   ↓
               generate_embedding()        ← CLIP ViT-B/32 → 512-d vector
                   ↓
               cosine_similarity()         ← pairwise + average
                   ↓
               generate_explanation()      ← GPT-4o-mini + frame visual
                   ↓
               JSON response → user
                   ↓ (background, non-blocking)
               save_frame()               ← frame JPG → MinIO
               save_metadata()            ← score + embedding → PostgreSQL
```

---

## Dataset Saving

Setiap request ke `/compare` otomatis menyimpan:

| Data | Storage | Format |
|------|---------|--------|
| Frame tersharp video A & B | MinIO (`vehicle-dataset` bucket) | JPEG |
| Similarity score, verdict, confidence | PostgreSQL (`comparisons` table) | FLOAT, TEXT |
| CLIP embedding vector (512-d) | PostgreSQL | FLOAT[] |
| Video metadata (fps, resolusi, dll) | PostgreSQL | JSONB |

Path frame di MinIO: `{session_id}/frame_a.jpg`, `{session_id}/frame_b.jpg`

---

## Roadmap

| Stage | Keterangan                          | Status |
|-------|-------------------------------------|--------|
| v1    | Dummy embedding, 1 frame tengah     | ✅ Done |
| v2    | Multi-frame + sharpness filter      | ✅ Done |
| v3    | CLIP ViT-B/32 real embedding        | ✅ Done |
| v4    | GPT-4o-mini explanation             | ✅ Done |
| v5    | Docker + modular refactor + dataset saving | ✅ Done |