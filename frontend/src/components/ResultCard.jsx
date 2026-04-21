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

const urgencyMeta = {
  none: { label: "No Repair Needed", bg: "#F0FDF4", color: "#00953D" },
  optional: { label: "Optional Repair", bg: "#F5F5F7", color: "#6E6E73" },
  recommended: { label: "Recommended", bg: "#FFFBEB", color: "#D97706" },
  urgent: { label: "Urgent Repair", bg: "#FEF2F2", color: "#DC2626" },
  critical: { label: "Critical Failure", bg: "#450A0A", color: "#FEE2E2" },
};

function VideoInfoCard({ info, label }) {
  const fields = [
    { key: "Resolution", val: info?.resolution || "N/A", icon: "⊞" },
    { key: "Duration", val: `${info?.duration_sec || 0}s`, icon: "◷" },
    { key: "FPS", val: info?.fps || 0, icon: "⏱" },
    { key: "Frames used", val: info?.frames_used || 0, icon: "▤" },
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
          Media Info
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
  const isCompare = result.similarity_percentage !== undefined;
  const isV2 = !!result.frames;
  const [expanded, setExpanded] = useState(true);
  const [activeFrameIdx, setActiveFrameIdx] = useState(0);

  // Similarity Meta
  const vm = isCompare ? (verdictMeta[result.verdict] || verdictMeta.DIFFERENT) : null;
  const cm = confidenceMeta[result.confidence] || confidenceMeta.LOW;
  
  // Damage Meta (V1 or V2)
  const um = !isCompare ? (urgencyMeta[result.repair_urgency] || urgencyMeta.optional) : null;

  const currentFrame = isV2 ? result.frames[activeFrameIdx] : null;

  return (
    <div className="fade-up" style={{
      background: "#fff",
      border: "1px solid #E5E5EA",
      borderRadius: "20px",
      overflow: "hidden",
      boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)",
      marginBottom: "20px",
    }}>

      {/* Visual Header */}
      {isCompare && result.best_frame_a && result.best_frame_b && (
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

      {/* V2 Frame Gallery */}
      {isV2 && (
        <div style={{ borderBottom: "1px solid #E5E5EA", background: "#000" }}>
          <div style={{ position: "relative", height: "360px" }}>
            <img 
              src={`${import.meta.env.VITE_API_URL || ""}/admin/frame/${result.inspection_id || result.session_id}?path=${currentFrame.frame_path}`}
              alt={`Frame ${activeFrameIdx}`}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
            <div style={{
                position: "absolute", bottom: "16px", left: "16px",
                background: "rgba(0,0,0,0.6)", padding: "8px 16px",
                borderRadius: "10px", color: "white", fontSize: "11px",
                fontWeight: 700, letterSpacing: "0.05em", backdropFilter: "blur(8px)"
            }}>
                DEEP ANALYSIS: FRAME {activeFrameIdx + 1} / {result.frames.length}
            </div>
          </div>
          <div style={{ 
            display: "flex", gap: "8px", padding: "12px", 
            overflowX: "auto", background: "#111", borderTop: "1px solid #333" 
          }}>
            {result.frames.map((f, i) => (
              <button 
                key={i} 
                onClick={() => setActiveFrameIdx(i)}
                style={{
                  flexShrink: 0, width: "70px", height: "50px", 
                  borderRadius: "6px", overflow: "hidden", 
                  border: activeFrameIdx === i ? "2px solid #10B981" : "2px solid transparent",
                  transition: "all 0.2s",
                  background: "none",
                  padding: 0
                }}
              >
                <img 
                  src={`${import.meta.env.VITE_API_URL || ""}/admin/frame/${result.inspection_id || result.session_id}?path=${f.frame_path}`} 
                  style={{ width: "100%", height: "100%", objectFit: "cover", opacity: activeFrameIdx === i ? 1 : 0.5 }}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {!isCompare && !isV2 && result.best_frame && (
        <div style={{ position: "relative", height: "320px", background: "#000" }}>
           <img 
            src={result.best_frame} 
            alt="Analyzed vehicle"
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
           />
           <div style={{
              position: "absolute", bottom: "16px", left: "16px",
              background: "rgba(0,0,0,0.6)", padding: "8px 16px",
              borderRadius: "10px", color: "white", fontSize: "11px",
              fontWeight: 700, letterSpacing: "0.05em", backdropFilter: "blur(8px)"
           }}>
              KEY FRAME ANALYZED
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
        background: isCompare ? `linear-gradient(135deg, ${vm.bg} 0%, #fff 60%)` : "#fff",
      }}>
        {/* Score circle */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#E5E5EA" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="42"
              fill="none"
              stroke={isCompare ? vm.ring : "#10B981"}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 42 * (isCompare ? result.similarity_percentage : (result.condition_score * 10)) / 100} ${2 * Math.PI * 42}`}
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
              color: isCompare ? vm.color : "#065F46",
              lineHeight: 1,
              fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
            }}>
              {isCompare ? result.similarity_percentage.toFixed(1) : result.condition_score.toFixed(1)}
            </span>
            <span style={{ fontSize: "11px", color: "#6E6E73", fontWeight: 500 }}>
               {isCompare ? "%" : "/ 10"}
            </span>
          </div>
        </div>

        {/* Verdict + confidence / Urgency */}
        <div style={{ flex: 1 }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            background: isCompare ? vm.bg : um.bg,
            color: isCompare ? vm.color : um.color,
            border: `1px solid ${isCompare ? vm.border : "#E5E5EA"}`,
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
              background: isCompare ? vm.ring : um.color,
            }} />
            {(isCompare ? vm.label : um.label).toUpperCase()}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
             {!isCompare ? (
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#1D1D1F" }}>
                   Condition: {result.overall_condition.toUpperCase()}
                </span>
             ) : (
                <>
                  <div style={{
                    width: "6px", height: "6px",
                    borderRadius: "50%",
                    background: cm.dot,
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: "12px", color: "#6E6E73" }}>{cm.label}</span>
                </>
             )}
          </div>

          <ScoreBar score={isCompare ? result.similarity_percentage : (result.condition_score * 10)} color={isCompare ? vm.ring : "#10B981"} />
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
            {result.processing_time_ms ? `${result.processing_time_ms.toFixed(0)}ms` : "Async"}
          </div>
          <div style={{
            fontSize: "11px",
            fontFamily: "ui-monospace, 'SF Mono', monospace",
            color: "#6E6E73",
          }}>
            {result.analysis_model || result.embedding_model || "V2 Engine"}
          </div>
        </div>
      </div>

      {/* Results Content */}
      {isCompare ? (
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
      ) : (
        <div style={{ borderBottom: "1px solid #E5E5EA" }}>
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
               {isV2 ? `Frame ${activeFrameIdx + 1} Damages` : `Detected Damages (${result.estimated_damage_count})`}
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
               {(isV2 ? (currentFrame?.ai_damages?.damages || []) : (result.damages || [])).length === 0 ? (
                  <div className="p-4 bg-gray-50 rounded-xl text-center text-sm text-gray-400 italic">
                     No visible damage detected.
                  </div>
               ) : (isV2 ? currentFrame.ai_damages.damages : result.damages).map((dmg, idx) => (
                  <div key={idx} style={{
                     background: "#FAFAFA",
                     padding: "14px 18px",
                     borderRadius: "16px",
                     border: "1px solid #E5E5EA",
                     display: "flex",
                     gap: "14px",
                  }}>
                     <div style={{
                        width: "8px", height: "40px",
                        background: dmg.severity === 'severe' ? '#EF4444' : (dmg.severity === 'moderate' ? '#F59E0B' : '#6E6E73'),
                        borderRadius: "4px"
                     }} />
                     <div style={{ flex: 1 }}>
                        <div className="flex items-center gap-3 mb-1">
                           <span className="text-sm font-black uppercase tracking-tight text-gray-900">{dmg.type.replace('_', ' ')}</span>
                           <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-400 capitalize">{dmg.severity}</span>
                        </div>
                        <div className="text-[10px] font-bold text-emerald-600 uppercase mb-2 tracking-wide">Location: {dmg.location.replace('_', ' ')}</div>
                        <p className="text-xs text-gray-500 leading-relaxed font-medium">{dmg.description}</p>
                     </div>
                  </div>
               ))}
            </div>
           </div>
        </div>
      )}

      {/* Analysis Result (AI Explanation) */}
      {(result.explanation || result.analysis_notes || (isV2 && currentFrame?.ai_damages?.analysis_notes)) && (
        <div style={{ padding: "24px 32px", borderBottom: isCompare || isV2 ? "1px solid #E5E5EA" : "none" }}>
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
                  {isV2 ? "Frame Summary" : "Inspector's Note"}
                </div>
                <div style={{
                  fontSize: "10px",
                  fontFamily: "ui-monospace, 'SF Mono', monospace",
                  color: "#6E6E73",
                  marginTop: "1px",
                }}>
                  generated by {result.explanation_model || result.analysis_model || "AI Engine"}
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
                {isV2 ? (currentFrame?.ai_damages?.analysis_notes || result.analysis_notes) : (result.explanation || result.analysis_notes)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Video metadata — card layout */}
      {isCompare && (
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
        </div>
      )}

      {!isCompare && result.media_info && (
          <div style={{ padding: "24px 32px", paddingTop: 0, marginTop: isV2 ? "24px" : 0 }}>
             <VideoInfoCard info={result.media_info} label="M" />
          </div>
      )}

      {/* Session ID footer */}
      <div style={{ padding: "16px 32px", borderTop: "1px solid #E5E5EA", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "11px", color: "#6E6E73" }}>Session</span>
            <span style={{
              fontSize: "11px",
              fontFamily: "ui-monospace, 'SF Mono', monospace",
              color: "#9CA3AF",
              background: "#F5F5F7",
              padding: "2px 8px",
              borderRadius: "6px",
            }}>
              {result.inspection_id || result.session_id}
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
    </div>
  );
}

