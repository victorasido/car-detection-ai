import React, { useState } from "react";

export default function ComparisonSlider({ imgA, imgB }) {
  const [sliderPos, setSliderPos] = useState(50);

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.min(Math.max(x, 0), 100));
  };

  return (
    <div 
      onMouseMove={handleMove}
      onTouchMove={(e) => {
        const touch = e.touches[0];
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((touch.clientX - rect.left) / rect.width) * 100;
        setSliderPos(Math.min(max(x, 0), 100));
      }}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16/9",
        borderRadius: "12px",
        overflow: "hidden",
        cursor: "ew-resize",
        background: "#000",
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      }}
    >
      <img 
        src={imgB} 
        alt="Video B" 
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} 
      />
      
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: `${sliderPos}%`,
        height: "100%",
        overflow: "hidden",
        borderRight: "2px solid #fff",
      }}>
        <img 
          src={imgA} 
          alt="Video A" 
          style={{ width: "calc(100% * (100 / " + sliderPos + "))", height: "100%", objectFit: "cover", display: "block" }} 
          // Note: the width math above is tricky without ref. Simple way below:
        />
        <img 
          src={imgA} 
          alt="Video A" 
          style={{ position: "absolute", left: 0, top: 0, width: "760px", maxMaxWidth: "none", height: "100%", objectFit: "cover" }} 
        />
      </div>

      <div style={{
        position: "absolute",
        top: "50%",
        left: `${sliderPos}%`,
        transform: "translate(-50%, -50%)",
        width: "36px",
        height: "36px",
        background: "#fff",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        pointerEvents: "none",
        zIndex: 2,
      }}>
        <div style={{ fontSize: "14px" }}>↔</div>
      </div>
    </div>
  );
}
