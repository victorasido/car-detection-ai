import { useState, useRef, useCallback } from "react";

// ── API config ────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ── Helpers ───────────────────────────────────────────────────
const verdictMeta = {
  HIGH_SIMILARITY:     { label: "High Similarity",     color: "#16a34a", bg: "#f0fdf4", bar: "#16a34a" },
  MODERATE_SIMILARITY: { label: "Moderate Similarity", color: "#d97706", bg: "#fffbeb", bar: "#d97706" },
  LOW_SIMILARITY:      { label: "Low Similarity",      color: "#dc2626", bg: "#fef2f2", bar: "#dc2626" },
  DIFFERENT:           { label: "Different",            color: "#6b7280", bg: "#f9fafb", bar: "#6b7280" },
};

const confidenceMeta = {
  HIGH:   { label: "High Confidence",   dot: "#16a34a" },
  MEDIUM: { label: "Medium Confidence", dot: "#d97706" },
  LOW:    { label: "Low Confidence",    dot: "#dc2626" },
};

// ── Sub-components ────────────────────────────────────────────

function DropZone({ label, file, onFile, disabled }) {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("video/")) onFile(f);
  }, [onFile]);

  const previewUrl = file ? URL.createObjectURL(file) : null;

  return (
    <div style={{ flex: 1 }}>
      <div style={{
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#9ca3af",
        marginBottom: "8px",
        fontFamily: "'DM Mono', monospace",
      }}>{label}</div>

      <div
        onClick={() => !disabled && inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          border: `1.5px dashed ${dragging ? "#374151" : file ? "#d1d5db" : "#e5e7eb"}`,
          borderRadius: "12px",
          background: dragging ? "#f9fafb" : "#fff",
          cursor: disabled ? "not-allowed" : "pointer",
          transition: "all 0.15s ease",
          overflow: "hidden",
          aspectRatio: "16/9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {file ? (
          <>
            <video
              src={previewUrl}
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "10px" }}
              muted
              onMouseEnter={e => e.target.play()}
              onMouseLeave={e => { e.target.pause(); e.target.currentTime = 0; }}
            />
            <div style={{
              position: "absolute", bottom: 8, left: 8, right: 8,
              background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
              borderRadius: "6px", padding: "4px 8px",
              fontSize: "11px", color: "#fff", fontFamily: "'DM Mono', monospace",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {file.name}
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "24px" }}>
            <div style={{ fontSize: "28px", marginBottom: "8px", opacity: 0.3 }}>▶</div>
            <div style={{ fontSize: "13px", color: "#9ca3af", fontFamily: "'DM Sans', sans-serif" }}>
              Drop video here or click
            </div>
            <div style={{ fontSize: "11px", color: "#d1d5db", marginTop: "4px", fontFamily: "'DM Mono', monospace" }}>
              mp4 · avi · mov · mkv
            </div>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        style={{ display: "none" }}
        onChange={e => e.target.files[0] && onFile(e.target.files[0])}
      />
    </div>
  );
}

function ScoreBar({ score, color }) {
  return (
    <div style={{ marginTop: "4px" }}>
      <div style={{
        height: "6px",
        background: "#f3f4f6",
        borderRadius: "99px",
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%",
          width: `${score}%`,
          background: color,
          borderRadius: "99px",
          transition: "width 1s cubic-bezier(0.16,1,0.3,1)",
        }} />
      </div>
    </div>
  );
}

function FrameScores({ scores, color }) {
  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      {scores.map((s, i) => (
        <div key={i} style={{
          background: "#f9fafb",
          border: "1px solid #f3f4f6",
          borderRadius: "8px",
          padding: "8px 12px",
          textAlign: "center",
          minWidth: "70px",
        }}>
          <div style={{
            fontSize: "15px",
            fontWeight: 700,
            color: color,
            fontFamily: "'DM Mono', monospace",
            letterSpacing: "-0.02em",
          }}>
            {s.toFixed(1)}%
          </div>
          <div style={{ fontSize: "10px", color: "#9ca3af", marginTop: "2px" }}>
            Frame {i + 1}
          </div>
        </div>
      ))}
    </div>
  );
}

function ResultCard({ result }) {
  const vm = verdictMeta[result.verdict] || verdictMeta.DIFFERENT;
  const cm = confidenceMeta[result.confidence] || confidenceMeta.LOW;

  return (
    <div style={{
      background: "#fff",
      border: "1px solid #f3f4f6",
      borderRadius: "16px",
      overflow: "hidden",
      boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 24px rgba(0,0,0,0.04)",
    }}>
      {/* Score hero */}
      <div style={{
        padding: "32px",
        borderBottom: "1px solid #f3f4f6",
        display: "flex",
        alignItems: "center",
        gap: "24px",
        flexWrap: "wrap",
      }}>
        <div>
          <div style={{
            fontSize: "56px",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            color: vm.color,
            lineHeight: 1,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            {result.similarity_percentage.toFixed(1)}
            <span style={{ fontSize: "28px", fontWeight: 500, opacity: 0.6 }}>%</span>
          </div>
          <ScoreBar score={result.similarity_percentage} color={vm.bar} />
        </div>

        <div style={{ flex: 1 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            background: vm.bg,
            color: vm.color,
            border: `1px solid ${vm.color}22`,
            borderRadius: "99px",
            padding: "4px 12px",
            fontSize: "12px",
            fontWeight: 600,
            fontFamily: "'DM Mono', monospace",
            letterSpacing: "0.04em",
            marginBottom: "8px",
          }}>
            {vm.label.toUpperCase()}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{
              width: "6px", height: "6px",
              borderRadius: "50%",
              background: cm.dot,
              flexShrink: 0,
            }} />
            <span style={{ fontSize: "12px", color: "#6b7280", fontFamily: "'DM Sans', sans-serif" }}>
              {cm.label}
            </span>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "11px", color: "#9ca3af", fontFamily: "'DM Mono', monospace" }}>
            {result.processing_time_ms}ms
          </div>
          <div style={{ fontSize: "11px", color: "#9ca3af", fontFamily: "'DM Mono', monospace" }}>
            {result.embedding_model} · {result.device_used}
          </div>
        </div>
      </div>

      {/* Frame scores */}
      <div style={{ padding: "20px 32px", borderBottom: "1px solid #f3f4f6" }}>
        <div style={{
          fontSize: "11px", fontWeight: 600, color: "#9ca3af",
          letterSpacing: "0.08em", textTransform: "uppercase",
          fontFamily: "'DM Mono', monospace", marginBottom: "12px",
        }}>
          Frame Scores ({result.frames_compared} frames compared)
        </div>
        <FrameScores scores={result.frame_scores} color={vm.color} />
      </div>

      {/* AI Explanation */}
      {result.explanation && (
        <div style={{ padding: "20px 32px", borderBottom: "1px solid #f3f4f6" }}>
          <div style={{
            fontSize: "11px", fontWeight: 600, color: "#9ca3af",
            letterSpacing: "0.08em", textTransform: "uppercase",
            fontFamily: "'DM Mono', monospace", marginBottom: "12px",
            display: "flex", alignItems: "center", gap: "8px",
          }}>
            AI Explanation
            <span style={{
              background: "#f3f4f6", color: "#6b7280",
              padding: "2px 7px", borderRadius: "99px",
              fontSize: "10px", fontWeight: 500,
              fontFamily: "'DM Mono', monospace",
            }}>
              {result.explanation_model}
            </span>
          </div>
          <p style={{
            fontSize: "14px", lineHeight: 1.7,
            color: "#374151",
            fontFamily: "'DM Sans', sans-serif",
            margin: 0,
          }}>
            {result.explanation}
          </p>
        </div>
      )}

      {/* Video metadata */}
      <div style={{ padding: "20px 32px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        {[result.video_a_info, result.video_b_info].map((info, i) => (
          <div key={i}>
            <div style={{
              fontSize: "11px", fontWeight: 600, color: "#9ca3af",
              letterSpacing: "0.08em", textTransform: "uppercase",
              fontFamily: "'DM Mono', monospace", marginBottom: "8px",
            }}>
              Video {i === 0 ? "A" : "B"}
            </div>
            {[
              ["Resolution", info.resolution],
              ["Duration",   `${info.duration_sec}s`],
              ["FPS",        info.fps],
              ["Frames used", info.frames_used],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "12px", color: "#9ca3af", fontFamily: "'DM Sans', sans-serif" }}>{k}</span>
                <span style={{ fontSize: "12px", color: "#374151", fontFamily: "'DM Mono', monospace" }}>{v}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────

export default function App() {
  const [fileA, setFileA]     = useState(null);
  const [fileB, setFileB]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);

  const canCompare = fileA && fileB && !loading;

  const handleCompare = async () => {
    if (!canCompare) return;
    setLoading(true);
    setResult(null);
    setError(null);

    const form = new FormData();
    form.append("video_a", fileA);
    form.append("video_b", fileB);

    try {
      const res = await fetch(`${API_BASE}/compare`, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #fafafa; color: #111827; -webkit-font-smoothing: antialiased; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{ minHeight: "100vh", padding: "0 0 80px" }}>

        {/* Header */}
        <header style={{
          borderBottom: "1px solid #f3f4f6",
          background: "#fff",
          padding: "0 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "56px",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "28px", height: "28px",
              background: "#111827",
              borderRadius: "8px",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "14px",
            }}>▶</div>
            <span style={{
              fontSize: "14px", fontWeight: 700,
              fontFamily: "'DM Sans', sans-serif",
              letterSpacing: "-0.02em",
            }}>
              VehicleSim
            </span>
          </div>
          <div style={{
            fontSize: "11px",
            color: "#9ca3af",
            fontFamily: "'DM Mono', monospace",
            background: "#f9fafb",
            border: "1px solid #f3f4f6",
            padding: "4px 10px",
            borderRadius: "99px",
          }}>
            Stage 5 · Production
          </div>
        </header>

        <main style={{ maxWidth: "760px", margin: "0 auto", padding: "48px 24px 0" }}>

          {/* Title */}
          <div style={{ marginBottom: "40px", animation: "fadeUp 0.4s ease both" }}>
            <h1 style={{
              fontSize: "28px",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              color: "#111827",
              fontFamily: "'DM Sans', sans-serif",
              marginBottom: "8px",
            }}>
              Vehicle Similarity
            </h1>
            <p style={{
              fontSize: "14px",
              color: "#6b7280",
              fontFamily: "'DM Sans', sans-serif",
              lineHeight: 1.6,
            }}>
              Upload two vehicle videos to compare their visual similarity using CLIP embeddings and GPT-4o-mini analysis.
            </p>
          </div>

          {/* Upload section */}
          <div style={{
            background: "#fff",
            border: "1px solid #f3f4f6",
            borderRadius: "16px",
            padding: "24px",
            marginBottom: "20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            animation: "fadeUp 0.4s ease 0.05s both",
          }}>
            <div style={{ display: "flex", gap: "16px", marginBottom: "20px", flexWrap: "wrap" }}>
              <DropZone label="Video A" file={fileA} onFile={setFileA} disabled={loading} />
              <DropZone label="Video B" file={fileB} onFile={setFileB} disabled={loading} />
            </div>

            <button
              onClick={handleCompare}
              disabled={!canCompare}
              style={{
                width: "100%",
                padding: "12px",
                background: canCompare ? "#111827" : "#f3f4f6",
                color: canCompare ? "#fff" : "#9ca3af",
                border: "none",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
                cursor: canCompare ? "pointer" : "not-allowed",
                transition: "all 0.15s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                letterSpacing: "0.01em",
              }}
            >
              {loading ? (
                <>
                  <div style={{
                    width: "14px", height: "14px",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    animation: "spin 0.7s linear infinite",
                  }} />
                  Analyzing...
                </>
              ) : (
                "Compare Videos"
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "10px",
              padding: "14px 16px",
              marginBottom: "20px",
              fontSize: "13px",
              color: "#dc2626",
              fontFamily: "'DM Sans', sans-serif",
              animation: "fadeUp 0.3s ease both",
            }}>
              ⚠ {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div style={{ animation: "fadeUp 0.4s ease both" }}>
              <ResultCard result={result} />
            </div>
          )}

        </main>
      </div>
    </>
  );
}