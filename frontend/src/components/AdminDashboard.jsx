import React, { useState, useEffect } from "react";
import AnnotationCanvas from "./AnnotationCanvas";

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function AdminDashboard({ token }) {
  const [activeQueue, setActiveQueue] = useState("v2"); // "v1" or "v2"
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null); // current inspection (v2) or analytic (v1)
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
        // V2 Flow: Save individual frame
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
    : `${API_BASE}/admin/frame/${selected.inspection_id}?path=${selected.frames[activeFrameIdx].frame_path}`
  ) : null;

  const currentAnnotations = selected ? (
    activeQueue === "v1"
    ? selected.damages
    : selected.frames[activeFrameIdx].ai_damages.damages
  ) : [];

  return (
    <div className="flex gap-8 p-8 bg-gray-50 min-h-screen">
      {/* Sidebar: Pending List */}
      <div className="w-80 flex flex-col gap-4">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <h2 className="text-2xl font-black tracking-tight text-gray-900">Review Queue</h2>
          <div className="flex gap-2 mt-4">
             <button 
                onClick={() => setActiveQueue("v2")}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black tracking-widest border transition-all ${activeQueue === "v2" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-400 border-gray-200"}`}
             >
                DEEP (V2)
             </button>
             <button 
                onClick={() => setActiveQueue("v1")}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black tracking-widest border transition-all ${activeQueue === "v1" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-400 border-gray-200"}`}
             >
                LEGACY
             </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {loading ? (
             <div className="text-center py-10 text-gray-400 font-medium italic">Scanning vault...</div>
          ) : items.map(item => (
            <button
              key={item.id || item.inspection_id}
              onClick={() => { setSelected(item); setActiveFrameIdx(0); }}
              className={`w-full text-left p-4 rounded-2xl transition-all border ${
                (selected?.id === item.id || selected?.inspection_id === item.inspection_id) 
                ? "bg-emerald-50 border-emerald-500 shadow-md shadow-emerald-100 scale-[1.02]" 
                : "bg-white border-gray-100 hover:border-emerald-200 hover:shadow-sm"
              }`}
            >
              <div className="text-xs font-black text-emerald-600 mb-1">{(item.session_id || item.inspection_id).slice(0, 8)}...</div>
              <div className="text-sm font-bold text-gray-800 truncate">
                 {activeQueue === "v1" ? (item.media_info?.resolution || "Photo Analysis") : `${item.frames.length} Full Frames`}
              </div>
              <div className="text-[10px] text-gray-400 mt-2 font-mono uppercase tracking-widest">
                 {new Date(item.created_at).toLocaleTimeString()}
              </div>
            </button>
          ))}
          {!loading && items.length === 0 && (
            <div className="bg-white/50 p-8 rounded-2xl text-center border border-dashed border-gray-200 text-gray-400 text-sm italic">
              All caught up! No sessions to review.
            </div>
          )}
        </div>
      </div>

      {/* Main Content: Annotation */}
      <div className="flex-1">
        {selected ? (
          <div className="flex flex-col h-full bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
             {activeQueue === "v2" && (
                <div className="bg-gray-900 p-4 flex gap-2 overflow-x-auto border-b border-gray-800">
                   {selected.frames.map((f, i) => (
                      <button 
                         key={f.frame_id}
                         onClick={() => setActiveFrameIdx(i)}
                         className={`flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-all ${activeFrameIdx === i ? "border-emerald-500" : "border-transparent opacity-40 hover:opacity-100"}`}
                      >
                         <img src={`${API_BASE}/admin/frame/${selected.inspection_id}?path=${f.frame_path}`} className="w-full h-full object-cover" />
                      </button>
                   ))}
                </div>
             )}
             <div className="flex-1 relative">
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
          <div className="h-full rounded-3xl border-4 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-300 gap-4">
            <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <p className="text-xl font-bold italic tracking-wider">SELECT A SESSION TO START REVIEWING</p>
          </div>
        )}
      </div>
    </div>
  );
}
