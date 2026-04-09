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
    <div style={{ flex: 1, minWidth: 0 }}>
      {/* Label */}
      <div style={{
        fontSize: "11px",
        fontFamily: "ui-monospace, 'SF Mono', monospace",
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#6E6E73",
        marginBottom: "8px",
        display: "flex",
        alignItems: "center",
        gap: "6px",
      }}>
        <div style={{
          width: "16px", height: "16px",
          background: file ? "#00C853" : "#E5E5EA",
          borderRadius: "4px",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background 0.2s ease",
          flexShrink: 0,
        }}>
          {file && (
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        {label}
      </div>

      {/* Drop area */}
      <div
        onClick={() => !disabled && inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={disabled ? undefined : handleDrop}
        style={{
          border: `2px dashed ${dragging ? "#00C853" : file ? "#BBF7D0" : "#E5E5EA"}`,
          borderRadius: "14px",
          background: dragging ? "#F0FDF4" : file ? "#FAFFFE" : "#FAFAFA",
          cursor: disabled ? "not-allowed" : "pointer",
          transition: "all 0.2s ease",
          overflow: "hidden",
          aspectRatio: "16/9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {file ? (
          <>
            <video
              src={previewUrl}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              muted
              onMouseEnter={e => e.target.play()}
              onMouseLeave={e => { e.target.pause(); e.target.currentTime = 0; }}
            />
            {/* Overlay filename */}
            <div style={{
              position: "absolute", bottom: 8, left: 8, right: 8,
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(8px)",
              borderRadius: "8px",
              padding: "5px 10px",
              fontSize: "11px",
              fontFamily: "ui-monospace, 'SF Mono', monospace",
              color: "#fff",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {file.name}
            </div>
            {/* Replace hint */}
            <div style={{
              position: "absolute", top: 8, right: 8,
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(8px)",
              borderRadius: "6px",
              padding: "3px 8px",
              fontSize: "10px",
              color: "rgba(255,255,255,0.8)",
              fontFamily: "ui-monospace, 'SF Mono', monospace",
            }}>
              click to replace
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "24px 16px" }}>
            {/* Upload icon */}
            <div style={{
              width: "44px", height: "44px",
              background: "#F0FDF4",
              border: "1.5px solid #BBF7D0",
              borderRadius: "12px",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 12px",
            }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 13V7M10 7L7.5 9.5M10 7L12.5 9.5" stroke="#00C853" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3.5 14.5C2.12 14.5 1 13.38 1 12C1 10.74 1.93 9.7 3.14 9.52C3.05 9.19 3 8.85 3 8.5C3 6.29 4.79 4.5 7 4.5C7.78 4.5 8.5 4.72 9.1 5.11C9.73 3.58 11.24 2.5 13 2.5C15.49 2.5 17.5 4.51 17.5 7C17.5 7.1 17.5 7.2 17.49 7.3C18.38 7.79 19 8.77 19 9.9C19 11.6 17.6 13 15.9 13" stroke="#00C853" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div style={{ fontSize: "13px", color: "#1D1D1F", fontWeight: 500, marginBottom: "4px" }}>
              Drop video here
            </div>
            <div style={{
              fontSize: "11px",
              color: "#6E6E73",
              fontFamily: "ui-monospace, 'SF Mono', monospace",
            }}>
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