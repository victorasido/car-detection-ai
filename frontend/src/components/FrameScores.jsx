import React from "react";

export default function FrameScores({ scores, color }) {
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
          <div className="mono" style={{
            fontSize: "15px",
            fontWeight: 700,
            color: color,
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
