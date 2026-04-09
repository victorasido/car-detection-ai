import React, { useState } from "react";
import ScoreBar from "./ScoreBar";
import FrameScores from "./FrameScores";
import ComparisonSlider from "./ComparisonSlider";

const verdictMeta = {
  HIGH_SIMILARITY: { label: "High Similarity", color: "#00953D", bg: "#F0FDF4", border: "#BBF7D0", ring: "#00C853" },
  MODERATE_SIMILARITY: { label: "Moderate Similarity", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", ring: "#F59E0B" },
  LOW_SIMILARITY: { label: "Low Similarity", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", ring: "#EF4444" },
  DIFFERENT: { label: "Different", color: "#6E6E73", bg: "#F5F5F7", border: "#E5E5EA", ring: "#9CA3AF" },
};

const confidenceMeta = {
  HIGH: { label: "High Confidence", dot: "#00C853" },
  MEDIUM: { label: "Medium Confidence", dot: "#F59E0B" },
  LOW: { label: "Low Confidence", dot: "#EF4444" },
};

function VideoInfoCard({ info, label }) {
  const fields = [
    { key: "Resolution", val: info.resolution, icon: "⊞" },
    { key: "Duration", val: `${info.duration_sec}s`, icon: "◷" },
    { key: "FPS", val: info.fps, icon: "⏱" },
    { key: "Frames used", val: info.frames_used, icon: "▤" },
  ];

  return (
    <div style={{
      background: "#FAFAFA",
      border: "1px solid #E5E5EA",
      borderRadius: "12px",
      overflow: "hidden",
    }}>
      {/* Card header */}
      <div style={{
        padding: "10px 16px",
        borderBottom: "1px solid #E5E5EA",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        background: "#fff",
      }}>
        <div style={{
          width: "20px", height: "20px",
          background: "#F0FDF4",
          border: "1px solid #BBF7D0",
          borderRadius: "6px",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "10px",
          color: "#00953D",
          fontWeight: 700,
        }}>
          {label}
        </div>
        <span style={{
          fontSize: "11px",
          fontFamily: "ui-monospace, 'SF Mono', monospace",
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#6E6E73",
        }}>
          Video {label}
        </span>
      </div>

      {/* Fields */}
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
        {fields.map(({ key, val }) => (
          <div key={key} style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <span style={{ fontSize: "12px", color: "#6E6E73" }}>{key}</span>
            <span style={{
              fontSize: "12px",
              fontFamily: "ui-monospace, 'SF Mono', monospace",
              fontWeight: 600,
              color: "#1D1D1F",
              background: "#F5F5F7",
              padding: "2px 8px",
              borderRadius: "6px",
            }}>
              {val}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ResultCard({ result }) {
  const vm = verdictMeta[result.verdict] || verdictMeta.DIFFERENT;
  const cm = confidenceMeta[result.confidence] || confidenceMeta.LOW;
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="fade-up" style={{
      background: "#fff",
      border: "1px solid #E5E5EA",
      borderRadius: "20px",
      overflow: "hidden",
      boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)",
      marginBottom: "20px",
    }}>

      {/* Visual Comparison Slider */}
      {result.best_frame_a && result.best_frame_b && (
        <div style={{ borderBottom: "1px solid #E5E5EA" }}>
          <div style={{
            fontSize: "11px",
            fontFamily: "ui-monospace, 'SF Mono', monospace",
            fontWeight: 600,
            color: "#6E6E73",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "16px 32px 12px",
          }}>
            Visual Comparison — Slide to Compare
          </div>
          <div style={{ padding: "0 32px 24px" }}>
            <ComparisonSlider imgA={result.best_frame_a} imgB={result.best_frame_b} />
          </div>
        </div>
      )}

      {/* Score hero */}
      <div style={{
        padding: "32px",
        borderBottom: "1px solid #E5E5EA",
        display: "flex",
        alignItems: "center",
        gap: "28px",
        flexWrap: "wrap",
        background: `linear-gradient(135deg, ${vm.bg} 0%, #fff 60%)`,
      }}>
        {/* Score circle */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#E5E5EA" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="42"
              fill="none"
              stroke={vm.ring}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 42 * result.similarity_percentage / 100} ${2 * Math.PI * 42}`}
              transform="rotate(-90 50 50)"
              style={{ transition: "stroke-dasharray 1s ease" }}
            />
          </svg>
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
          }}>
            <span style={{
              fontSize: "22px",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              color: vm.color,
              lineHeight: 1,
              fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
            }}>
              {result.similarity_percentage.toFixed(1)}
            </span>
            <span style={{ fontSize: "11px", color: "#6E6E73", fontWeight: 500 }}>%</span>
          </div>
        </div>

        {/* Verdict + confidence */}
        <div style={{ flex: 1 }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            background: vm.bg,
            color: vm.color,
            border: `1px solid ${vm.border}`,
            borderRadius: "99px",
            padding: "5px 14px",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.03em",
            marginBottom: "10px",
            fontFamily: "ui-monospace, 'SF Mono', monospace",
          }}>
            <div style={{
              width: "6px", height: "6px",
              borderRadius: "50%",
              background: vm.ring,
            }} />
            {vm.label.toUpperCase()}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
            <div style={{
              width: "6px", height: "6px",
              borderRadius: "50%",
              background: cm.dot,
              flexShrink: 0,
            }} />
            <span style={{ fontSize: "12px", color: "#6E6E73" }}>{cm.label}</span>
          </div>

          <ScoreBar score={result.similarity_percentage} color={vm.ring} />
        </div>

        {/* Meta */}
        <div style={{
          textAlign: "right",
          background: "#F5F5F7",
          borderRadius: "10px",
          padding: "10px 14px",
        }}>
          <div style={{
            fontSize: "11px",
            fontFamily: "ui-monospace, 'SF Mono', monospace",
            color: "#6E6E73",
            marginBottom: "2px",
          }}>
            {result.processing_time_ms}ms
          </div>
          <div style={{
            fontSize: "11px",
            fontFamily: "ui-monospace, 'SF Mono', monospace",
            color: "#6E6E73",
          }}>
            {result.embedding_model}
          </div>
          <div style={{
            fontSize: "11px",
            fontFamily: "ui-monospace, 'SF Mono', monospace",
            color: "#6E6E73",
          }}>
            {result.device_used}
          </div>
        </div>
      </div>

      {/* Frame scores */}
      <div style={{ padding: "20px 32px", borderBottom: "1px solid #E5E5EA" }}>
        <div style={{
          fontSize: "11px",
          fontFamily: "ui-monospace, 'SF Mono', monospace",
          fontWeight: 600,
          color: "#6E6E73",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: "12px",
        }}>
          Frame Analysis — {result.frames_compared} comparison pairs
        </div>
        <FrameScores scores={result.frame_scores} color={vm.ring} />
      </div>

      {/* Analysis Result (previously AI Explanation) */}
      {result.explanation && (
        <div style={{ padding: "24px 32px", borderBottom: "1px solid #E5E5EA" }}>
          {/* Section header */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "16px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {/* Green icon */}
              <div style={{
                width: "28px", height: "28px",
                background: "linear-gradient(135deg, #00C853 0%, #00953D 100%)",
                borderRadius: "8px",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 2px 6px rgba(0,200,83,0.25)",
                flexShrink: 0,
              }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2C4.24 2 2 4.24 2 7s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm.5 7.5h-1v-4h1v4zm0-5h-1V3.5h1V4.5z" fill="white" />
                </svg>
              </div>
              <div>
                <div style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#1D1D1F",
                  letterSpacing: "-0.01em",
                  fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
                }}>
                  Analysis Result
                </div>
                <div style={{
                  fontSize: "10px",
                  fontFamily: "ui-monospace, 'SF Mono', monospace",
                  color: "#6E6E73",
                  marginTop: "1px",
                }}>
                  powered by {result.explanation_model}
                </div>
              </div>
            </div>

            {/* Collapse toggle */}
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                background: "#F5F5F7",
                border: "1px solid #E5E5EA",
                borderRadius: "8px",
                padding: "4px 10px",
                fontSize: "11px",
                color: "#6E6E73",
                cursor: "pointer",
                fontFamily: "ui-monospace, 'SF Mono', monospace",
                transition: "all 0.15s ease",
              }}
            >
              {expanded ? "hide" : "show"}
            </button>
          </div>

          {/* Analysis text */}
          {expanded && (
            <div style={{
              background: "#FAFAFA",
              border: "1px solid #E5E5EA",
              borderRadius: "12px",
              padding: "16px 20px",
              position: "relative",
            }}>
              {/* Green left accent */}
              <div style={{
                position: "absolute",
                left: 0, top: "12px", bottom: "12px",
                width: "3px",
                background: "linear-gradient(180deg, #00C853 0%, #00953D 100%)",
                borderRadius: "0 2px 2px 0",
              }} />
              <p style={{
                fontSize: "14px",
                lineHeight: 1.75,
                color: "#374151",
                margin: 0,
                paddingLeft: "4px",
                fontFamily: "'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
              }}>
                {result.explanation}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Video metadata — card layout */}
      <div style={{ padding: "24px 32px" }}>
        <div style={{
          fontSize: "11px",
          fontFamily: "ui-monospace, 'SF Mono', monospace",
          fontWeight: 600,
          color: "#6E6E73",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: "14px",
        }}>
          Video Details
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <VideoInfoCard info={result.video_a_info} label="A" />
          <VideoInfoCard info={result.video_b_info} label="B" />
        </div>

        {/* Session ID */}
        {result.session_id && (
          <div style={{
            marginTop: "14px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}>
            <span style={{ fontSize: "11px", color: "#6E6E73" }}>Session</span>
            <span style={{
              fontSize: "11px",
              fontFamily: "ui-monospace, 'SF Mono', monospace",
              color: "#9CA3AF",
              background: "#F5F5F7",
              padding: "2px 8px",
              borderRadius: "6px",
            }}>
              {result.session_id}
            </span>
            {result.dataset_saved && (
              <span style={{
                fontSize: "10px",
                fontFamily: "ui-monospace, 'SF Mono', monospace",
                color: "#00953D",
                background: "#F0FDF4",
                border: "1px solid #BBF7D0",
                padding: "2px 8px",
                borderRadius: "99px",
              }}>
                ✓ saved
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}