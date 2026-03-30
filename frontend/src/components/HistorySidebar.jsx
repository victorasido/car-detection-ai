import React from "react";

export default function HistorySidebar({ history, onSelect, onClear }) {
  if (history.length === 0) return null;

  return (
    <div className="fade-up" style={{
      width: "260px",
      flexShrink: 0,
      borderLeft: "1px solid var(--border)",
      background: "var(--card-bg)",
      padding: "24px",
      height: "calc(100vh - 56px)",
      position: "sticky",
      top: "56px",
      overflowY: "auto",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div className="mono" style={{
          fontSize: "11px", fontWeight: 600, color: "var(--muted)",
          letterSpacing: "0.08em", textTransform: "uppercase",
        }}>
          History
        </div>
        <button 
          onClick={onClear}
          style={{
            background: "none", border: "none", color: "#ef4444", fontSize: "10px",
            fontWeight: 600, cursor: "pointer", textTransform: "uppercase",
            letterSpacing: "0.05em"
          }}
        >
          Clear
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {history.map((item, idx) => (
          <div
            key={item.session_id}
            onClick={() => onSelect(item)}
            style={{
              padding: "12px",
              borderRadius: "10px",
              background: "var(--bg)",
              border: "1px solid var(--border)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "#d1d5db"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <span className="mono" style={{ fontSize: "14px", fontWeight: 700 }}>
                {item.similarity_percentage.toFixed(1)}%
              </span>
              <span style={{ fontSize: "10px", color: "var(--muted)" }}>
                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="mono" style={{ fontSize: "10px", color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {item.verdict}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
