import React, { useState, useEffect } from "react";
import LandingPage from "./LandingPage";
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
  const [showLanding, setShowLanding] = useState(!token);
  const [view, setView] = useState("inspector"); // "inspector" or "reviewer"
  const [inspectorMode, setInspectorMode] = useState("compare"); // "compare", "inspection"
  
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
             setError(status.error_message || "Inspection failed.");
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
    setShowLanding(false);
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem("token");
    setShowLanding(true);
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

  if (showLanding) {
    return <LandingPage onEnterApp={() => token ? setShowLanding(false) : setShowLanding(false)} />;
  }

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="aura-os-shell" style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg)" }}>
      <style>{`
        .aura-os-shell {
          color: var(--fg);
        }
        .nav-sidebar {
          width: 80px;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 24px 0;
          gap: 32px;
          background: var(--aura-emerald);
          color: #fff;
          z-index: 50;
        }
        .nav-item {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          opacity: 0.6;
        }
        .nav-item.active {
          background: rgba(255,255,255,0.15);
          opacity: 1;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.2);
        }
        .nav-item:hover {
          opacity: 1;
        }
        .main-content-wrap {
          flex: 1;
          display: flex;
          overflow: hidden;
        }
        .content-area {
          flex: 1;
          overflow-y: auto;
          background: #fdfdfd;
          padding: 40px;
        }
        .section-header {
          margin-bottom: 40px;
        }
        .mode-toggler {
          display: inline-flex;
          background: var(--border);
          padding: 4px;
          border-radius: 99px;
          margin-bottom: 24px;
        }
        .mode-btn {
          padding: 6px 16px;
          border-radius: 99px;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          background: transparent;
          color: var(--muted);
        }
        .mode-btn.active {
          background: #fff;
          color: var(--aura-emerald);
          box-shadow: var(--shadow-sm);
        }
      `}</style>

      <div className="main-content-wrap">
        {/* Minimal Navigation Sidebar */}
        <aside className="nav-sidebar">
          <div className="logo brand-font" style={{ fontSize: '18px', color: 'var(--aura-gold)' }}>A</div>
          <div className={`nav-item ${view === 'inspector' ? 'active' : ''}`} onClick={() => setView('inspector')} title="Inspector">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          </div>
          <div className={`nav-item ${view === 'reviewer' ? 'active' : ''}`} onClick={() => setView('reviewer')} title="Review">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </div>
          <div style={{ marginTop: 'auto' }} className="nav-item" onClick={handleLogout} title="Logout">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </div>
        </aside>

        <section className="content-area">
          <Header />
          
          {view === "reviewer" ? (
            <AdminDashboard token={token} />
          ) : (
            <div className="fade-up" style={{ maxWidth: "800px", margin: "0 auto" }}>
              <div className="section-header">
                <div className="mode-toggler">
                  <button className={`mode-btn ${inspectorMode === 'compare' ? 'active' : ''}`} onClick={() => setInspectorMode('compare')}>Similarity</button>
                  <button className={`mode-btn ${inspectorMode === 'inspection' ? 'active' : ''}`} onClick={() => setInspectorMode('inspection')}>Inspection</button>
                </div>
                <h1 style={{ fontSize: "42px", color: "var(--aura-emerald)", marginBottom: "8px" }}>
                  {inspectorMode === "compare" ? "Vehicle Intelligence" : "Structural Analysis"}
                </h1>
                <p style={{ color: "var(--muted)", maxWidth: '500px', lineHeight: 1.6 }}>
                  {inspectorMode === "compare" 
                    ? "Deep-CLIP embeddings for verifying visual consistency across capture sessions."
                    : "Multi-frame AI inspection for automated structural risk assessment."}
                </p>
              </div>

              <div className="glass" style={{
                borderRadius: "32px", padding: "40px", marginBottom: "40px", boxShadow: "var(--shadow-lg)"
              }}>
                <div style={{ display: "flex", gap: "24px", marginBottom: "32px", flexWrap: "wrap" }}>
                  <DropZone label={inspectorMode === "compare" ? "Baseline Video" : "Inspection Media"} file={fileA} onFile={setFileA} disabled={loading} />
                  {inspectorMode === "compare" && (
                    <DropZone label="Reference Video" file={fileB} onFile={setFileB} disabled={loading} />
                  )}
                </div>

                 <button
                    onClick={() => {
                      if (!fileA) return;
                      const isVideo = fileA.name && fileA.name.match(/\.(mp4|mov|mkv|avi)$/i);
                      if (inspectorMode === "compare") {
                        handleCompare();
                      } else {
                        if (isVideo || (fileA.type && fileA.type.startsWith("video/"))) {
                          handleDeepInspection();
                        } else {
                          handleAnalyze();
                        }
                      }
                    }}
                    disabled={!fileA || (inspectorMode === "compare" && !fileB) || loading}
                    className="aura-btn aura-btn-primary"
                    style={{ width: '100%', padding: '20px', fontSize: '16px', letterSpacing: '0.02em' }}
                  >
                    {loading ? "AI Processing..." : inspectorMode === "compare" ? "Start Similarity Check" : "Launch AI Inspection"}
                  </button>
              </div>

              {error && <div style={{ padding: '20px', background: '#fef2f2', color: '#b91c1c', borderRadius: '16px', border: '1.5px solid #fee2e2', marginBottom: '24px' }}>⚠ {error}</div>}
              
              {loading && activeInspectionId && progress && (
                 <div className="fade-up glass" style={{ padding: '32px', borderRadius: '24px', marginBottom: '24px' }}>
                    <div className="flex justify-between items-center mb-6">
                       <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--aura-emerald)', letterSpacing: '0.1em' }}>NEURAL ANALYSIS IN PROGRESS</span>
                       <span className="mono" style={{ fontSize: '14px', color: 'var(--aura-emerald)' }}>{Math.round((progress.frames_analyzed / (progress.frames_total || 1)) * 100)}%</span>
                    </div>
                    <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden', marginBottom: '24px' }}>
                       <div 
                          className="h-full bg-emerald-500 transition-all duration-500" 
                          style={{ width: `${(progress.frames_analyzed / (progress.frames_total || 1)) * 100}%`, background: 'var(--aura-emerald)', height: '100%' }}
                       />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                       <div className="glass" style={{ padding: '16px', borderRadius: '16px' }}>
                          <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Extracted</div>
                          <div style={{ fontSize: '18px', fontWeight: '700' }}>{progress.frames_extracted} / {progress.frames_total}</div>
                       </div>
                       <div className="glass" style={{ padding: '16px', borderRadius: '16px' }}>
                          <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>AI Scanned</div>
                          <div style={{ fontSize: '18px', fontWeight: '700' }}>{progress.frames_analyzed}</div>
                       </div>
                    </div>
                 </div>
              )}

              {loading && !activeInspectionId && <Skeleton />}
              {result && !loading && <ResultCard result={result} />}
            </div>
          )}
        </section>

        <HistorySidebar history={history} onSelect={setResult} onClear={handleClearHistory} />
      </div>
    </div>
  );
}
