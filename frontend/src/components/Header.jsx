import React from "react";

export default function Header() {
  return (
    <header style={{
      borderBottom: "1px solid var(--border)",
      background: "var(--card-bg)",
      padding: "0 32px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      height: "56px",
      position: "sticky",
      top: 0,
      zIndex: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{
          width: "28px", height: "28px",
          background: "var(--fg)",
          borderRadius: "8px",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "14px",
          color: "#fff"
        }}>▶</div>
        <span style={{
          fontSize: "14px",
          fontWeight: 700,
          letterSpacing: "-0.02em",
        }}>
          VehicleSim
        </span>
      </div>
      <div className="mono" style={{
        fontSize: "11px",
        color: "var(--muted)",
        background: "var(--bg)",
        border: "1px solid var(--border)",
        padding: "4px 10px",
        borderRadius: "99px",
      }}>
        Stage 5 · Production
      </div>
    </header>
  );
}
