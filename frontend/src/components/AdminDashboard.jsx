import React, { useState, useEffect } from "react";
import AnnotationCanvas from "./AnnotationCanvas";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function AdminDashboard({ token }) {
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setSessions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (bboxes) => {
    try {
      const res = await fetch(`${API_BASE}/admin/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          analysis_id: selected.id,
          bboxes: bboxes
        })
      });
      if (res.ok) {
        setSelected(null);
        fetchPending();
      }
    } catch (e) {
      alert("Failed to save: " + e.message);
    }
  };

  return (
    <div className="flex gap-8 p-8 bg-gray-50 min-h-screen">
      {/* Sidebar: Pending List */}
      <div className="w-80 flex flex-col gap-4">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <h2 className="text-2xl font-black tracking-tight text-gray-900">Review Queue</h2>
          <p className="text-sm text-gray-500 mt-1">{sessions.length} sessions pending review</p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {loading ? (
             <div className="text-center py-10 text-gray-400 font-medium">Loading queue...</div>
          ) : sessions.map(s => (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className={`w-full text-left p-4 rounded-2xl transition-all border ${
                selected?.id === s.id 
                ? "bg-emerald-50 border-emerald-500 shadow-md shadow-emerald-100 scale-[1.02]" 
                : "bg-white border-gray-100 hover:border-emerald-200 hover:shadow-sm"
              }`}
            >
              <div className="text-xs font-black text-emerald-600 mb-1">{s.session_id.slice(0, 8)}...</div>
              <div className="text-sm font-bold text-gray-800 truncate">{s.media_info?.resolution || "Unknown Res"}</div>
              <div className="text-[10px] text-gray-400 mt-2 font-mono uppercase tracking-widest">{new Date(s.created_at).toLocaleTimeString()}</div>
            </button>
          ))}
          {!loading && sessions.length === 0 && (
            <div className="bg-white/50 p-8 rounded-2xl text-center border border-dashed border-gray-200 text-gray-400 text-sm italic">
              All caught up! No sessions to review.
            </div>
          )}
        </div>
      </div>

      {/* Main Content: Annotation */}
      <div className="flex-1">
        {selected ? (
          <AnnotationCanvas
            imageUrl={`${API_BASE}/admin/frame/${selected.session_id}?path=${selected.frame_path}`}
            annotations={selected.damages}
            onSave={handleSave}
            onCancel={() => setSelected(null)}
          />
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
