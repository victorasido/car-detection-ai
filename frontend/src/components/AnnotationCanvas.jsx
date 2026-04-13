import React, { useRef, useEffect, useState } from "react";

export default function AnnotationCanvas({ imageUrl, annotations, onSave, onCancel }) {
  const canvasRef = useRef(null);
  const [currentBoxes, setCurrentBoxes] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });
  const [selectedClass, setSelectedClass] = useState("dent");

  const classes = ["dent", "scratch", "crack", "rust", "paint_damage", "broken_glass", "deformation"];

  useEffect(() => {
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      setImageSize({ w: img.width, h: img.height });
      draw();
    };
  }, [imageUrl, currentBoxes]);

  const draw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.src = imageUrl;

    // Reset canvas size to fit image or container
    const containerWidth = canvas.parentElement.clientWidth;
    const scale = containerWidth / img.width;
    canvas.width = containerWidth;
    canvas.height = img.height * scale;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw existing boxes
    currentBoxes.forEach((box, idx) => {
      ctx.strokeStyle = "#10B981";
      ctx.lineWidth = 3;
      ctx.strokeRect(
        box.x1 * scale,
        box.y1 * scale,
        (box.x2 - box.x1) * scale,
        (box.y2 - box.y1) * scale
      );
      ctx.fillStyle = "#10B981";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText(box.class, box.x1 * scale, (box.y1 * scale) - 5);
    });
  };

  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / (rect.width / imageSize.w);
    const y = (e.clientY - rect.top) / (rect.height / imageSize.h);
    setStartPos({ x, y });
    setIsDrawing(true);
  };

  const handleMouseUp = (e) => {
    if (!isDrawing) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / (rect.width / imageSize.w);
    const y = (e.clientY - rect.top) / (rect.height / imageSize.h);
    
    const newBox = {
      class: selectedClass,
      x1: Math.min(startPos.x, x),
      y1: Math.min(startPos.y, y),
      x2: Math.max(startPos.x, x),
      y2: Math.max(startPos.y, y),
    };

    if (Math.abs(newBox.x2 - newBox.x1) > 5 && Math.abs(newBox.y2 - newBox.y1) > 5) {
      setCurrentBoxes([...currentBoxes, newBox]);
    }
    setIsDrawing(false);
  };

  const clearBoxes = () => setCurrentBoxes([]);

  return (
    <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-black tracking-tight text-gray-900">Annotation Tool</h3>
          <p className="text-sm text-gray-500">Draw boxes over detected damages</p>
        </div>
        <div className="flex gap-2">
          <select 
            value={selectedClass} 
            onChange={(e) => setSelectedClass(e.target.value)}
            className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-emerald-500 focus:border-emerald-500 block p-2"
          >
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={clearBoxes} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all">Clear</button>
        </div>
      </div>

      <div className="relative flex-1 bg-gray-900 rounded-2xl overflow-hidden cursor-crosshair group">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          className="w-full h-full object-contain"
        />
        {!imageUrl && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500">
            Select a session to start reviewing
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-3">
        <button 
          onClick={() => onSave(currentBoxes)}
          className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all disabled:opacity-50"
          disabled={currentBoxes.length === 0}
        >
          Approve & Save
        </button>
        <button 
          onClick={onCancel}
          className="px-8 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-gray-200 transition-all"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
