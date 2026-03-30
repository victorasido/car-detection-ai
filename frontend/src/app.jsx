import React, { useState, useEffect } from "react";
import Header from "./components/Header";
import DropZone from "./components/DropZone";
import ResultCard from "./components/ResultCard";
import HistorySidebar from "./components/HistorySidebar";
import Skeleton from "./components/Skeleton";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() {
  const [fileA, setFileA]        = useState(null);
  const [fileB, setFileB]        = useState(null);
  const [loading, setLoading]    = useState(false);
  const [result, setResult]      = useState(null);
  const [error, setError]        = useState(null);
  const [history, setHistory]    = useState([]);

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem("vehicle_sim_history");
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  // Save history on change
  const addToHistory = (newData) => {
    const item = { ...newData, timestamp: new Date().toISOString() };
    const updated = [item, ...history].slice(0, 10); // Keep last 10
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

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header />

      <div style={{ display: "flex", flex: 1 }}>
        <main style={{ flex: 1, padding: "48px 24px 80px" }}>
          <div style={{ maxWidth: "760px", margin: "0 auto" }}>
            
            {/* Title */}
            <div className="fade-up" style={{ marginBottom: "40px" }}>
              <h1 style={{
                fontSize: "28px",
                fontWeight: 800,
                letterSpacing: "-0.04em",
                color: "var(--fg)",
                marginBottom: "8px",
              }}>
                Vehicle Similarity AI
              </h1>
              <p style={{
                fontSize: "14px",
                color: "var(--muted)",
                lineHeight: 1.6,
              }}>
                Upload two vehicle videos to compare their visual similarity using CLIP embeddings and GPT-4o-mini analysis.
              </p>
            </div>

            {/* Upload section */}
            <div className="fade-up" style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              padding: "24px",
              marginBottom: "20px",
              boxShadow: "var(--shadow-sm)",
            }}>
              <div style={{ display: "flex", gap: "16px", marginBottom: "20px", flexWrap: "wrap" }}>
                <DropZone label="Video A" file={fileA} onFile={setFileA} disabled={loading} />
                <DropZone label="Video B" file={fileB} onFile={setFileB} disabled={loading} />
              </div>

              <button
                onClick={handleCompare}
                disabled={!(fileA && fileB) || loading}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: (fileA && fileB && !loading) ? "var(--fg)" : "var(--border)",
                  color: (fileA && fileB && !loading) ? "#fff" : "var(--muted)",
                  border: "none",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: (fileA && fileB && !loading) ? "pointer" : "not-allowed",
                  transition: "all 0.15s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  letterSpacing: "0.01em",
                }}
              >
                {loading ? (
                  <>
                    <div style={{
                      width: "14px", height: "14px",
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                      animation: "spin 0.7s linear infinite",
                    }} />
                    Analyzing...
                  </>
                ) : (
                  "Compare Videos"
                )}
              </button>
            </div>

            {/* Loading / Result / Error */}
            {error && (
              <div className="fade-up" style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "10px",
                padding: "14px 16px",
                marginBottom: "20px",
                fontSize: "13px",
                color: "#dc2626",
              }}>
                ⚠ {error}
              </div>
            )}

            {loading && <Skeleton />}
            {result && !loading && <ResultCard result={result} />}
          </div>
        </main>

        <HistorySidebar 
          history={history} 
          onSelect={setResult} 
          onClear={handleClearHistory} 
        />
      </div>
    </div>
  );
}