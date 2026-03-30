import React from "react";

export default function Skeleton() {
  return (
    <div className="fade-up" style={{
      background: "var(--card-bg)",
      border: "1px solid var(--border)",
      borderRadius: "16px",
      padding: "32px",
      marginBottom: "20px",
      boxShadow: "var(--shadow-sm)",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .shimmer {
          background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 4px;
        }
      `}</style>
      
      <div style={{ display: "flex", gap: "24px", marginBottom: "32px" }}>
        <div className="shimmer" style={{ width: "120px", height: "60px" }} />
        <div style={{ flex: 1 }}>
          <div className="shimmer" style={{ width: "140px", height: "24px", marginBottom: "8px" }} />
          <div className="shimmer" style={{ width: "100px", height: "16px" }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: "10px", marginBottom: "32px" }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="shimmer" style={{ width: "80px", height: "40px", borderRadius: "8px" }} />
        ))}
      </div>

      <div style={{ marginBottom: "12px" }}>
        <div className="shimmer" style={{ width: "100%", height: "16px", marginBottom: "8px" }} />
        <div className="shimmer" style={{ width: "90%", height: "16px", marginBottom: "8px" }} />
        <div className="shimmer" style={{ width: "95%", height: "16px" }} />
      </div>
    </div>
  );
}
