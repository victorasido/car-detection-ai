import React from "react";

export default function ScoreBar({ score, color }) {
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
