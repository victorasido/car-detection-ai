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

- **Phase 1-5**: Core APIs, Auth, Damage Analysis, Dataset Export, and Admin Dashboard → **DONE**
- **Phase 6: Production readiness** → **DONE**
    - [x] **Infrastructure Hardening**: SSL/HTTPS, Nginx Proxy, S3/R2 Storage Adapter.
    - [x] **Mobile Optimization**: Client-side compression & background uploads.
    - [x] **Offline-First**: SQLite-based sync queue for dead zones.
    - [x] **Observability**: Sentry error tracking for both Backend and Mobile.

## Features

- **JWT Authentication** (`/auth/*`): Secure access for mobile and web users.
- **Vehicle Similarity** (`/compare`): CLIP embedding + GPT-4o-mini explanation.
- **Damage Analysis** (`/analyze`): Visual inspection via GPT-4o.
- **Value Estimation** (`/valuation`): Damage-aware vehicle pricing.
- **Human-in-the-Loop Review**: Admin queue for validating and correcting AI annotations.
- **YOLO Training Bridge**: Export reviews directly to YOLOv8 folder structure.
- **Mobile Client**: Expo app with media compression, background uploads, and offline syncing.

## Project Structure

```text
cars/
|-- app/
|   |-- main.py              # Application Orchestrator
|   |-- config.py            # Unified Configuration (Environment)
|   |-- api/                 # Modular API layer
|   |   |-- routers/         # Auth, Inspection, and Admin routers
|   |   |-- schemas.py       # Pydantic data contracts
|   |   `-- utils.py         # Upload validation & helpers
|   |-- pipeline/            # AI inspection logic
|   |-- storage/             # Data persistence layer
|   |   |-- object_store.py  # Unified S3/R2/MinIO adapter
|   |   `-- postgres.py      # DB session and pooling management
|   `-- training/            # YOLO dataset generation
|-- frontend/                # React review dashboard
|-- mobile/                  # Expo mobile application
|-- nginx/                   # Production reverse proxy config
|-- test/                    # Unit and integration tests
|-- docker-compose.yml       # Local development stack
`-- docker-compose.prod.yml  # Hardened production stack
```

## Running the Platform

### 🛠 Local Development (Docker Compose)
Ideal for testing features and the frontend:
```bash
docker-compose up --build
```
Access backend at `http://localhost:8000` and frontend at `http://localhost:3000`.

### 🌐 Production Deployment
For deployment to AWS, Cloudflare R2, or VPS:
1. Copy `.env.production` and fill in your secrets (OpenAI, S3/R2 Keys, DB DSN).
2. Use the production stack:
```bash
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

### 📱 Mobile App (Expo)
```bash
cd mobile
npm install
npx expo start
```
- **Compression**: Automatic (Images resized to 1080p).
- **Offline Mode**: Supported via SQLite sync queue.
- **Build**: Use `npx eas build --profile production` for store release.

## Training Flow

1. Capture data via Mobile or `/analyze`.
2. Review and Correct in **Web Review Dashboard**.
3. Export Ground Truth:
   ```bash
   python -c "from app.training.yolo_dataset import export_from_db; export_from_db('my_training_set')"
   ```
4. Train YOLO:
   ```bash
   yolo detect train data=app/training/output/data.yaml model=yolov8n.pt
   ```

## Production Security & Ops

- **SSL/HTTPS**: Terminated by Nginx + Certbot in `docker-compose.prod.yml`.
- **Storage**: Multi-provider support (Local MinIO for dev, Cloudflare R2/AWS S3 for prod).
- **Monitoring**: Sentry integration for real-time error tracking (`SENTRY_DSN`).
- **Network**: Mobile app auto-syncs when returning from dead-zones.

## Requirements

- **Backend**: Python 3.11+
- **Database**: PostgreSQL 15+
- **Storage**: Any S3-compatible service (MinIO/R2/S3).
- **Mobile**: Android 10+ or iOS 15+.
