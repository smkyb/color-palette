import React, { useState, useRef, useEffect } from 'react';
import { formatHex, displayable } from 'culori';
import './App.css';

type Axis = 'l' | 'c' | 'h';

function App() {
  const [fixedAxis, setFixedAxis] = useState<Axis>('l');
  const [fixedValue, setFixedValue] = useState<number>(0.7);
  const [hoveredHex, setHoveredHex] = useState<string | null>(null);
  const [selectedHex, setSelectedHex] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<{ x: number, y: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const validGridRef = useRef<Uint8Array>(new Uint8Array(300 * 300));

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

  useEffect(() => {
    if (fixedAxis === 'l') setFixedValue(0.7);
    if (fixedAxis === 'c') setFixedValue(0.15);
    if (fixedAxis === 'h') setFixedValue(180);
    setSelectedHex(null);
    setSelectedPoint(null);
    setHoveredHex(null);
  }, [fixedAxis]);

  useEffect(() => {
    setSelectedHex(null);
    setSelectedPoint(null);
  }, [fixedValue]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 300;
    const height = 300;
    canvas.width = width;
    canvas.height = height;

    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    const validGrid = validGridRef.current;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const xVal = ranges.x.min + (x / (width - 1)) * (ranges.x.max - ranges.x.min);
        const yVal = ranges.y.min + (y / (height - 1)) * (ranges.y.max - ranges.y.min);
        
        let l = 0, c = 0, h = 0;
        if (fixedAxis === 'l') { l = fixedValue; c = xVal; h = yVal; }
        else if (fixedAxis === 'c') { c = fixedValue; h = xVal; l = yVal; }
        else { h = fixedValue; c = xVal; l = yVal; }

        let r = 255, g = 255, b = 255, a = 255;
        
        const colorObj = { mode: 'oklch' as const, l, c, h };
        const isValid = displayable(colorObj);
        validGrid[y * width + x] = isValid ? 1 : 0;

        if (isValid) {
          const hex = formatHex(colorObj);
          if (hex) {
             r = parseInt(hex.slice(1, 3), 16);
             g = parseInt(hex.slice(3, 5), 16);
             b = parseInt(hex.slice(5, 7), 16);
          }
        }

        const index = (y * width + x) * 4;
        data[index] = r;
        data[index + 1] = g;
        data[index + 2] = b;
        data[index + 3] = a;
      }
    }
    ctx.putImageData(imageData, 0, 0);

    // Draw simple ring marker
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

  useEffect(() => {
    const timer = setTimeout(drawCanvas, 10);
    return () => clearTimeout(timer);
  }, [fixedAxis, fixedValue, selectedPoint]);

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
            if (distSq < minDistanceSq) {
              minDistanceSq = distSq;
              bestX = px;
              bestY = pyTop;
            }
          }
          const pyBottom = y + r;
          if (pyBottom < height && validGrid[pyBottom * width + px] === 1) {
            const distSq = dx * dx + r * r;
            if (distSq < minDistanceSq) {
              minDistanceSq = distSq;
              bestX = px;
              bestY = pyBottom;
            }
          }
        }
      }
      
      for (let dy = -r + 1; dy <= r - 1; dy++) {
        const py = y + dy;
        if (py >= 0 && py < height) {
          const pxLeft = x - r;
          if (pxLeft >= 0 && validGrid[py * width + pxLeft] === 1) {
            const distSq = r * r + dy * dy;
            if (distSq < minDistanceSq) {
              minDistanceSq = distSq;
              bestX = pxLeft;
              bestY = py;
            }
          }
          const pxRight = x + r;
          if (pxRight < width && validGrid[py * width + pxRight] === 1) {
            const distSq = r * r + dy * dy;
            if (distSq < minDistanceSq) {
              minDistanceSq = distSq;
              bestX = pxRight;
              bestY = py;
            }
          }
        }
      }
    }
    
    if (minDistanceSq !== Infinity) {
      return { x: bestX, y: bestY };
    }
    return null;
  };

  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    let clientX, clientY;
    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    return { x, y };
  };

  const getHexFromCoords = (coords: { x: number, y: number } | null) => {
    if (!coords) return null;
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const xVal = ranges.x.min + (coords.x / (canvas.width - 1)) * (ranges.x.max - ranges.x.min);
    const yVal = ranges.y.min + (coords.y / (canvas.height - 1)) * (ranges.y.max - ranges.y.min);

    let l = 0, c = 0, h = 0;
    if (fixedAxis === 'l') { l = fixedValue; c = xVal; h = yVal; }
    else if (fixedAxis === 'c') { c = fixedValue; h = xVal; l = yVal; }
    else { h = fixedValue; c = xVal; l = yVal; }

    const colorObj = { mode: 'oklch' as const, l, c, h };
    return formatHex(colorObj);
  };

  // Interaction handlers
  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    const coords = getCanvasCoords(e);
    if (coords) {
      const closest = findClosestValidCoords(coords.x, coords.y);
      setHoveredHex(getHexFromCoords(closest) || null);
    } else {
      setHoveredHex(null);
    }
  };

  const handleEnd = () => {
    setHoveredHex(null);
  };

  const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
    const coords = getCanvasCoords(e);
    if (coords) {
      const closest = findClosestValidCoords(coords.x, coords.y);
      const hex = getHexFromCoords(closest);
      if (hex && closest) {
        setSelectedHex(hex);
        setSelectedPoint(closest);
      }
    }
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
              onClick={() => setFixedAxis('l')}
            >L (Lightness)</button>
            <button 
              className={`radio-btn ${fixedAxis === 'c' ? 'active' : ''}`}
              onClick={() => setFixedAxis('c')}
            >C (Chroma)</button>
            <button 
              className={`radio-btn ${fixedAxis === 'h' ? 'active' : ''}`}
              onClick={() => setFixedAxis('h')}
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
          <div className="canvas-wrapper">
            <canvas
              ref={canvasRef}
              className="color-canvas"
              onMouseMove={handleMove}
              onMouseLeave={handleEnd}
              onClick={handleClick}
              onTouchMove={handleMove}
              onTouchEnd={handleEnd}
              onTouchStart={handleClick}
            ></canvas>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
