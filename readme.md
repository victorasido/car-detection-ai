# Vehicle Similarity Microservice — Stage 1 MVP

> AI-powered visual comparison pipeline  
> Stage 1: Upload 2 video → ambil frame tengah → cosine similarity → JSON

---

## Struktur Project

```
vehicle-similarity/
├── app/
│   └── main.py          ← FastAPI app + semua logic
├── tests/
│   └── test_api.py      ← Unit test + integration test
├── requirements.txt
└── README.md
```

---

## Setup & Install

```bash
# 1. Buat virtual environment
python -m venv venv
source venv/bin/activate        # Mac/Linux
# venv\Scripts\activate         # Windows

# 2. Install dependencies
pip install -r requirements.txt
```

---

## Jalankan Server

```bash
uvicorn app.main:app --reload
```

Server berjalan di: http://localhost:8000

---

## Test

### Unit test (tanpa server)
```bash
python tests/test_api.py
```

### Integration test (server harus running)
```bash
python tests/test_api.py --integration
```

### Manual test via curl
```bash
curl -X POST http://localhost:8000/compare \
  -F "video_a=@video1.mp4" \
  -F "video_b=@video2.mp4"
```

### Swagger UI
Buka browser: http://localhost:8000/docs

---

## Contoh Response

```json
{
  "similarity_percentage": 82.4,
  "verdict": "HIGH_SIMILARITY",
  "video_a_info": {
    "total_frames": 120,
    "fps": 30.0,
    "resolution": "1920x1080",
    "duration_sec": 4.0,
    "frame_extracted": 60
  },
  "video_b_info": {
    "total_frames": 90,
    "fps": 30.0,
    "resolution": "1280x720",
    "duration_sec": 3.0,
    "frame_extracted": 45
  },
  "processing_time_ms": 234.5,
  "stage": "MVP-v1",
  "note": "Stage 1: pixel-flatten embedding. Upgrade ke CLIP di Stage 3 untuk hasil lebih akurat."
}
```

---

## Verdict Logic

| Score     | Verdict             |
|-----------|---------------------|
| ≥ 85%     | HIGH_SIMILARITY     |
| 60–84%    | MODERATE_SIMILARITY |
| 35–59%    | LOW_SIMILARITY      |
| < 35%     | DIFFERENT           |

---

## Endpoints

| Method | Path       | Deskripsi                        |
|--------|------------|----------------------------------|
| GET    | /          | Info service                     |
| GET    | /health    | Health check                     |
| GET    | /docs      | Swagger UI                       |
| POST   | /compare   | Upload 2 video → similarity JSON |

---

## Pipeline (Stage 1)

```
Video A ──┐
           ├─→ extract_middle_frame()
Video B ──┘        ↓
               preprocess_frame()   ← resize 224x224 + normalize
                   ↓
               generate_embedding() ← pixel flatten (dummy, Stage 1)
                   ↓
               cosine_similarity()  ← formula dot product
                   ↓
               JSON response
```

---

## Roadmap Upgrade

| Stage | Upgrade                          |
|-------|----------------------------------|
| v1    | ✅ Dummy embedding (sekarang)    |
| v2    | Frame selection + sharpness      |
| v3    | CLIP ViT-B/32 real embedding     |
| v4    | GPT-4o-mini explanation          |
| v5    | Docker + UI frontend             |