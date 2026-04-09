import React from "react";

export default function Header() {
  return (
    <header style={{
      borderBottom: "1px solid #E5E5EA",
      background: "rgba(255,255,255,0.85)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      padding: "0 40px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      height: "60px",
      position: "sticky",
      top: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{
          width: "32px", height: "32px",
          background: "linear-gradient(135deg, #00C853 0%, #00953D 100%)",
          borderRadius: "10px",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 8px rgba(0,200,83,0.3)",
        }}>
          {/* Tire / wheel icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2"/>
            <circle cx="12" cy="12" r="3.5" stroke="white" strokeWidth="2"/>
            <line x1="12" y1="2" x2="12" y2="8.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="12" y1="15.5" x2="12" y2="22" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="2" y1="12" x2="8.5" y2="12" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="15.5" y1="12" x2="22" y2="12" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="4.22" y1="4.22" x2="8.7" y2="8.7" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="15.3" y1="15.3" x2="19.78" y2="19.78" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="19.78" y1="4.22" x2="15.3" y2="8.7" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="8.7" y1="15.3" x2="4.22" y2="19.78" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <span style={{
          fontSize: "15px",
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: "#1D1D1F",
          fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
        }}>
          VehicleSim
        </span>
      </div>

      {/* Badge */}
      <div style={{
        fontSize: "11px",
        fontFamily: "ui-monospace, 'SF Mono', monospace",
        color: "#00953D",
        background: "#F0FDF4",
        border: "1px solid #BBF7D0",
        padding: "4px 12px",
        borderRadius: "99px",
        letterSpacing: "0.02em",
        fontWeight: 600,
      }}>
        vehicle sim
      </div>
    </header>
  );
}