import React, { useState, useEffect } from "react";
import Header from "./components/Header";
import DropZone from "./components/DropZone";
import ResultCard from "./components/ResultCard";
import HistorySidebar from "./components/HistorySidebar";
import Skeleton from "./components/Skeleton";
import Login from "./components/Login";
import AdminDashboard from "./components/AdminDashboard";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [view, setView] = useState("inspector"); // "inspector" or "reviewer"
  
  const [fileA, setFileA] = useState(null);
  const [fileB, setFileB] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem("vehicle_sim_history");
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const handleLogin = (newToken) => {
    setToken(newToken);
    localStorage.setItem("token", newToken);
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem("token");
  };

  const addToHistory = (newData) => {
    const item = { ...newData, timestamp: new Date().toISOString() };
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
                  <h1 style={{ fontSize: "30px", fontWeight: 800, letterSpacing: "-0.04em" }}>Vehicle Similarity</h1>
                  <p style={{ fontSize: "15px", color: "#6E6E73", lineHeight: 1.6, maxWidth: "480px" }}>
                    Compare vehicle videos securely using AI-powered CLIP embeddings.
                  </p>
                </div>

                <div className="fade-up" style={{
                  background: "#fff", border: "1px solid #E5E5EA", borderRadius: "20px",
                  padding: "24px", marginBottom: "16px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)"
                }}>
                  <div style={{ display: "flex", gap: "16px", marginBottom: "20px", flexWrap: "wrap" }}>
                    <DropZone label="Video A" file={fileA} onFile={setFileA} disabled={loading} />
                    <DropZone label="Video B" file={fileB} onFile={setFileB} disabled={loading} />
                  </div>

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
                </div>

                {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold border border-red-100">⚠ {error}</div>}
                {loading && <Skeleton />}
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