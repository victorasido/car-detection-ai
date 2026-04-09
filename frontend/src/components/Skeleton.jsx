import React from "react";

export default function Skeleton() {
  return (
    <div className="fade-up" style={{
      background: "#fff",
      border: "1px solid #E5E5EA",
      borderRadius: "20px",
      padding: "32px",
      marginBottom: "20px",
      boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -400% 0; }
          100% { background-position: 400% 0; }
        }
        .sk {
          background: linear-gradient(90deg, #F5F5F7 25%, #E8FFF0 50%, #F5F5F7 75%);
          background-size: 400% 100%;
          animation: shimmer 2s ease-in-out infinite;
          border-radius: 6px;
        }
      `}</style>

      {/* Score hero skeleton */}
      <div style={{ display: "flex", gap: "24px", marginBottom: "28px", alignItems: "center" }}>
        {/* Circle */}
        <div className="sk" style={{ width: "100px", height: "100px", borderRadius: "50%", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div className="sk" style={{ width: "130px", height: "28px", marginBottom: "10px" }} />
          <div className="sk" style={{ width: "90px", height: "18px", marginBottom: "10px" }} />
          <div className="sk" style={{ width: "100%", height: "6px", borderRadius: "99px" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-end" }}>
          <div className="sk" style={{ width: "60px", height: "14px" }} />
          <div className="sk" style={{ width: "80px", height: "14px" }} />
        </div>
      </div>

      {/* Frame scores skeleton */}
      <div style={{ marginBottom: "24px" }}>
        <div className="sk" style={{ width: "140px", height: "12px", marginBottom: "12px" }} />
        <div style={{ display: "flex", gap: "10px" }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="sk" style={{ flex: 1, height: "48px", borderRadius: "10px" }} />
          ))}
        </div>
      </div>

      {/* Analysis result skeleton */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
          <div className="sk" style={{ width: "28px", height: "28px", borderRadius: "8px" }} />
          <div>
            <div className="sk" style={{ width: "120px", height: "14px", marginBottom: "4px" }} />
            <div className="sk" style={{ width: "80px", height: "10px" }} />
          </div>
        </div>
        <div style={{
          background: "#FAFAFA",
          border: "1px solid #E5E5EA",
          borderRadius: "12px",
          padding: "16px 20px",
        }}>
          <div className="sk" style={{ width: "100%", height: "14px", marginBottom: "8px" }} />
          <div className="sk" style={{ width: "95%", height: "14px", marginBottom: "8px" }} />
          <div className="sk" style={{ width: "88%", height: "14px", marginBottom: "8px" }} />
          <div className="sk" style={{ width: "92%", height: "14px" }} />
        </div>
      </div>

      {/* Video details skeleton */}
      <div>
        <div className="sk" style={{ width: "100px", height: "12px", marginBottom: "14px" }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {[0, 1].map(i => (
            <div key={i} style={{
              background: "#FAFAFA",
              border: "1px solid #E5E5EA",
              borderRadius: "12px",
              overflow: "hidden",
            }}>
              <div style={{ padding: "10px 16px", borderBottom: "1px solid #E5E5EA" }}>
                <div className="sk" style={{ width: "60px", height: "12px" }} />
              </div>
              <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {[1, 2, 3, 4].map(j => (
                  <div key={j} style={{ display: "flex", justifyContent: "space-between" }}>
                    <div className="sk" style={{ width: "60px", height: "12px" }} />
                    <div className="sk" style={{ width: "50px", height: "12px" }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}