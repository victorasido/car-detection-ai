import React from "react";

const verdictColor = {
  HIGH_SIMILARITY: "#00953D",
  MODERATE_SIMILARITY: "#D97706",
  LOW_SIMILARITY: "#DC2626",
  DIFFERENT: "#6E6E73",
};

const verdictLabel = {
  HIGH_SIMILARITY: "High",
  MODERATE_SIMILARITY: "Moderate",
  LOW_SIMILARITY: "Low",
  DIFFERENT: "Different",
};

export default function HistorySidebar({ history, onSelect, onClear }) {
  if (history.length === 0) return null;

  return (
    <div style={{
      width: "260px",
      flexShrink: 0,
      borderLeft: "1px solid #E5E5EA",
      background: "#FAFAFA",
      padding: "24px 16px",
      height: "calc(100vh - 60px)",
      position: "sticky",
      top: "60px",
      overflowY: "auto",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "16px",
        padding: "0 8px",
      }}>
        <div style={{
          fontSize: "11px",
          fontFamily: "ui-monospace, 'SF Mono', monospace",
          fontWeight: 600,
          color: "#6E6E73",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}>
          Recent — {history.length}
        </div>
        <button
          onClick={onClear}
          style={{
            background: "none",
            border: "none",
            color: "#EF4444",
            fontSize: "10px",
            fontFamily: "ui-monospace, 'SF Mono', monospace",
            fontWeight: 600,
            cursor: "pointer",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            padding: "2px 0",
          }}
        >
          Clear all
        </button>
      </div>

      {/* History items */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {history.map((item) => {
          const isCompare = item.similarity_percentage !== undefined;
          const score = isCompare ? item.similarity_percentage : (item.condition_score * 10);
          
          let color = "#6E6E73";
          let label = "Unknown";
          
          if (isCompare) {
             color = verdictColor[item.verdict] || "#6E6E73";
             label = verdictLabel[item.verdict] || item.verdict;
          } else {
             // For damage analysis / deep inspection
             const condition = item.overall_condition;
             if (condition === "excellent") { color = "#00953D"; label = "Excellent"; }
             else if (condition === "good") { color = "#10B981"; label = "Good"; }
             else if (condition === "fair") { color = "#F59E0B"; label = "Fair"; }
             else if (condition === "poor") { color = "#D97706"; label = "Poor"; }
             else if (condition === "critical") { color = "#EF4444"; label = "Critical"; }
             else { color = "#6E6E73"; label = condition || "Analyzed"; }
          }

          return (
            <div
              key={item.inspection_id || item.session_id || item.timestamp}
              onClick={() => onSelect(item)}
              style={{
                padding: "12px 14px",
                borderRadius: "12px",
                background: "#fff",
                border: "1px solid #E5E5EA",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = "#BBF7D0";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,200,83,0.08)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = "#E5E5EA";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "6px",
              }}>
                {/* Score */}
                <span style={{
                  fontSize: "18px",
                  fontWeight: 800,
                  letterSpacing: "-0.04em",
                  color: color,
                  fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
                }}>
                  {score ? score.toFixed(1) : "0.0"}
                  <span style={{ fontSize: "11px", fontWeight: 500, opacity: 0.7 }}>
                     {isCompare ? "%" : "/100"}
                  </span>
                </span>
                {/* Time */}
                <span style={{
                  fontSize: "10px",
                  fontFamily: "ui-monospace, 'SF Mono', monospace",
                  color: "#9CA3AF",
                }}>
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>

              {/* Verdict pill */}
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "10px",
                fontFamily: "ui-monospace, 'SF Mono', monospace",
                fontWeight: 600,
                color: color,
                background: `${color}14`,
                padding: "2px 8px",
                borderRadius: "99px",
              }}>
                <div style={{
                  width: "4px", height: "4px",
                  borderRadius: "50%",
                  background: color,
                  flexShrink: 0,
                }} />
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}