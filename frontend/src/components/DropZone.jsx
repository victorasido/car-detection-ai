import React, { useState, useRef, useCallback } from "react";

export default function DropZone({ label, file, onFile, disabled }) {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("video/")) onFile(f);
  }, [onFile]);

  const previewUrl = file ? URL.createObjectURL(file) : null;

  return (
    <div style={{ flex: 1 }}>
      <div className="mono" style={{
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#9ca3af",
        marginBottom: "8px",
      }}>{label}</div>

      <div
        onClick={() => !disabled && inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          border: `1.5px dashed ${dragging ? "#374151" : file ? "#d1d5db" : "#e5e7eb"}`,
          borderRadius: "12px",
          background: dragging ? "#f9fafb" : "#fff",
          cursor: disabled ? "not-allowed" : "pointer",
          transition: "all 0.15s ease",
          overflow: "hidden",
          aspectRatio: "16/9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {file ? (
          <>
            <video
              src={previewUrl}
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "10px" }}
              muted
              onMouseEnter={e => e.target.play()}
              onMouseLeave={e => { e.target.pause(); e.target.currentTime = 0; }}
            />
            <div className="mono" style={{
              position: "absolute", bottom: 8, left: 8, right: 8,
              background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
              borderRadius: "6px", padding: "4px 8px",
              fontSize: "11px", color: "#fff",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {file.name}
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "24px" }}>
            <div style={{ fontSize: "28px", marginBottom: "8px", opacity: 0.3 }}>▶</div>
            <div style={{ fontSize: "13px", color: "#9ca3af" }}>
              Drop video here or click
            </div>
            <div className="mono" style={{ fontSize: "11px", color: "#d1d5db", marginTop: "4px" }}>
              mp4 · avi · mov · mkv
            </div>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        style={{ display: "none" }}
        onChange={e => e.target.files[0] && onFile(e.target.files[0])}
      />
    </div>
  );
}
