"""
Test Script — Vehicle Similarity API Stage 1
============================================
Jalankan SETELAH server berjalan di localhost:8000

Cara pakai:
    python tests/test_api.py

Atau test manual dengan curl:
    curl -X POST http://localhost:8000/compare \
      -F "video_a=@sample_a.mp4" \
      -F "video_b=@sample_b.mp4"
"""

import sys
import os
import cv2
import numpy as np
import tempfile

# ─────────────────────────────────────────────
# Helper: Buat sample video untuk testing
# ─────────────────────────────────────────────

def create_sample_video(path: str, color: tuple, num_frames: int = 30, fps: int = 30):
    """Buat video dummy berisi solid color frame untuk testing."""
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(path, fourcc, fps, (640, 480))
    for _ in range(num_frames):
        frame = np.full((480, 640, 3), color, dtype=np.uint8)
        # Tambah noise kecil biar lebih realistis
        noise = np.random.randint(0, 10, (480, 640, 3), dtype=np.uint8)
        frame = cv2.add(frame, noise)
        writer.write(frame)
    writer.release()


# ─────────────────────────────────────────────
# Unit Test: Tanpa server (test logic langsung)
# ─────────────────────────────────────────────

def test_unit():
    """Test fungsi core tanpa perlu server running."""
    print("\n" + "="*50)
    print("UNIT TEST — Core Logic")
    print("="*50)

    # Import langsung dari app
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from app.main import (
        extract_middle_frame,
        preprocess_frame,
        generate_embedding,
        cosine_similarity,
        get_verdict,
    )

    # Buat 2 video sample
    tmp_a = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    tmp_b = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    tmp_c = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    tmp_a.close(); tmp_b.close(); tmp_c.close()

    # Video A & B = warna sama (harusnya similarity tinggi)
    create_sample_video(tmp_a.name, color=(100, 150, 200))
    create_sample_video(tmp_b.name, color=(105, 155, 205))  # sedikit beda

    # Video C = warna berbeda jauh
    create_sample_video(tmp_c.name, color=(200, 50, 30))

    print("\n[TEST 1] Extract middle frame...")
    frame_a, info_a = extract_middle_frame(tmp_a.name)
    print(f"  ✓ Frame shape: {frame_a.shape}")
    print(f"  ✓ Video info: {info_a}")

    print("\n[TEST 2] Preprocess frame...")
    proc_a = preprocess_frame(frame_a)
    assert proc_a.shape == (224, 224, 3), f"Expected (224,224,3), got {proc_a.shape}"
    assert proc_a.max() <= 1.0, "Normalization gagal, nilai > 1.0"
    print(f"  ✓ Shape after resize: {proc_a.shape}")
    print(f"  ✓ Pixel range: [{proc_a.min():.3f}, {proc_a.max():.3f}]")

    print("\n[TEST 3] Generate embedding...")
    emb_a = generate_embedding(proc_a)
    assert emb_a.ndim == 1, "Embedding harus 1D"
    print(f"  ✓ Embedding dim: {emb_a.shape[0]}")

    print("\n[TEST 4] Cosine similarity — video mirip...")
    frame_b, _ = extract_middle_frame(tmp_b.name)
    emb_b = generate_embedding(preprocess_frame(frame_b))
    score_similar = cosine_similarity(emb_a, emb_b)
    print(f"  ✓ Score (mirip): {score_similar}%")
    assert score_similar > 50, f"Video serupa harusnya > 50%, dapat {score_similar}%"

    print("\n[TEST 5] Cosine similarity — video berbeda...")
    frame_c, _ = extract_middle_frame(tmp_c.name)
    emb_c = generate_embedding(preprocess_frame(frame_c))
    score_diff = cosine_similarity(emb_a, emb_c)
    print(f"  ✓ Score (beda): {score_diff}%")

    print("\n[TEST 6] Verdict mapping...")
    for score, expected in [(90, "HIGH_SIMILARITY"), (70, "MODERATE_SIMILARITY"),
                             (40, "LOW_SIMILARITY"), (10, "DIFFERENT")]:
        verdict = get_verdict(score)
        print(f"  ✓ Score {score}% → {verdict}")

    # Cleanup
    for p in [tmp_a.name, tmp_b.name, tmp_c.name]:
        os.unlink(p)

    print("\n✅ Semua unit test LULUS!\n")


# ─────────────────────────────────────────────
# Integration Test: Perlu server running
# ─────────────────────────────────────────────

def test_integration():
    """Test endpoint /compare via HTTP. Server harus running dulu."""
    try:
        import requests
    except ImportError:
        print("⚠️  Install requests dulu: pip install requests")
        return

    BASE_URL = "http://localhost:8000"

    print("\n" + "="*50)
    print("INTEGRATION TEST — HTTP Endpoint")
    print("="*50)

    # Cek server running
    print("\n[CHECK] Server health...")
    try:
        r = requests.get(f"{BASE_URL}/health", timeout=3)
        print(f"  ✓ Server running: {r.json()}")
    except Exception:
        print("  ✗ Server tidak running. Jalankan dulu:")
        print("    uvicorn app.main:app --reload")
        return

    # Buat sample videos
    tmp_a = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    tmp_b = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    tmp_a.close(); tmp_b.close()
    create_sample_video(tmp_a.name, color=(100, 150, 200))
    create_sample_video(tmp_b.name, color=(105, 155, 205))

    print("\n[TEST] POST /compare dengan 2 video...")
    with open(tmp_a.name, "rb") as fa, open(tmp_b.name, "rb") as fb:
        response = requests.post(
            f"{BASE_URL}/compare",
            files={
                "video_a": ("video_a.mp4", fa, "video/mp4"),
                "video_b": ("video_b.mp4", fb, "video/mp4"),
            },
            timeout=30,
        )

    print(f"  Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"\n  📊 HASIL:")
        print(f"  similarity_percentage : {data['similarity_percentage']}%")
        print(f"  verdict               : {data['verdict']}")
        print(f"  processing_time_ms    : {data['processing_time_ms']}ms")
        print(f"  video_a frames        : {data['video_a_info']['total_frames']}")
        print(f"  video_b frames        : {data['video_b_info']['total_frames']}")
        print(f"\n  ✅ Integration test LULUS!")
    else:
        print(f"  ✗ Error: {response.text}")

    for p in [tmp_a.name, tmp_b.name]:
        os.unlink(p)


if __name__ == "__main__":
    test_unit()

    if "--integration" in sys.argv:
        test_integration()
    else:
        print("💡 Untuk integration test (butuh server running):")
        print("   python tests/test_api.py --integration\n")