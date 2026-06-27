import React, { useState, useRef, useEffect } from 'react';
import { oklchToSrgb255, rgb255ToHex } from './oklch';
import './App.css';

type Axis = 'l' | 'c' | 'h';

function App() {
  const [fixedAxis, setFixedAxis] = useState<Axis>('l');
  const [fixedValue, setFixedValue] = useState<number>(0.7);
  const [hoveredHex, setHoveredHex] = useState<string | null>(null);
  const [selectedHex, setSelectedHex] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<{ x: number, y: number }>({ x: 150, y: 150 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const validGridRef = useRef<Uint8Array>(new Uint8Array(300 * 300));
  const imageDataRef = useRef<ImageData | null>(null);

  const getRanges = () => {
    switch (fixedAxis) {
      case 'l':
        return { x: { min: 0, max: 0.4 }, y: { min: 360, max: 0 }, f: { min: 0, max: 1, step: 0.01, label: 'L' } };
      case 'c':
        return { x: { min: 0, max: 360 }, y: { min: 1, max: 0 }, f: { min: 0, max: 0.4, step: 0.01, label: 'C' } };
      case 'h':
        return { x: { min: 0, max: 0.4 }, y: { min: 1, max: 0 }, f: { min: 0, max: 360, step: 1, label: 'H' } };
    }
  };

  const ranges = getRanges();

  // Draw overlay (the marker) efficiently without recalculating pixels
  const drawOverlay = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageDataRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.putImageData(imageDataRef.current, 0, 0);

    if (selectedPoint) {
      ctx.beginPath();
      ctx.arc(selectedPoint.x, selectedPoint.y, 5, 0, 2 * Math.PI);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(selectedPoint.x, selectedPoint.y, 6, 0, 2 * Math.PI);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  };

  // Redraw marker whenever selectedPoint changes
  useEffect(() => {
    requestAnimationFrame(drawOverlay);
  }, [selectedPoint]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = 300;
      const height = 300;
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;

      const imageData = ctx.createImageData(width, height);
      const data = imageData.data;
      const validGrid = validGridRef.current;

      const xRange = ranges.x.max - ranges.x.min;
      const yRange = ranges.y.max - ranges.y.min;
      const xMin = ranges.x.min;
      const yMin = ranges.y.min;
      const inv299 = 1 / 299;

      for (let py = 0; py < height; py++) {
        const yVal = yMin + (py * inv299) * yRange;
        for (let px = 0; px < width; px++) {
          const xVal = xMin + (px * inv299) * xRange;
          
          let l: number, c: number, h: number;
          if (fixedAxis === 'l') { l = fixedValue; c = xVal; h = yVal; }
          else if (fixedAxis === 'c') { c = fixedValue; h = xVal; l = yVal; }
          else { h = fixedValue; c = xVal; l = yVal; }

          const index = (py * width + px) * 4;
          const rgb = oklchToSrgb255(l!, c!, h!);

          if (rgb) {
            data[index] = rgb[0];
            data[index + 1] = rgb[1];
            data[index + 2] = rgb[2];
            validGrid[py * width + px] = 1;
          } else {
            data[index] = 255;
            data[index + 1] = 255;
            data[index + 2] = 255;
            validGrid[py * width + px] = 0;
          }
          data[index + 3] = 255;
        }
      }
      
      imageDataRef.current = imageData;

      setSelectedPoint((prev) => {
        const pt = prev || { x: 150, y: 150 };
        const validPt = findClosestValidCoords(pt.x, pt.y);
        if (validPt) {
          const hex = getHexFromCoords(validPt);
          setSelectedHex(hex);
          return validPt;
        }
        setSelectedHex(null);
        return pt;
      });
    }, 10);
    return () => clearTimeout(timer);
  }, [fixedAxis, fixedValue]);

  const findClosestValidCoords = (startX: number, startY: number) => {
    const width = 300;
    const height = 300;
    const x = Math.min(width - 1, Math.max(0, Math.round(startX)));
    const y = Math.min(height - 1, Math.max(0, Math.round(startY)));
    
    const validGrid = validGridRef.current;
    
    if (validGrid[y * width + x] === 1) {
      return { x, y };
    }
    
    let bestX = x;
    let bestY = y;
    let minDistanceSq = Infinity;
    
    const maxRadius = Math.max(x, width - x, y, height - y);
    for (let r = 1; r <= maxRadius; r++) {
      if (r * r >= minDistanceSq) {
        break;
      }
      for (let dx = -r; dx <= r; dx++) {
        const px = x + dx;
        if (px >= 0 && px < width) {
          const pyTop = y - r;
          if (pyTop >= 0 && validGrid[pyTop * width + px] === 1) {
            const distSq = dx * dx + r * r;
            if (distSq < minDistanceSq) { minDistanceSq = distSq; bestX = px; bestY = pyTop; }
          }
          const pyBottom = y + r;
          if (pyBottom < height && validGrid[pyBottom * width + px] === 1) {
            const distSq = dx * dx + r * r;
            if (distSq < minDistanceSq) { minDistanceSq = distSq; bestX = px; bestY = pyBottom; }
          }
        }
      }
      for (let dy = -r + 1; dy <= r - 1; dy++) {
        const py = y + dy;
        if (py >= 0 && py < height) {
          const pxLeft = x - r;
          if (pxLeft >= 0 && validGrid[py * width + pxLeft] === 1) {
            const distSq = r * r + dy * dy;
            if (distSq < minDistanceSq) { minDistanceSq = distSq; bestX = pxLeft; bestY = py; }
          }
          const pxRight = x + r;
          if (pxRight < width && validGrid[py * width + pxRight] === 1) {
            const distSq = r * r + dy * dy;
            if (distSq < minDistanceSq) { minDistanceSq = distSq; bestX = pxRight; bestY = py; }
          }
        }
      }
    }
    if (minDistanceSq !== Infinity) return { x: bestX, y: bestY };
    return null;
  };

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = 300 / rect.width;
    const scaleY = 300 / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const getHexFromCoords = (coords: { x: number, y: number } | null) => {
    if (!coords) return null;
    const xVal = ranges.x.min + (coords.x / 299) * (ranges.x.max - ranges.x.min);
    const yVal = ranges.y.min + (coords.y / 299) * (ranges.y.max - ranges.y.min);
    let l: number, c: number, h: number;
    if (fixedAxis === 'l') { l = fixedValue; c = xVal; h = yVal; }
    else if (fixedAxis === 'c') { c = fixedValue; h = xVal; l = yVal; }
    else { h = fixedValue; c = xVal; l = yVal; }
    const rgb = oklchToSrgb255(l!, c!, h!);
    if (!rgb) return null;
    return rgb255ToHex(rgb[0], rgb[1], rgb[2]);
  };

  // Unified Pointer Event Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      // Ignored if browser doesn't support or it fails
    }

    const coords = getCanvasCoords(e);
    if (coords) {
      const closest = findClosestValidCoords(coords.x, coords.y);
      if (closest) {
        setSelectedPoint(closest);
        setSelectedHex(getHexFromCoords(closest));
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    if (!coords) return;

    const closest = findClosestValidCoords(coords.x, coords.y);
    
    if (e.buttons === 1) {
      // Dragging (pointer is down)
      if (closest) {
        setSelectedPoint(closest);
        setSelectedHex(getHexFromCoords(closest));
      }
    } else if (e.pointerType === 'mouse') {
      // Hovering with mouse on desktop
      setHoveredHex(getHexFromCoords(closest) || null);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (err) {}
    }
    setHoveredHex(null);
  };

  const handlePointerLeave = () => {
    setHoveredHex(null);
  };

  const handleTopSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newX = parseInt(e.target.value, 10);
    const newPoint = { x: newX, y: selectedPoint.y };
    setSelectedPoint(newPoint);
    setSelectedHex(getHexFromCoords(newPoint));
  };

  const handleLeftSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newY = 299 - parseInt(e.target.value, 10);
    const newPoint = { x: selectedPoint.x, y: newY };
    setSelectedPoint(newPoint);
    setSelectedHex(getHexFromCoords(newPoint));
  };

  const activeHex = hoveredHex || selectedHex || '#ffffff';
  const swatchStyle = activeHex === '#ffffff' ? { background: '#ffffff' } : { backgroundColor: activeHex };

  return (
    <div className="app-container">
      <header className="header">
        <h1 className="title">OKLCH Palette</h1>
      </header>

      <main className="main-content">
        <div className="controls-panel">
          <div className="radio-group">
            <button 
              className={`radio-btn ${fixedAxis === 'l' ? 'active' : ''}`}
              onClick={() => { setFixedAxis('l'); setFixedValue(0.7); }}
            >L (Lightness)</button>
            <button 
              className={`radio-btn ${fixedAxis === 'c' ? 'active' : ''}`}
              onClick={() => { setFixedAxis('c'); setFixedValue(0.15); }}
            >C (Chroma)</button>
            <button 
              className={`radio-btn ${fixedAxis === 'h' ? 'active' : ''}`}
              onClick={() => { setFixedAxis('h'); setFixedValue(180); }}
            >H (Hue)</button>
          </div>

          <div className="slider-container">
            <span className="slider-label">{ranges.f.label}: {fixedValue.toFixed(2)}</span>
            <input
              type="range"
              className="slider"
              min={ranges.f.min}
              max={ranges.f.max}
              step={ranges.f.step}
              value={fixedValue}
              onChange={(e) => setFixedValue(parseFloat(e.target.value))}
            />
          </div>

          <div className="color-preview">
            <div className="preview-swatch" style={swatchStyle}></div>
            <div 
              className="preview-hex"
              onClick={() => selectedHex && navigator.clipboard.writeText(selectedHex)}
            >
              {selectedHex ? selectedHex.toUpperCase() : '------'}
            </div>
          </div>
        </div>

        <div className="map-panel">
          <div className="map-grid">
            <div className="empty-corner"></div>
            <input 
              type="range" 
              className="top-slider" 
              min="0" max="299" 
              value={selectedPoint.x} 
              onChange={handleTopSlider} 
            />
            <input 
              type="range" 
              className="left-slider" 
              min="0" max="299" 
              value={299 - selectedPoint.y} 
              onChange={handleLeftSlider} 
            />
            <div className="canvas-wrapper">
              <canvas
                ref={canvasRef}
                className="color-canvas"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerLeave}
              ></canvas>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
