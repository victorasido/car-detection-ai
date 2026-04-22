import React from "react";

export default function Header() {
  return (
    <header style={{ 
      display: "flex", 
      alignItems: "center", 
      padding: "24px 0", 
      marginBottom: "24px",
      borderBottom: '1px solid var(--border)'
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{
          width: "32px",
          height: "32px",
          background: "var(--aura-emerald)",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--aura-gold)",
          fontWeight: "900",
          fontSize: "16px",
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          A
        </div>
        <h1 className="brand-font" style={{ fontSize: "22px", fontWeight: "700", color: "var(--aura-emerald)", letterSpacing: '0.05em', margin: 0 }}>
          AURA <span style={{ fontWeight: '400', fontSize: '18px', opacity: 0.6 }}>OS</span>
        </h1>
      </div>
      
      <div style={{ flex: 1 }} />
      
      <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%', boxShadow: '0 0 8px #22c55e' }} />
          <span className="mono" style={{ fontSize: '11px', fontWeight: '600', color: 'var(--muted)' }}>SYSTEM_READY</span>
        </div>
      </div>
    </header>
  );
}