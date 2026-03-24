"""
Test Script — Vehicle Similarity API Stage 5
=============================================
Unit tests for pipeline modules + integration test for HTTP endpoint.

Usage:
    python test/test_api.py                    ← unit test only
    python test/test_api.py --integration      ← + HTTP endpoint test (server harus running)
"""

import sys
import os
import cv2
import numpy as np
import tempfile

# Ensure project root is in path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


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
# Unit Test: Pipeline modules (tanpa server)
# ─────────────────────────────────────────────

def test_unit():
    """Test pipeline functions tanpa perlu server running."""
    print("\n" + "=" * 50)
    print("UNIT TEST — Pipeline Modules")
    print("=" * 50)

    from app.pipeline.extractor import extract_frames_evenly, select_sharpest_frames, compute_sharpness
    from app.pipeline.embedder import generate_embedding
    from app.pipeline.similarity import cosine_similarity, compare_frame_sets, get_verdict, get_confidence

    # Buat 3 video sample
    tmp_a = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    tmp_b = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    tmp_c = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    tmp_a.close(); tmp_b.close(); tmp_c.close()

    # Video A & B = warna sama (harusnya similarity tinggi)
    create_sample_video(tmp_a.name, color=(100, 150, 200))
    create_sample_video(tmp_b.name, color=(105, 155, 205))  # sedikit beda

    # Video C = warna berbeda jauh
    create_sample_video(tmp_c.name, color=(200, 50, 30))

    # ── Test 1: Frame extraction ────────────────
    print("\n[TEST 1] Extract frames evenly...")
    frames_a, info_a = extract_frames_evenly(tmp_a.name, n=5)
    assert len(frames_a) > 0, "Harus ada minimal 1 frame"
    assert len(frames_a) <= 5, f"Max 5 frame, dapat {len(frames_a)}"
    print(f"  ✓ Extracted {len(frames_a)} frames")
    print(f"  ✓ Video info: {info_a}")

    # ── Test 2: Sharpness computation ───────────
    print("\n[TEST 2] Compute sharpness...")
    sharpness = compute_sharpness(frames_a[0])
    assert sharpness >= 0, "Sharpness harus >= 0"
    print(f"  ✓ Sharpness score: {sharpness:.2f}")

    # ── Test 3: Select sharpest frames ──────────
    print("\n[TEST 3] Select sharpest frames...")
    sharp_frames, scores = select_sharpest_frames(frames_a, k=3)
    assert len(sharp_frames) <= 3, f"Max 3 frame, dapat {len(sharp_frames)}"
    assert len(scores) == len(frames_a), "Scores harus ada untuk semua frame"
    print(f"  ✓ Selected {len(sharp_frames)} sharpest frames")
    print(f"  ✓ All sharpness scores: {scores}")

    # ── Test 4: CLIP embedding ──────────────────
    print("\n[TEST 4] Generate CLIP embedding...")
    emb_a = generate_embedding(frames_a[0])
    assert emb_a.ndim == 1, "Embedding harus 1D"
    assert emb_a.shape[0] == 512, f"Expected 512-d, got {emb_a.shape[0]}-d"
    print(f"  ✓ Embedding dim: {emb_a.shape[0]}")

    # ── Test 5: Cosine similarity — video mirip ─
    print("\n[TEST 5] Cosine similarity — video mirip...")
    frames_b, _ = extract_frames_evenly(tmp_b.name, n=5)
    emb_b = generate_embedding(frames_b[0])
    score_similar = cosine_similarity(emb_a, emb_b)
    print(f"  ✓ Score (mirip): {score_similar}%")
    assert score_similar > 50, f"Video serupa harusnya > 50%, dapat {score_similar}%"

    # ── Test 6: Cosine similarity — video beda ──
    print("\n[TEST 6] Cosine similarity — video berbeda...")
    frames_c, _ = extract_frames_evenly(tmp_c.name, n=5)
    emb_c = generate_embedding(frames_c[0])
    score_diff = cosine_similarity(emb_a, emb_c)
    print(f"  ✓ Score (beda): {score_diff}%")

    # ── Test 7: compare_frame_sets (full pipeline)
    print("\n[TEST 7] compare_frame_sets (full pipeline)...")
    sharp_a, _ = select_sharpest_frames(frames_a, k=3)
    sharp_b, _ = select_sharpest_frames(frames_b, k=3)
    avg_score, frame_scores, ret_emb_a, ret_emb_b = compare_frame_sets(sharp_a, sharp_b)
    assert isinstance(avg_score, float), "avg_score harus float"
    assert len(frame_scores) > 0, "Harus ada frame scores"
    assert len(ret_emb_a) == 512, "Returned embedding_a harus 512-d"
    assert len(ret_emb_b) == 512, "Returned embedding_b harus 512-d"
    print(f"  ✓ Avg score: {avg_score}%")
    print(f"  ✓ Frame scores: {frame_scores}")
    print(f"  ✓ Embeddings returned: {len(ret_emb_a)}-d, {len(ret_emb_b)}-d")

    # ── Test 8: Verdict mapping ─────────────────
    print("\n[TEST 8] Verdict mapping...")
    test_cases = [
        (90, "HIGH_SIMILARITY"),
        (70, "MODERATE_SIMILARITY"),
        (40, "LOW_SIMILARITY"),
        (10, "DIFFERENT"),
    ]
    for score, expected in test_cases:
        verdict = get_verdict(score)
        assert verdict == expected, f"Score {score}% → expected {expected}, got {verdict}"
        print(f"  ✓ Score {score}% → {verdict}")

    # ── Test 9: Confidence mapping ──────────────
    print("\n[TEST 9] Confidence mapping...")
    assert get_confidence([90, 91, 89]) == "HIGH", "Low std → HIGH confidence"
    assert get_confidence([90, 70, 50]) == "LOW", "High std → LOW confidence"
    assert get_confidence([90]) == "LOW", "Single score → LOW confidence"
    print("  ✓ HIGH/MEDIUM/LOW confidence logic correct")

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

    print("\n" + "=" * 50)
    print("INTEGRATION TEST — HTTP Endpoint")
    print("=" * 50)

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
            timeout=60,
        )

    print(f"  Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"\n  📊 HASIL:")
        print(f"  session_id            : {data['session_id']}")
        print(f"  similarity_percentage : {data['similarity_percentage']}%")
        print(f"  verdict               : {data['verdict']}")
        print(f"  confidence            : {data['confidence']}")
        print(f"  explanation_model     : {data['explanation_model']}")
        print(f"  frames_compared       : {data['frames_compared']}")
        print(f"  processing_time_ms    : {data['processing_time_ms']}ms")
        print(f"  dataset_saved         : {data['dataset_saved']}")
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
        print("   python test/test_api.py --integration\n")