import React, { useState, useRef, useEffect } from 'react';
import { formatHex } from 'culori';
import './App.css';

type Axis = 'l' | 'c' | 'h';

function App() {
  const [fixedAxis, setFixedAxis] = useState<Axis>('l');
  const [fixedValue, setFixedValue] = useState<number>(0.7);
  const [hoveredHex, setHoveredHex] = useState<string | null>(null);
  const [selectedHex, setSelectedHex] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Define ranges based on fixed axis
  const getRanges = () => {
    switch (fixedAxis) {
      case 'l':
        return { 
          x: { min: 0, max: 0.4, label: 'Chroma (C)' }, 
          y: { min: 360, max: 0, label: 'Hue (H)' }, 
          f: { min: 0, max: 1, step: 0.01, label: 'Lightness (L)' } 
        };
      case 'c':
        return { 
          x: { min: 0, max: 360, label: 'Hue (H)' }, 
          y: { min: 1, max: 0, label: 'Lightness (L)' }, 
          f: { min: 0, max: 0.4, step: 0.01, label: 'Chroma (C)' } 
        };
      case 'h':
        return { 
          x: { min: 0, max: 0.4, label: 'Chroma (C)' }, 
          y: { min: 1, max: 0, label: 'Lightness (L)' }, 
          f: { min: 0, max: 360, step: 1, label: 'Hue (H)' } 
        };
    }
  };

  const ranges = getRanges();

  // Reset fixed value when axis changes
  useEffect(() => {
    if (fixedAxis === 'l') setFixedValue(0.7);
    if (fixedAxis === 'c') setFixedValue(0.15);
    if (fixedAxis === 'h') setFixedValue(180);
    setSelectedHex(null);
    setHoveredHex(null);
  }, [fixedAxis]);

  // Draw the color map on the canvas
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use 300x300 for decent resolution and rendering speed
    const width = 300;
    const height = 300;
    canvas.width = width;
    canvas.height = height;

    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const xVal = ranges.x.min + (x / (width - 1)) * (ranges.x.max - ranges.x.min);
        const yVal = ranges.y.min + (y / (height - 1)) * (ranges.y.max - ranges.y.min);
        
        let l = 0, c = 0, h = 0;
        if (fixedAxis === 'l') { l = fixedValue; c = xVal; h = yVal; }
        else if (fixedAxis === 'c') { c = fixedValue; h = xVal; l = yVal; }
        else { h = fixedValue; c = xVal; l = yVal; }

        const hex = formatHex({ mode: 'oklch', l, c, h });
        
        let r = 0, g = 0, b = 0, a = 0;
        if (hex) {
           r = parseInt(hex.slice(1, 3), 16);
           g = parseInt(hex.slice(3, 5), 16);
           b = parseInt(hex.slice(5, 7), 16);
           a = 255; // Valid color
        } else {
           // Out of gamut or undefined color space (though culori usually clamps)
           a = 0;
        }

        const index = (y * width + x) * 4;
        data[index] = r;
        data[index + 1] = g;
        data[index + 2] = b;
        data[index + 3] = a;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  };

  useEffect(() => {
    // Small timeout to not block UI thread during slider movement
    const timer = setTimeout(drawCanvas, 10);
    return () => clearTimeout(timer);
  }, [fixedAxis, fixedValue]);

  const getHexFromEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    const xVal = ranges.x.min + (x / (canvas.width - 1)) * (ranges.x.max - ranges.x.min);
    const yVal = ranges.y.min + (y / (canvas.height - 1)) * (ranges.y.max - ranges.y.min);

    let l = 0, c = 0, h = 0;
    if (fixedAxis === 'l') { l = fixedValue; c = xVal; h = yVal; }
    else if (fixedAxis === 'c') { c = fixedValue; h = xVal; l = yVal; }
    else { h = fixedValue; c = xVal; l = yVal; }

    return formatHex({ mode: 'oklch', l, c, h });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setHoveredHex(getHexFromEvent(e) || null);
  };

  const handleCanvasMouseLeave = () => {
    setHoveredHex(null);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const hex = getHexFromEvent(e);
    if (hex) {
      setSelectedHex(hex);
    }
  };

  const activeHex = hoveredHex || selectedHex || '#transparent';
  const swatchStyle = activeHex === '#transparent' ? { background: 'transparent' } : { backgroundColor: activeHex };

  return (
    <div className="app-container">
      <header className="header">
        <h1 className="title">OKLCH Explorer</h1>
        <p className="subtitle">Discover vibrant colors in a perceptually uniform space</p>
      </header>

      <main className="main-content">
        <div className="controls-panel glass-panel">
          <div className="control-group">
            <label className="label">Fixed Dimension</label>
            <div className="radio-group">
              <button 
                className={`radio-btn ${fixedAxis === 'l' ? 'active' : ''}`}
                onClick={() => setFixedAxis('l')}
              >Lightness</button>
              <button 
                className={`radio-btn ${fixedAxis === 'c' ? 'active' : ''}`}
                onClick={() => setFixedAxis('c')}
              >Chroma</button>
              <button 
                className={`radio-btn ${fixedAxis === 'h' ? 'active' : ''}`}
                onClick={() => setFixedAxis('h')}
              >Hue</button>
            </div>
          </div>

          <div className="control-group">
            <label className="label">
              {ranges.f.label}
              <span>{fixedValue.toFixed(2)}</span>
            </label>
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
            <div className="preview-details">
              <div className="preview-label">Selected Color</div>
              <div 
                className="preview-hex"
                onClick={() => {
                  if (selectedHex) {
                    navigator.clipboard.writeText(selectedHex);
                  }
                }}
                title={selectedHex ? "Click to copy" : ""}
              >
                {selectedHex ? selectedHex.toUpperCase() : 'Pick a color'}
              </div>
            </div>
          </div>
        </div>

        <div className="map-panel glass-panel">
          <div className="canvas-wrapper">
            <canvas
              ref={canvasRef}
              className="color-canvas"
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={handleCanvasMouseLeave}
              onClick={handleCanvasClick}
            ></canvas>
            <div className="axis-label x-axis">{ranges.x.label}</div>
            <div className="axis-label y-axis">{ranges.y.label}</div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
