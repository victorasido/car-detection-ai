import React, { useState, useEffect } from "react";
import AnnotationCanvas from "./AnnotationCanvas";

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function AdminDashboard({ token }) {
  const [activeQueue, setActiveQueue] = useState("v2"); // "v1" or "v2"
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null); 
  const [activeFrameIdx, setActiveFrameIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchItems();
  }, [activeQueue]);

  const fetchItems = async () => {
    setLoading(true);
    setItems([]);
    setSelected(null);
    try {
      const endpoint = activeQueue === "v1" ? "/admin/pending" : "/admin/inspections/pending";
      const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setItems(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (bboxes) => {
    try {
      if (activeQueue === "v1") {
        const res = await fetch(`${API_BASE}/admin/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ analysis_id: selected.id, bboxes })
        });
        if (res.ok) {
          setSelected(null);
          fetchItems();
        }
      } else {
        const frame = selected.frames[activeFrameIdx];
        const res = await fetch(`${API_BASE}/admin/review/frame/${frame.frame_id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ bboxes, is_verified: true, override_notes: "" })
        });
        if (res.ok) {
          if (activeFrameIdx < selected.frames.length - 1) {
             setActiveFrameIdx(activeFrameIdx + 1);
          } else {
             setSelected(null);
             fetchItems();
          }
        }
      }
    } catch (e) {
      alert("Failed to save: " + e.message);
    }
  };

  const currentImageUrl = selected ? (
    activeQueue === "v1" 
    ? `${API_BASE}/admin/frame/${selected.session_id}?path=${selected.frame_path}`
    : `${API_BASE}/admin/inspections/frame/${selected.frames[activeFrameIdx].frame_id}/image?path=${encodeURIComponent(selected.frames[activeFrameIdx].frame_path)}`
  ) : null;

  const currentAnnotations = selected ? (
    activeQueue === "v1"
    ? selected.damages
    : selected.frames[activeFrameIdx].ai_damages.damages
  ) : [];

  return (
    <div className="aura-admin-wrap" style={{ display: "flex", gap: "32px", height: "calc(100vh - 120px)" }}>
      <style>{`
         .aura-admin-wrap {
            color: var(--aura-ink);
         }
         .sidebar-pane {
            width: 340px;
            display: flex;
            flex-direction: column;
            gap: 24px;
         }
         .queue-card {
            background: #fff;
            padding: 16px;
            border-radius: 20px;
            border: 1.5px solid var(--border);
            display: flex;
            flex-direction: column;
            gap: 4px;
            text-align: left;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
         }
         .queue-card.active {
            border-color: var(--aura-emerald);
            background: #f0fdf4;
            box-shadow: 0 10px 20px -5px rgba(6, 78, 59, 0.08);
            transform: translateX(8px);
         }
         .queue-card:hover:not(.active) {
            border-color: var(--aura-emerald-light);
            background: #fafafa;
         }
         .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            border: 2px dashed var(--border);
            border-radius: 32px;
            color: var(--muted);
            gap: 16px;
         }
      `}</style>
      
      {/* Sidebar Archive */}
      <aside className="sidebar-pane">
        <div className="glass" style={{ padding: '24px', borderRadius: '24px' }}>
          <h2 className="brand-font" style={{ fontSize: '24px', color: 'var(--aura-emerald)', marginBottom: '16px' }}>Review Queue</h2>
          <div style={{ display: 'flex', background: 'var(--aura-slate)', padding: '4px', borderRadius: '12px' }}>
             <button 
                onClick={() => setActiveQueue("v2")}
                className="aura-btn"
                style={{ flex: 1, fontSize: '10px', background: activeQueue === 'v2' ? '#fff' : 'transparent', boxShadow: activeQueue === 'v2' ? 'var(--shadow-sm)' : 'none', color: activeQueue === 'v2' ? 'var(--aura-emerald)' : 'var(--muted)' }}
             >
                DEEP SCAN
             </button>
             <button 
                onClick={() => setActiveQueue("v1")}
                className="aura-btn"
                style={{ flex: 1, fontSize: '10px', background: activeQueue === 'v1' ? '#fff' : 'transparent', boxShadow: activeQueue === 'v1' ? 'var(--shadow-sm)' : 'none', color: activeQueue === 'v1' ? 'var(--aura-emerald)' : 'var(--muted)' }}
             >
                LEGACY
             </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loading ? (
             <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)', fontSize: '13px' }}>Accessing neural vaults...</div>
          ) : items.map(item => (
            <button
              key={item.id || item.inspection_id}
              onClick={() => { setSelected(item); setActiveFrameIdx(0); }}
              className={`queue-card ${ (selected?.id === item.id || selected?.inspection_id === item.inspection_id) ? "active" : "" }`}
            >
              <div className="mono" style={{ fontSize: "10px", fontWeight: "800", color: "var(--aura-emerald)", marginBottom: "4px" }}>
                 ID: {(item.session_id || item.inspection_id).slice(0, 12)}
              </div>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--aura-ink)" }}>
                 {activeQueue === "v1" ? (item.media_info?.resolution || "Sensor Image") : `${item.frames?.length || 0} Neural Frames`}
              </div>
              <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "8px" }}>
                 {new Date(item.created_at).toLocaleTimeString()} · {item.user_id ? 'Field Operator' : 'Automated'}
              </div>
            </button>
          ))}
          {!loading && items.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)', fontSize: '13px', border: '1.5px dashed var(--border)', borderRadius: '20px' }}>
              Vault is clear. All sessions verified.
            </div>
          )}
        </div>
      </aside>

      {/* Workspace */}
      <main style={{ flex: 1, position: 'relative' }}>
        {selected ? (
          <div className="glass fade-up" style={{ height: '100%', borderRadius: '32px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
             {activeQueue === "v2" && (
                <div style={{ display: 'flex', gap: '8px', padding: '16px 24px', background: 'var(--aura-emerald)', overflowX: 'auto' }}>
                   {selected.frames?.map((f, i) => (
                      <button 
                         key={f.frame_id}
                         onClick={() => setActiveFrameIdx(i)}
                         style={{ flexShrink: 0, width: '80px', height: '54px', borderRadius: '10px', overflow: 'hidden', border: activeFrameIdx === i ? '3px solid var(--aura-gold)' : '2px solid transparent', opacity: activeFrameIdx === i ? 1 : 0.4, transition: 'all 0.2s', padding: 0 }}
                      >
                         <img src={`${API_BASE}/admin/inspections/frame/${f.frame_id}/image?path=${encodeURIComponent(f.frame_path)}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </button>
                   ))}
                </div>
             )}
             <div style={{ flex: 1 }}>
                <AnnotationCanvas
                   key={`${selected.id || selected.inspection_id}-${activeFrameIdx}`}
                   imageUrl={currentImageUrl}
                   annotations={currentAnnotations}
                   onSave={handleSave}
                   onCancel={() => setSelected(null)}
                />
             </div>
          </div>
        ) : (
          <div className="empty-state">
             <div style={{ fontSize: '48px' }}>🕵️</div>
             <p className="brand-font" style={{ fontSize: '20px', color: 'var(--aura-emerald)' }}>Intelligence Verification Module</p>
             <p style={{ fontSize: '14px', color: 'var(--muted)' }}>Select a sequence from the queue to finalize structural reports.</p>
          </div>
        )}
      </main>
    </div>
  );
}
