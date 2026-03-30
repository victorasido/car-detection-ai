import React from "react";
import ScoreBar from "./ScoreBar";
import FrameScores from "./FrameScores";
import ComparisonSlider from "./ComparisonSlider";

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

export default function ResultCard({ result }) {
  const vm = verdictMeta[result.verdict] || verdictMeta.DIFFERENT;
  const cm = confidenceMeta[result.confidence] || confidenceMeta.LOW;

  return (
    <div className="fade-up" style={{
      background: "var(--card-bg)",
      border: "1px solid var(--border)",
      borderRadius: "16px",
      overflow: "hidden",
      boxShadow: "var(--shadow-md)",
      marginBottom: "20px",
    }}>
      {/* Visual Comparison Slider */}
      {result.best_frame_a && result.best_frame_b && (
        <div style={{ borderBottom: "1px solid var(--border)" }}>
           <div className="mono" style={{
            fontSize: "11px", fontWeight: 600, color: "var(--muted)",
            letterSpacing: "0.08em", textTransform: "uppercase",
            padding: "16px 32px 12px",
          }}>
            Visual Comparison (Slide to compare)
          </div>
          <div style={{ padding: "0 32px 24px" }}>
            <ComparisonSlider imgA={result.best_frame_a} imgB={result.best_frame_b} />
          </div>
        </div>
      )}

      {/* Score hero */}
      <div style={{
        padding: "32px",
        borderBottom: "1px solid var(--border)",
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
          }}>
            {result.similarity_percentage.toFixed(1)}
            <span style={{ fontSize: "28px", fontWeight: 500, opacity: 0.6 }}>%</span>
          </div>
          <ScoreBar score={result.similarity_percentage} color={vm.bar} />
        </div>

        <div style={{ flex: 1 }}>
          <div className="mono" style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            background: vm.bg,
            color: vm.color,
            border: `1px solid ${vm.color}22`,
            borderRadius: "99px",
            padding: "4px 12px",
            fontSize: "12px",
            fontWeight: 600,
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
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              {cm.label}
            </span>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div className="mono" style={{ fontSize: "11px", color: "var(--muted)" }}>
            {result.processing_time_ms}ms
          </div>
          <div className="mono" style={{ fontSize: "11px", color: "var(--muted)" }}>
            {result.embedding_model} · {result.device_used}
          </div>
        </div>
      </div>

      {/* Frame scores */}
      <div style={{ padding: "20px 32px", borderBottom: "1px solid var(--border)" }}>
        <div className="mono" style={{
          fontSize: "11px", fontWeight: 600, color: "var(--muted)",
          letterSpacing: "0.08em", textTransform: "uppercase",
          marginBottom: "12px",
        }}>
          Frame Scores ({result.frames_compared} comparison pairs)
        </div>
        <FrameScores scores={result.frame_scores} color={vm.color} />
      </div>

      {/* AI Explanation */}
      {result.explanation && (
        <div style={{ padding: "20px 32px", borderBottom: "1px solid var(--border)" }}>
          <div className="mono" style={{
            fontSize: "11px", fontWeight: 600, color: "var(--muted)",
            letterSpacing: "0.08em", textTransform: "uppercase",
            marginBottom: "12px",
            display: "flex", alignItems: "center", gap: "8px",
          }}>
            AI Explanation
            <span className="mono" style={{
              background: "var(--bg)", color: "var(--muted)",
              padding: "2px 7px", borderRadius: "99px",
              fontSize: "10px", fontWeight: 500,
            }}>
              {result.explanation_model}
            </span>
          </div>
          <p style={{
            fontSize: "14px", lineHeight: 1.7,
            color: "#374151",
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
            <div className="mono" style={{
              fontSize: "11px", fontWeight: 600, color: "var(--muted)",
              letterSpacing: "0.08em", textTransform: "uppercase",
              marginBottom: "8px",
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
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>{k}</span>
                <span className="mono" style={{ fontSize: "12px", color: "var(--fg)" }}>{v}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
