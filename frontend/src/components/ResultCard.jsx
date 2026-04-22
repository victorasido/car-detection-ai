import React, { useState } from "react";
import ScoreBar from "./ScoreBar";
import FrameScores from "./FrameScores";
import ComparisonSlider from "./ComparisonSlider";

const verdictMeta = {
  HIGH_SIMILARITY: { label: "High Similarity", color: "var(--aura-emerald)", bg: "#F0FDF4", border: "#BBF7D0", ring: "var(--aura-emerald)" },
  MODERATE_SIMILARITY: { label: "Moderate Similarity", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", ring: "#F59E0B" },
  LOW_SIMILARITY: { label: "Low Similarity", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", ring: "#EF4444" },
  DIFFERENT: { label: "Different", color: "var(--aura-ink-muted)", bg: "var(--aura-slate)", border: "var(--border)", ring: "#9CA3AF" },
};

const confidenceMeta = {
  HIGH: { label: "High Confidence", dot: "#10B981" },
  MEDIUM: { label: "Medium Confidence", dot: "#F59E0B" },
  LOW: { label: "Low Confidence", dot: "#EF4444" },
};

const urgencyMeta = {
  none: { label: "Optimal State", bg: "#f0fdf4", color: "#166534" },
  optional: { label: "Serviceable", bg: "#f8fafc", color: "#64748b" },
  recommended: { label: "Maintenance Advised", bg: "#fffbeb", color: "#92400e" },
  urgent: { label: "Critical Attention", bg: "#fef2f2", color: "#991b1b" },
  critical: { label: "Hazard Detected", bg: "#450a0a", color: "#fee2e2" },
};

function VideoInfoCard({ info, label }) {
  const fields = [
    { key: "Resolution", val: info?.resolution || "N/A" },
    { key: "Duration", val: `${info?.duration_sec || 0}s` },
    { key: "FPS", val: info?.fps || 0 },
    { key: "Frames", val: info?.frames_used || 0 },
  ];

  return (
    <div className="glass" style={{ border: "1px solid var(--border)", borderRadius: "16px", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,0.02)", display: "flex", gap: "8px", alignItems: "center" }}>
        <span className="mono" style={{ fontSize: "10px", fontWeight: "800", color: "var(--aura-emerald)", background: "rgba(6, 78, 59, 0.1)", padding: "2px 6px", borderRadius: "4px" }}>{label}</span>
        <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>Sensor Meta</span>
      </div>
      <div style={{ padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        {fields.map(({ key, val }) => (
          <div key={key}>
            <div style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase", marginBottom: "2px" }}>{key}</div>
            <div className="mono" style={{ fontSize: "12px", fontWeight: "700", color: "var(--aura-emerald)" }}>{val}</div>
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

  const vm = isCompare ? (verdictMeta[result.verdict] || verdictMeta.DIFFERENT) : null;
  const cm = confidenceMeta[result.confidence] || confidenceMeta.LOW;
  const um = !isCompare ? (urgencyMeta[result.repair_urgency] || urgencyMeta.optional) : null;
  const currentFrame = isV2 ? result.frames[activeFrameIdx] : null;

  return (
    <div className="fade-up glass" style={{
      borderRadius: "32px",
      overflow: "hidden",
      boxShadow: "var(--shadow-lg)",
      marginBottom: "32px",
    }}>

      {/* Primary Visual Feed */}
      {(isV2 || (!isCompare && result.best_frame)) && (
        <div style={{ background: "#000", position: "relative" }}>
          <div style={{ height: "420px", display: "flex", alignItems: "center", justifyContent: "center" }}>
             <img 
               src={isV2 ? `${import.meta.env.VITE_API_URL || ""}/admin/inspections/frame/${currentFrame.frame_id}/image?path=${encodeURIComponent(currentFrame.frame_path)}` : result.best_frame}
               alt="Analysis Frame"
               style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
             />
          </div>
          
          <div style={{ position: "absolute", top: "24px", left: "24px", display: "flex", gap: "12px" }}>
             <div className="glass" style={{ background: "rgba(0,0,0,0.5)", color: "#fff", padding: "8px 16px", borderRadius: "99px", fontSize: "11px", fontWeight: "800", letterSpacing: "0.1em" }}>
                {isV2 ? `NRT-STREAM: SEC ${activeFrameIdx + 1}` : "STATIC ANALYSIS"}
             </div>
             {isV2 && (
               <div style={{ background: "var(--aura-gold)", color: "var(--aura-emerald)", padding: "8px 16px", borderRadius: "99px", fontSize: "11px", fontWeight: "900" }}>
                 AI SCAN ACTIVE
               </div>
             )}
          </div>

          {isV2 && (
            <div style={{ 
              display: "flex", gap: "8px", padding: "16px 24px", 
              overflowX: "auto", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(10px)", borderTop: "1px solid rgba(255,255,255,0.1)" 
            }}>
              {result.frames?.map((f, i) => (
                <button 
                  key={i} 
                  onClick={() => setActiveFrameIdx(i)}
                  style={{
                    flexShrink: 0, width: "80px", height: "54px", 
                    borderRadius: "12px", overflow: "hidden", 
                    border: activeFrameIdx === i ? "3px solid var(--aura-gold)" : "2px solid transparent",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    background: "none", padding: 0, transform: activeFrameIdx === i ? "scale(1.05)" : "none"
                  }}
                >
                  <img 
                    src={`${import.meta.env.VITE_API_URL || ""}/admin/inspections/frame/${f.frame_id}/image?path=${encodeURIComponent(f.frame_path)}`} 
                    style={{ width: "100%", height: "100%", objectFit: "cover", opacity: activeFrameIdx === i ? 1 : 0.4 }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isCompare && result.best_frame_a && result.best_frame_b && (
        <div style={{ padding: "40px", background: "#050505" }}>
          <div className="mono" style={{ color: "var(--aura-gold)", fontSize: "10px", fontWeight: "800", letterSpacing: "0.2em", marginBottom: "24px", textAlign: "center" }}>
            DUAL-SENSOR VISUAL COMPARISON
          </div>
          <ComparisonSlider imgA={result.best_frame_a} imgB={result.best_frame_b} />
        </div>
      )}

      {/* Data Context */}
      <div style={{ padding: "40px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "48px", alignItems: "center", flexWrap: "wrap" }}>
           <div style={{ display: "flex", gap: "32px", alignItems: "center" }}>
              <div style={{ position: "relative" }}>
                  <svg width="120" height="120" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="44" fill="none" stroke="var(--border)" strokeWidth="6" />
                    <circle
                      cx="50" cy="50" r="44" fill="none"
                      stroke={isCompare ? vm.ring : "var(--aura-emerald)"}
                      strokeWidth="6" strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 44 * (isCompare ? result.similarity_percentage : (result.condition_score * 10)) / 100} ${2 * Math.PI * 44}`}
                      transform="rotate(-90 50 50)"
                      style={{ transition: "all 1.5s cubic-bezier(0.22, 1, 0.36, 1)" }}
                    />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <div className="brand-font" style={{ fontSize: "28px", fontWeight: "800", color: "var(--aura-emerald)", lineHeight: 1 }}>
                      {isCompare ? Math.round(result.similarity_percentage) : result.condition_score.toFixed(1)}
                    </div>
                    <div className="mono" style={{ fontSize: "10px", color: "var(--muted)", fontWeight: "600" }}>
                      {isCompare ? "MATCH" : "STABILITY"}
                    </div>
                  </div>
              </div>

              <div>
                <div style={{ 
                  display: "inline-flex", alignItems: "center", gap: "8px", 
                  padding: "6px 14px", borderRadius: "99px", 
                  background: isCompare ? vm.bg : um.bg, color: isCompare ? vm.color : um.color,
                  fontSize: "12px", fontWeight: "800", marginBottom: "16px"
                }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "currentColor" }} />
                  {isCompare ? vm.label : um.label}
                </div>
                <h2 className="brand-font" style={{ fontSize: "24px", color: "var(--aura-emerald)" }}>
                  {isCompare ? "Temporal Verification" : result.overall_condition.toUpperCase()}
                </h2>
                <div style={{ marginTop: "8px" }}>
                  <ScoreBar score={isCompare ? result.similarity_percentage : (result.condition_score * 10)} color={isCompare ? vm.ring : "var(--aura-emerald)"} />
                </div>
              </div>
           </div>

           <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div className="glass" style={{ padding: "16px", borderRadius: "16px", background: "var(--aura-slate)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontSize: "10px", fontWeight: "700", color: "var(--muted)" }}>MODEL</span>
                  <span className="mono" style={{ fontSize: "10px", color: "var(--aura-emerald)" }}>{result.analysis_model || "AURA-V2-DEEP"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "10px", fontWeight: "700", color: "var(--muted)" }}>LATENCY</span>
                  <span className="mono" style={{ fontSize: "10px", color: "var(--aura-emerald)" }}>{result.processing_time_ms?.toFixed(0) || "N/A"}ms</span>
                </div>
              </div>
           </div>
        </div>

        {/* Feature Map */}
        <div style={{ marginTop: "48px" }}>
           <div className="mono" style={{ fontSize: "11px", fontWeight: "800", color: "var(--muted)", letterSpacing: "0.1em", marginBottom: "24px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
             {isCompare ? "GEOMETRIC COMPARISON" : "NEURAL ANOMALY DETECTIONS"}
           </div>

           {isCompare ? (
             <FrameScores scores={result.frame_scores} color="var(--aura-emerald)" />
           ) : (
             <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
                {(isV2 ? (currentFrame?.ai_damages?.damages || []) : (result.damages || [])).length === 0 ? (
                  <div className="glass" style={{ padding: "40px", textAlign: "center", gridColumn: "1/-1", borderRadius: "24px" }}>
                    <div style={{ fontSize: "24px", marginBottom: "8px" }}>🛡️</div>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--aura-emerald)" }}>No structural risks detected in this sector.</div>
                  </div>
                ) : (isV2 ? currentFrame.ai_damages.damages : result.damages).map((dmg, idx) => (
                  <div key={idx} className="glass" style={{ padding: "24px", borderRadius: "24px", display: "flex", gap: "20px", transition: "transform 0.2s" }}>
                    <div style={{ width: "4px", background: dmg.severity === 'severe' ? '#dc2626' : (dmg.severity === 'moderate' ? '#d97706' : '#166534'), borderRadius: "4px" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                        <h4 style={{ fontSize: "14px", fontWeight: "800", textTransform: "uppercase", color: "var(--aura-emerald)" }}>{dmg.type.replace('_', ' ')}</h4>
                        <span className="mono" style={{ fontSize: "10px", background: "var(--aura-slate)", padding: "2px 8px", borderRadius: "4px" }}>{dmg.severity}</span>
                      </div>
                      <div className="mono" style={{ fontSize: "11px", color: "var(--aura-gold)", fontWeight: "700", marginBottom: "8px" }}>SEC: {dmg.location.replace('_', ' ')}</div>
                      <p style={{ fontSize: "13px", lineHeight: "1.6", color: "var(--aura-ink-muted)" }}>{dmg.description}</p>
                    </div>
                  </div>
                ))}
             </div>
           )}
        </div>

        {/* Narrative */}
        {(result.explanation || result.analysis_notes || (isV2 && currentFrame?.ai_damages?.analysis_notes)) && (
          <div style={{ marginTop: "40px", padding: "32px", background: "var(--aura-emerald)", color: "#fff", borderRadius: "24px", position: "relative", overflow: "hidden" }}>
             <div style={{ position: "absolute", right: "-20px", top: "-20px", fontSize: "120px", opacity: 0.1 }}>❝</div>
             <div className="mono" style={{ fontSize: "10px", fontWeight: "800", color: "var(--aura-gold)", letterSpacing: "0.2em", marginBottom: "16px" }}>INTELLIGENCE SUMMARY</div>
             <p className="brand-font" style={{ fontSize: "18px", lineHeight: "1.7", fontStyle: "italic" }}>
               {isV2 ? (currentFrame?.ai_damages?.analysis_notes || result.analysis_notes) : (result.explanation || result.analysis_notes)}
             </p>
          </div>
        )}

        {/* Technical Footer */}
        <div style={{ marginTop: "48px", paddingTop: "24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
           <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <span className="mono" style={{ fontSize: "11px", color: "var(--muted)" }}>UUID: {result.inspection_id || result.session_id}</span>
              {result.dataset_saved && <span style={{ fontSize: "10px", background: "#f0fdf4", color: "#166534", padding: "2px 8px", borderRadius: "99px", fontWeight: "800" }}>ARCHIVED</span>}
           </div>
           <div className="mono" style={{ fontSize: "11px", color: "var(--aura-gold)", fontWeight: "800" }}>AURA SYSTEM REPORT &copy; 2026</div>
        </div>
      </div>
    </div>
  );
}

