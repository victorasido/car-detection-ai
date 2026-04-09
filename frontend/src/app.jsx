import React, { useState, useEffect } from "react";
import Header from "./components/Header";
import DropZone from "./components/DropZone";
import ResultCard from "./components/ResultCard";
import HistorySidebar from "./components/HistorySidebar";
import Skeleton from "./components/Skeleton";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() {
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
      const res = await fetch(`${API_BASE}/compare`, { method: "POST", body: form });
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

  const canCompare = fileA && fileB && !loading;

  return (
    <>
      {/* Global styles */}
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background: #F5F5F7;
          font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
          color: #1D1D1F;
          -webkit-font-smoothing: antialiased;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up {
          animation: fadeUp 0.4s ease both;
        }
      `}</style>

      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#F5F5F7" }}>
        <Header />

        <div style={{ display: "flex", flex: 1 }}>
          <main style={{ flex: 1, padding: "48px 32px 80px" }}>
            <div style={{ maxWidth: "720px", margin: "0 auto" }}>

              {/* Page title */}
              <div className="fade-up" style={{ marginBottom: "32px" }}>
                <h1 style={{
                  fontSize: "30px",
                  fontWeight: 800,
                  letterSpacing: "-0.04em",
                  color: "#1D1D1F",
                  marginBottom: "8px",
                  fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
                }}>
                  Vehicle Similarity
                </h1>
                <p style={{
                  fontSize: "15px",
                  color: "#6E6E73",
                  lineHeight: 1.6,
                  maxWidth: "480px",
                }}>
                  Upload two vehicle videos to analyze their visual similarity using AI-powered CLIP embeddings.
                </p>
              </div>

              {/* Upload card */}
              <div className="fade-up" style={{
                background: "#fff",
                border: "1px solid #E5E5EA",
                borderRadius: "20px",
                padding: "24px",
                marginBottom: "16px",
                boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
              }}>
                {/* Drop zones */}
                <div style={{ display: "flex", gap: "16px", marginBottom: "20px", flexWrap: "wrap" }}>
                  <DropZone label="Video A" file={fileA} onFile={setFileA} disabled={loading} />
                  <DropZone label="Video B" file={fileB} onFile={setFileB} disabled={loading} />
                </div>

                {/* Compare button */}
                <button
                  onClick={handleCompare}
                  disabled={!canCompare}
                  style={{
                    width: "100%",
                    padding: "13px",
                    background: canCompare
                      ? "linear-gradient(135deg, #00C853 0%, #00953D 100%)"
                      : "#E5E5EA",
                    color: canCompare ? "#fff" : "#9CA3AF",
                    border: "none",
                    borderRadius: "12px",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: canCompare ? "pointer" : "not-allowed",
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    letterSpacing: "-0.01em",
                    boxShadow: canCompare ? "0 4px 14px rgba(0,200,83,0.3)" : "none",
                    fontFamily: "'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
                  }}
                  onMouseEnter={e => {
                    if (canCompare) e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = "none";
                  }}
                >
                  {loading ? (
                    <>
                      <div style={{
                        width: "16px", height: "16px",
                        border: "2px solid rgba(255,255,255,0.3)",
                        borderTopColor: "#fff",
                        borderRadius: "50%",
                        animation: "spin 0.7s linear infinite",
                      }} />
                      Analyzing videos...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 2L14 8L8 14M2 8H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Compare Videos
                    </>
                  )}
                </button>

                {/* File status hint */}
                {(!fileA || !fileB) && (
                  <div style={{
                    marginTop: "12px",
                    textAlign: "center",
                    fontSize: "12px",
                    color: "#9CA3AF",
                    fontFamily: "ui-monospace, 'SF Mono', monospace",
                  }}>
                    {!fileA && !fileB ? "Upload both videos to continue" :
                      !fileA ? "Upload Video A to continue" :
                        "Upload Video B to continue"}
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="fade-up" style={{
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  borderRadius: "12px",
                  padding: "14px 18px",
                  marginBottom: "16px",
                  fontSize: "13px",
                  color: "#DC2626",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}>
                  <span style={{ fontSize: "16px" }}>⚠</span>
                  {error}
                </div>
              )}

              {/* Loading skeleton */}
              {loading && <Skeleton />}

              {/* Result */}
              {result && !loading && <ResultCard result={result} />}
            </div>
          </main>

          {/* History sidebar */}
          <HistorySidebar
            history={history}
            onSelect={setResult}
            onClear={handleClearHistory}
          />
        </div>
      </div>
    </>
  );
}