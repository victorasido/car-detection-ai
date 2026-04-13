# Vehicle Inspection Platform

Backend AI inspection platform for vehicle similarity, damage analysis, value estimation, and dataset collection.

## 🚀 Concept & Strategy (The Big Picture)

This platform isn't just an app for taking photos; it's a **Data Flywheel** designed to transition from expensive GPT-based analysis to a custom, high-performance local AI model.

1.  **Field Collection (Mobile)**: Operators capture vehicle data. AI (GPT-4o) provides an initial "best guess" for damage and value.
2.  **Human-in-the-Loop (Web Dashboard)**: Admins review AI results. If the AI misses a scratch or misplaces a box, humans correct it using the **Annotation Tool**.
3.  **Gold Standard Dataset**: These human corrections are saved as "Ground Truth" in our database.
4.  **Training Bridge**: Once enough data is collected, we export it directly to **YOLOv8** format.
5.  **Independence**: Eventually, the custom YOLO model replaces GPT, making the system faster, 100% offline-capable, and significantly cheaper to run.

## Current Status

- Phase 1: backend APIs + Auth ready
- Phase 2: damage pipeline + dataset saving ready
- Phase 3: YOLO dataset export + DB integration ready
- Phase 4: Expo React Native mobile with Auth ready
- Phase 5: Web Review Dashboard with Annotation Canvas ready
- Phase 6: Mobile Production Path (Planned)

## Features

- `POST /auth/login` & `POST /auth/register`
  JWT-based authentication for mobile and web users.
- `POST /compare`
  Compare 2 vehicle videos with frame extraction, CLIP embedding, similarity scoring, and GPT explanation.
- `POST /analyze`
  Analyze vehicle damage from photo or video and return normalized JSON.
- `POST /valuation`
  Estimate vehicle value from media + reference price using the damage report as pricing input.
- `GET /admin/pending` & `POST /admin/approve`
  Human-in-the-loop review queue for validating AI-detected damages.
- Web Annotation Dashboard
  Built-in annotation canvas for drawing bounding boxes over detected damages.
- YOLO Dataset Generator
  Directly export human-reviewed annotations from the database to YOLO format.
- Mobile Platform
  React Native / Expo app with full auth, inspection flows, and session history.

## Project Structure

```text
cars/
|-- app/
|   |-- main.py
|   |-- config.py
|   |-- pipeline/
|   |   |-- extractor.py
|   |   |-- embedder.py
|   |   |-- similarity.py
|   |   |-- explainer.py
|   |   |-- damage_analyzer.py
|   |   `-- valuation.py
|   |-- storage/
|   |   |-- minio.py
|   |   |-- postgres.py
|   |   |-- dataset.py
|   |   |-- damage_dataset.py
|   |   `-- auth.py
|   `-- training/
|       |-- yolo_dataset.py
|       `-- README.md
|-- frontend/
|   |-- src/
|   |   |-- components/
|   |   |   |-- AdminDashboard.jsx
|   |   |   |-- AnnotationCanvas.jsx
|   |   |   `-- Login.jsx
|   |   `-- App.jsx
|-- mobile/
|   |-- src/
|   |   |-- components/
|   |   |-- lib/
|   |   |   |-- api.js
|   |   |   `-- history.js
|   |   |-- screens/
|   |   |   `-- LoginScreen.js
|   |   `-- theme.js
|   `-- App.js
|-- test/
|-- docker-compose.yml
|-- Dockerfile.backend
|-- Dockerfile.frontend
|-- init-minio.sh
|-- scan_minio.py
`-- requirements.txt
```

## Prerequisites

- Docker + Docker Compose
- Python 3.11+ recommended
- Node.js 20+ for frontend/mobile
- OpenAI API key if you want GPT explanation or GPT damage analysis

## Environment

Create `.env` in repo root:

```env
OPENAI_API_KEY=sk-xxxx

MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=vehicle-dataset

POSTGRES_PASSWORD=postgres

EXTRACT_N_FRAMES=5
TOP_K_FRAMES=3

DATASET_SAVING=true

RATE_LIMIT=30/minute
MAX_UPLOAD_SIZE_MB=100
MAX_VIDEO_DURATION_SEC=600
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000
```

## Run Options

### 1. Run Everything with Docker

```bash
docker-compose up --build
```

Services:

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:3000`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`
- PostgreSQL: `localhost:5432`

Useful Docker commands:

```bash
docker-compose up -d
docker-compose logs -f backend
docker-compose down
docker-compose down -v
```

### 2. Run Backend Locally

Install dependencies:

```bash
pip install -r requirements.txt
```

Install PyTorch and CLIP if not already installed:

```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install git+https://github.com/openai/CLIP.git
```

Start backend:

```bash
uvicorn app.main:app --reload
```

### 3. Run Frontend Web

```bash
cd frontend
npm install
npm run dev
```

### 4. Run Mobile App

```bash
cd mobile
npm install
npm start
```

If testing on a physical phone, point Expo to your machine LAN IP:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.10:8000
```

More mobile notes are in [mobile/README.md](/c:/Users/Victor/OneDrive/Documents/SideJob/cars/mobile/README.md).

## API Endpoints

### `POST /auth/register`
Create a new user. Body: `{ "username": "...", "password": "..." }`.

### `POST /auth/login`
Get a JWT token. Body: `{ "username": "...", "password": "..." }`.

### `GET /auth/me`
Verify token and get current user info. Requires `Authorization: Bearer <token>`.

### `GET /admin/pending`
Fetch sessions that haven't been human-verified yet.

### `POST /admin/approve`
Save human-verified bounding boxes for a session.

### `GET /admin/frame/{session_id}?path=...`
Securely proxy images from MinIO for the review dashboard.

### `POST /compare`

Form fields:

- `video_a`
- `video_b`

Example:

```bash
curl -X POST http://localhost:8000/compare \
  -F "video_a=@video1.mp4" \
  -F "video_b=@video2.mp4"
```

### `POST /analyze`

Form fields:

- `file` photo or video

Example:

```bash
curl -X POST http://localhost:8000/analyze \
  -F "file=@car_damage.jpg"
```

### `POST /valuation`

Form fields:

- `file`
- `reference_price`
- `manufacture_year` optional
- `mileage_km` optional
- `currency` optional

Example:

```bash
curl -X POST http://localhost:8000/valuation \
  -F "file=@car_damage.jpg" \
  -F "reference_price=250000000" \
  -F "manufacture_year=2021" \
  -F "mileage_km=48000" \
  -F "currency=IDR"
```

Swagger docs:

```text
http://localhost:8000/docs
```

## Important Commands

### Backend

```bash
uvicorn app.main:app --reload
python test/test_phase12.py
python test/test_api.py
python test/test_api.py --integration
```

### Frontend

```bash
cd frontend
npm install
npm run dev
npm run build
```

### Mobile

```bash
cd mobile
npm install
npm start
npm run android
npm run ios
npm run web
```

### Training Prep

Read the Phase 3 notes:

```bash
type app\training\README.md
```

Install YOLO dependency when you are ready:

```bash
pip install ultralytics
```

Example train command after reviewed annotations have been exported:

```bash
yolo detect train data=app/training/output/data.yaml model=yolov8n.pt epochs=50 imgsz=640
```

### MinIO Utility

To scan your local MinIO bucket outside of Docker:

```bash
python scan_minio.py
```

## Tests

### Phase 1 and 2 Logic

```bash
python test/test_phase12.py
```

### Phase 3 Dataset Export

```bash
python test/test_phase3_training.py
```

### Legacy Pipeline Tests

```bash
python test/test_api.py
```

### Integration Test

Backend must be running first:

```bash
python test/test_api.py --integration
```

## Training Flow Summary

1. Use `/analyze` to collect damage-analysis sessions.
2. Operator uses **Review Dashboard** on the web to verify bounding boxes.
3. Export from DB using `app/training/yolo_dataset.py`:
   ```bash
   python -c "from app.training.yolo_dataset import export_from_db; export_from_db('training_set')"
   ```
4. Train YOLO with `ultralytics`.

## Mobile Flow Summary

- Secure login & registration
- damage scan
- value estimate
- compare
- local session history
- Cloud sync (metadata saved to DB per user)

## Phase 6: Mobile Production Path (Roadmap)

To move from "Scaffold" to "Production App Store Ready", the following steps are required:

### 1. Hardened Infrastructure
- **SSL/HTTPS**: Mandatory. APIs must run on `https://` for App Store/Play Store compliance.
- **Production DSN**: Point to a production-grade PostgreSQL (e.g., RDS/Google Cloud SQL) instead of local Docker.
- **CDN for Media**: CloudFront or similar for faster image loading in the mobile app.

### 2. Native Mobile Experience
- **Client-Side Compression**: Resize images/videos on the phone before upload to save bandwidth and improve speed.
- **Background Uploads**: Use native background task managers so the app doesn't need to stay open during a 100MB video upload.
- **Offline First**: Implement a local cache (SQLite) so inspections can be done in garages or basements with zero signal, then synced later.

### 3. Production Ops
- **App Signing**: Setup `.keystore` (Android) and Apple Certificates.
- **Environment Management**: Separate `.env.production` for the production API URL.
- **Sentry/Logging**: Integration to track crashes on real devices.

## Requirements for Mobile Users

Before deploying to field operators:
1. **Network**: Ensure operators have consistent 4G/5G for video uploads, or wait for the Offline-First update.
2. **Device**: Minimum Android 10+ or iOS 15+ recommended for AI frame processing stability.
3. **Storage**: Ensure ~200MB free space for temporary media caching during inspection.

## Refactoring Notes (Pending)

To maintain health as the project grows, we plan to:
- **Modularize API**: Split `main.py` into separate routers (`/auth`, `/inspection`, `/admin`).
- **Dependency Injection**: Use FastAPI `Depends` for database sessions to improve testability.
- **Standardized Schemas**: Centralize all Pydantic models for better code-reuse between backend and frontend.
