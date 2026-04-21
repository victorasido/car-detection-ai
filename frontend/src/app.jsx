import React, { useState, useEffect } from "react";
import Header from "./components/Header";
import DropZone from "./components/DropZone";
import ResultCard from "./components/ResultCard";
import HistorySidebar from "./components/HistorySidebar";
import Skeleton from "./components/Skeleton";
import Login from "./components/Login";
import AdminDashboard from "./components/AdminDashboard";

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [view, setView] = useState("inspector"); // "inspector" or "reviewer"
  const [inspectorMode, setInspectorMode] = useState("compare"); // "compare", "analyze", or "deep"
  
  const [fileA, setFileA] = useState(null);
  const [fileB, setFileB] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeInspectionId, setActiveInspectionId] = useState(null);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem("vehicle_sim_history");
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  // Polling logic for Deep Inspection
  useEffect(() => {
    let interval;
    if (activeInspectionId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API_BASE}/inspection/status/${activeInspectionId}`, {
             headers: { Authorization: `Bearer ${token}` }
          });
          if (!res.ok) return;
          const status = await res.json();
          
          if (status.progress) {
            setProgress(status.progress);
          }

          if (status.status === "done") {
             // Fetch result
             const resResult = await fetch(`${API_BASE}/inspection/result/${activeInspectionId}`, {
                headers: { Authorization: `Bearer ${token}` }
             });
             const resultData = await resResult.json();
             setResult(resultData);
             addToHistory(resultData);
             setActiveInspectionId(null);
             setLoading(false);
             clearInterval(interval);
          } else if (status.status === "failed") {
             setError(status.error || "Inspection failed.");
             setActiveInspectionId(null);
             setLoading(false);
             clearInterval(interval);
          }
        } catch (e) {
          console.error("Polling error:", e);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [activeInspectionId, token]);

  const handleLogin = (newToken) => {
    setToken(newToken);
    localStorage.setItem("token", newToken);
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem("token");
  };

  const addToHistory = (newData) => {
    const item = { ...newData, timestamp: new Date().toISOString(), type: inspectorMode };
    const updated = [item, ...history].slice(0, 10);
    setHistory(updated);
    localStorage.setItem("vehicle_sim_history", JSON.stringify(updated));
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem("vehicle_sim_history");
  };

  const handleCompare = async () => {
    if (!fileA || !fileB || loading) return;
    setLoading(true);
    setResult(null);
    setError(null);

    const form = new FormData();
    form.append("video_a", fileA);
    form.append("video_b", fileB);

    try {
      const res = await fetch(`${API_BASE}/compare`, { 
        method: "POST", 
        body: form,
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setResult(data);
      addToHistory(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!fileA || loading) return;
    setLoading(true);
    setResult(null);
    setError(null);

    const form = new FormData();
    form.append("file", fileA);

    try {
      const res = await fetch(`${API_BASE}/analyze`, { 
        method: "POST", 
        body: form,
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setResult(data);
      addToHistory(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeepInspection = async () => {
    if (!fileA || loading) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setProgress({ frames_extracted: 0, frames_analyzed: 0, frames_total: 0 });

    const form = new FormData();
    form.append("file", fileA);

    try {
      const res = await fetch(`${API_BASE}/inspection/analyze`, { 
        method: "POST", 
        body: form,
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setActiveInspectionId(data.inspection_id);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background: #F5F5F7;
          font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
          color: #1D1D1F;
          -webkit-font-smoothing: antialiased;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.4s ease both; }
      `}</style>

      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#F5F5F7" }}>
        <Header />
        
        {/* View Toggler */}
        <div className="bg-white border-b border-gray-100 flex px-8 py-3 gap-6">
           <button 
              onClick={() => setView("inspector")}
              className={`text-[11px] font-black uppercase tracking-widest transition-all ${view === "inspector" ? "text-emerald-600 border-b-2 border-emerald-600 pb-1" : "text-gray-400 hover:text-gray-600"}`}
           >
              Field Inspector
           </button>
           <button 
              onClick={() => setView("reviewer")}
              className={`text-[11px] font-black uppercase tracking-widest transition-all ${view === "reviewer" ? "text-emerald-600 border-b-2 border-emerald-600 pb-1" : "text-gray-400 hover:text-gray-600"}`}
           >
              Review Dashboard
           </button>
           <div className="flex-1" />
           <button 
              onClick={handleLogout}
              className="text-[11px] font-black uppercase tracking-widest text-red-400 hover:text-red-600 transition-all font-mono"
           >
              Logout
           </button>
        </div>

        {view === "reviewer" ? (
          <AdminDashboard token={token} />
        ) : (
          <div style={{ display: "flex", flex: 1 }}>
            <main style={{ flex: 1, padding: "48px 32px 80px" }}>
              <div style={{ maxWidth: "720px", margin: "0 auto" }}>
                <div className="fade-up" style={{ marginBottom: "32px" }}>
                  <div className="flex gap-4 mb-4">
                     <button 
                        onClick={() => { setInspectorMode("compare"); setResult(null); }}
                        className={`text-[10px] font-bold px-4 py-1.5 rounded-full transition-all border ${inspectorMode === "compare" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-400 border-gray-200"}`}
                     >
                        SIMILARITY CHECK
                     </button>
                      <button 
                         onClick={() => { setInspectorMode("inspect"); setResult(null); }}
                         className={`text-[10px] font-bold px-4 py-1.5 rounded-full transition-all border ${inspectorMode === "inspect" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-400 border-gray-200"}`}
                      >
                         NEW INSPECTION
                      </button>
                   </div>
                   <h1 style={{ fontSize: "30px", fontWeight: 800, letterSpacing: "-0.04em" }}>
                     {inspectorMode === "compare" ? "Vehicle Similarity" : "AI Vehicle Inspection"}
                   </h1>
                   <p style={{ fontSize: "15px", color: "#6E6E73", lineHeight: 1.6, maxWidth: "480px" }}>
                     {inspectorMode === "compare" 
                       ? "Compare vehicle videos securely using AI-powered CLIP embeddings."
                       : "Upload a vehicle photo or video. The AI will automatically adapt and run a full inspection."}
                   </p>
                </div>

                <div className="fade-up" style={{
                  background: "#fff", border: "1px solid #E5E5EA", borderRadius: "20px",
                  padding: "24px", marginBottom: "16px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)"
                }}>
                  <div style={{ display: "flex", gap: "16px", marginBottom: "20px", flexWrap: "wrap" }}>
                    <DropZone label={inspectorMode === "compare" ? "Video A" : "Vehicle Media"} file={fileA} onFile={setFileA} disabled={loading} />
                    {inspectorMode === "compare" && (
                      <DropZone label="Video B" file={fileB} onFile={setFileB} disabled={loading} />
                    )}
                  </div>

                   {inspectorMode === "compare" ? (
                    <button
                      onClick={handleCompare}
                      disabled={!fileA || !fileB || loading}
                      className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                        fileA && fileB && !loading 
                        ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100" 
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      {loading ? "Analyzing..." : "Compare Videos"}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (!fileA) return;
                        const isVideo = fileA.name && fileA.name.match(/\.(mp4|mov|mkv|avi)$/i);
                        if (isVideo || (fileA.type && fileA.type.startsWith("video/"))) {
                          handleDeepInspection();
                        } else {
                          handleAnalyze();
                        }
                      }}
                      disabled={!fileA || loading}
                      className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                        fileA && !loading 
                        ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100" 
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      {loading ? "Initializing Scan..." : "Start AI Inspection"}
                    </button>
                  )}
                </div>

                {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold border border-red-100">⚠ {error}</div>}
                
                {loading && activeInspectionId && progress && (
                   <div className="fade-up bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mb-6">
                      <div className="flex justify-between items-center mb-4">
                         <span className="text-xs font-black uppercase tracking-widest text-emerald-600">Processing Inspection...</span>
                         <span className="text-xs font-mono text-gray-400">{Math.round((progress.frames_analyzed / (progress.frames_total || 1)) * 100)}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                         <div 
                            className="h-full bg-emerald-500 transition-all duration-500" 
                            style={{ width: `${(progress.frames_analyzed / (progress.frames_total || 1)) * 100}%` }}
                         />
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-4">
                         <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">Extraction</div>
                            <div className="text-sm font-black text-gray-800">{progress.frames_extracted} / {progress.frames_total}</div>
                         </div>
                         <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">AI Analysis</div>
                            <div className="text-sm font-black text-gray-800">{progress.frames_analyzed} done</div>
                         </div>
                      </div>
                   </div>
                )}

                {loading && !activeInspectionId && <Skeleton />}
                {result && !loading && <ResultCard result={result} />}
              </div>
            </main>

            <HistorySidebar history={history} onSelect={setResult} onClear={handleClearHistory} />
          </div>
        )}
      </div>
    </>
  );
}