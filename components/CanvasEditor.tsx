import React, { useRef, useEffect, useState, useCallback } from 'react';
import { LightType, Point, Stroke } from '../types';
import { generateRelitImage } from '../services/geminiService';
import { Button } from './Button';
import { 
  Eraser, 
  Upload, 
  Wand2, 
  Zap,
  Minus,
  Sun,
  Lightbulb,
  BoxSelect,
  Moon,
  Palette,
  Layers,
  Eye,
  EyeOff,
  Trash2,
  Images,
  RotateCw,
  ImagePlus
} from 'lucide-react';

interface CanvasEditorProps {
  onImageGenerated: (urls: string[]) => void;
}

interface HistoryItem {
  id: string;
  url: string;
  timestamp: number;
}

export const CanvasEditor: React.FC<CanvasEditorProps> = ({ onImageGenerated }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);     
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);   
  const tempCanvasRef = useRef<HTMLCanvasElement>(null);      
  const cursorRef = useRef<HTMLDivElement>(null);             
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  
  // Tools state
  const [brushSize, setBrushSize] = useState(50);
  const [selectedLight, setSelectedLight] = useState<LightType>(LightType.SPOTLIGHT);
  const [isEraserMode, setIsEraserMode] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  // Viewport State (Zoom/Pan)
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Generation Settings
  const [generationCount, setGenerationCount] = useState<number>(1);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Default colors map
  const defaultColors: Record<LightType, string> = {
    [LightType.SPOTLIGHT]: '#FF3B30', // iOS Red
    [LightType.LINEAR]: '#007AFF', // iOS Blue
    [LightType.NATURAL]: '#34C759', // iOS Green
    [LightType.POINT]: '#FFCC00', // iOS Yellow
    [LightType.RIM]: '#AF52DE', // iOS Purple
    [LightType.SOFTBOX]: '#32ADE6' // iOS Cyan
  };
  const [toolColors, setToolColors] = useState<Record<LightType, string>>(defaultColors);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Performance refs
  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef<Point[]>([]);

  const currentColor = toolColors[selectedLight];

  const handleColorChange = (newColor: string) => {
    if (/^#[0-9A-F]{6}$/i.test(newColor)) {
      setToolColors(prev => ({
        ...prev,
        [selectedLight]: newColor
      }));
    }
  };

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch(e.key.toLowerCase()) {
        case '1': setSelectedLight(LightType.SPOTLIGHT); setIsEraserMode(false); break;
        case '2': setSelectedLight(LightType.LINEAR); setIsEraserMode(false); break;
        case '3': setSelectedLight(LightType.NATURAL); setIsEraserMode(false); break;
        case '4': setSelectedLight(LightType.POINT); setIsEraserMode(false); break;
        case '5': setSelectedLight(LightType.RIM); setIsEraserMode(false); break;
        case '6': setSelectedLight(LightType.SOFTBOX); setIsEraserMode(false); break;
        case '7': 
          if (colorInputRef.current) colorInputRef.current.click(); 
          break;
        case 'e': setIsEraserMode(prev => !prev); break;
        case '[': setBrushSize(prev => Math.max(5, prev - 5)); break;
        case ']': setBrushSize(prev => Math.min(300, prev + 5)); break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- Canvas Setup ---
  useEffect(() => {
    if (image && imageCanvasRef.current && drawingCanvasRef.current && tempCanvasRef.current && containerRef.current) {
      // Reset view on new image load
      setScale(1);
      setPan({ x: 0, y: 0 });

      const setupCanvas = (canvas: HTMLCanvasElement) => {
        canvas.width = image.width;   
        canvas.height = image.height;
        canvas.style.width = `${image.width}px`;
        canvas.style.height = `${image.height}px`;
      };

      setupCanvas(imageCanvasRef.current);
      setupCanvas(drawingCanvasRef.current);
      setupCanvas(tempCanvasRef.current);

      const ctx = imageCanvasRef.current.getContext('2d');
      if (ctx) {
        ctx.drawImage(image, 0, 0);
      }
      
      redrawSavedStrokes();
    }
  }, [image]);

  useEffect(() => {
    redrawSavedStrokes();
  }, [strokes]);

  const redrawSavedStrokes = () => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    strokes.forEach(stroke => {
      if (!stroke.isVisible || stroke.points.length === 0) return;
      ctx.beginPath();
      ctx.lineWidth = stroke.size;
      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color;

      if (stroke.points.length === 1) {
        ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
      }
    });
  };

  const getCanvasPoint = (e: React.MouseEvent | MouseEvent): Point => {
    if (!tempCanvasRef.current) return { x: 0, y: 0 };
    const rect = tempCanvasRef.current.getBoundingClientRect();
    const scaleX = tempCanvasRef.current.width / rect.width;
    const scaleY = tempCanvasRef.current.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const updateCursor = (e: React.MouseEvent) => {
    if (!cursorRef.current || !tempCanvasRef.current) return;
    const rect = tempCanvasRef.current.getBoundingClientRect();
    
    if (
      e.clientX < rect.left || 
      e.clientX > rect.right || 
      e.clientY < rect.top || 
      e.clientY > rect.bottom
    ) {
      cursorRef.current.style.opacity = '0';
      return;
    }

    cursorRef.current.style.opacity = '1';
    cursorRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
    
    const currentZoom = rect.width / tempCanvasRef.current.width;
    const visualSize = brushSize * currentZoom;
    
    cursorRef.current.style.width = `${visualSize}px`;
    cursorRef.current.style.height = `${visualSize}px`;

    if (isEraserMode) {
      cursorRef.current.style.borderColor = '#ffffff';
      cursorRef.current.style.backgroundColor = 'rgba(255, 59, 48, 0.3)';
      cursorRef.current.style.boxShadow = '0 0 10px rgba(255, 59, 48, 0.5)';
    } else {
      cursorRef.current.style.borderColor = currentColor;
      cursorRef.current.style.backgroundColor = `${currentColor}20`;
      cursorRef.current.style.boxShadow = `0 0 15px ${currentColor}`;
    }
  };

  const drawLineOnTemp = (p1: Point, p2: Point) => {
    const ctx = tempCanvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = currentColor;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  };

  const drawPreviewLine = (start: Point, end: Point) => {
    const canvas = tempCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = currentColor;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  };

  const deleteStrokeAt = (point: Point) => {
    const hitThreshold = brushSize / 2;
    const newStrokes = strokes.filter(stroke => {
      if (!stroke.isVisible) return true; 
      for (const p of stroke.points) {
        const dx = p.x - point.x;
        const dy = p.y - point.y;
        if (dx*dx + dy*dy < hitThreshold * hitThreshold) {
          return false; 
        }
      }
      return true;
    });
    setStrokes(newStrokes);
  };

  // --- Mouse Interactions ---
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageLoaded) return;
    
    if (e.button === 1 || e.button === 2) { 
      setIsPanning(true);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (e.button === 0) {
      const point = getCanvasPoint(e);

      if (isEraserMode) {
        deleteStrokeAt(point);
        return; 
      }

      isDrawingRef.current = true;
      currentPointsRef.current = [point];
      
      const ctx = tempCanvasRef.current?.getContext('2d');
      if (ctx) {
         ctx.fillStyle = currentColor;
         ctx.beginPath();
         ctx.arc(point.x, point.y, brushSize / 2, 0, Math.PI * 2);
         ctx.fill();
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageLoaded) return;
    
    if (isPanning) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    updateCursor(e);
    
    const point = getCanvasPoint(e);

    if (isEraserMode && e.buttons === 1) {
      deleteStrokeAt(point);
      return;
    }

    if (!isDrawingRef.current) return;

    if (selectedLight === LightType.LINEAR) {
      const start = currentPointsRef.current[0];
      drawPreviewLine(start, point);
    } else {
      const lastPoint = currentPointsRef.current[currentPointsRef.current.length - 1];
      drawLineOnTemp(lastPoint, point);
      currentPointsRef.current.push(point);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (isEraserMode) return;
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    
    const point = getCanvasPoint(e);
    
    let finalPoints = [...currentPointsRef.current];
    if (selectedLight === LightType.LINEAR) {
      finalPoints = [currentPointsRef.current[0], point];
    } 

    if (finalPoints.length > 0) {
      setStrokes(prev => [...prev, {
        id: Math.random().toString(36).substr(2, 9),
        points: finalPoints,
        type: selectedLight,
        color: currentColor,
        size: brushSize,
        isVisible: true
      }]);
    }

    const ctx = tempCanvasRef.current?.getContext('2d');
    ctx?.clearRect(0, 0, tempCanvasRef.current!.width, tempCanvasRef.current!.height);
    currentPointsRef.current = [];
  };

  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) return;
    e.preventDefault();

    if (e.altKey) {
       setBrushSize(prev => {
        const newSize = prev + (e.deltaY > 0 ? -5 : 5);
        if (cursorRef.current && tempCanvasRef.current) {
           const rect = tempCanvasRef.current.getBoundingClientRect();
           const currentZoom = rect.width / tempCanvasRef.current.width;
           const visualSize = Math.max(5, Math.min(300, newSize)) * currentZoom;
           cursorRef.current.style.width = `${visualSize}px`;
           cursorRef.current.style.height = `${visualSize}px`;
        }
        return Math.max(5, Math.min(300, newSize));
      });
      return;
    }

    const zoomSensitivity = 0.001;
    const delta = -e.deltaY * zoomSensitivity;
    setScale(prev => Math.min(Math.max(0.1, prev + delta), 10)); 
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheel);
      }
    };
  }, [handleWheel]);

  // --- Upload and Drag & Drop ---

  const processFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        const img = new Image();
        img.onload = () => {
          setImage(img);
          setImageLoaded(true);
          setStrokes([]);
          setHistory(prev => [{
            id: Math.random().toString(36).substr(2, 9),
            url: result,
            timestamp: Date.now()
          }, ...prev]);
        };
        img.src = result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleSetBaseImage = (url: string) => {
    const img = new Image();
    img.onload = () => {
      setImage(img);
    };
    img.crossOrigin = "anonymous"; 
    img.src = url;
  };

  const handleDeleteHistory = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const handleGenerate = async () => {
    if (!imageCanvasRef.current || !drawingCanvasRef.current) return;
    setIsGenerating(true);

    try {
      const original = imageCanvasRef.current.toDataURL('image/png');
      const mask = drawingCanvasRef.current.toDataURL('image/png');

      const resultUrls = await generateRelitImage(original, mask, generationCount);
      
      const newHistoryItems = resultUrls.map(url => ({
        id: Math.random().toString(36).substr(2, 9),
        url,
        timestamp: Date.now()
      }));
      
      setHistory(prev => [...newHistoryItems, ...prev]);
      setShowHistory(true);
      onImageGenerated(resultUrls);
    } catch (e) {
      alert("Failed to generate image. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleLayerVisibility = (id: string) => {
    setStrokes(prev => prev.map(s => s.id === id ? { ...s, isVisible: !s.isVisible } : s));
  };

  const deleteLayer = (id: string) => {
    setStrokes(prev => prev.filter(s => s.id !== id));
  };

  const LightButton = ({ type, label, icon, shortcut }: { type: LightType, label: string, icon: React.ReactNode, shortcut: string }) => {
    const isSelected = selectedLight === type && !isEraserMode;
    const toolColor = toolColors[type];
    
    // Glassmorphic active state vs inactive
    const activeClass = "bg-white/20 border-white/30 text-white shadow-lg shadow-white/5 backdrop-blur-xl";
    const inactiveClass = "text-white/60 hover:bg-white/10 hover:text-white border-transparent";
    
    // Dynamic color glow for active state
    const style = isSelected 
      ? { boxShadow: `0 0 15px ${toolColor}40`, borderColor: toolColor, color: toolColor } 
      : {};

    return (
      <div className="flex flex-col items-center">
        <button
          onClick={() => { setSelectedLight(type); setIsEraserMode(false); }}
          style={style}
          className={`relative flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200 ${isSelected ? 'bg-white/10 backdrop-blur-md' : inactiveClass}`}
          title={`${label} (Shortcut: ${shortcut})`}
        >
          {icon}
          <span className="text-sm font-medium hidden md:inline">{label}</span>
          <span className="absolute -top-1.5 -right-1 text-[9px] font-bold text-white/40 bg-black/40 px-1.5 py-0.5 rounded-md border border-white/10 shadow-sm">{shortcut}</span>
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden">
      
      {/* Floating Toolbar - iOS Glass Style */}
      <div className="absolute top-4 left-4 right-4 z-50 flex justify-center pointer-events-none">
        <div className="bg-[#1c1c1e]/70 backdrop-blur-2xl border border-white/10 rounded-full px-4 py-2 flex flex-wrap items-center gap-3 shadow-2xl pointer-events-auto transition-all duration-300 hover:bg-[#1c1c1e]/80">
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            accept="image/png, image/jpeg, image/webp" 
            className="hidden" 
          />
          <Button 
            variant="ghost" 
            onClick={() => fileInputRef.current?.click()}
            className="!p-2 rounded-full hover:bg-white/10 text-white/80"
            title="Upload Image"
          >
            <Upload size={20} />
          </Button>

          <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block" />

          {/* Light Types */}
          <div className="flex items-center gap-1.5">
            <LightButton type={LightType.SPOTLIGHT} label="Spot" icon={<Zap size={18} />} shortcut="1" />
            <LightButton type={LightType.LINEAR} label="Line" icon={<Minus size={18} />} shortcut="2" />
            <LightButton type={LightType.NATURAL} label="Natural" icon={<Sun size={18} />} shortcut="3" />
            <LightButton type={LightType.POINT} label="Point" icon={<Lightbulb size={18} />} shortcut="4" />
            <LightButton type={LightType.RIM} label="Rim" icon={<Moon size={18} />} shortcut="5" />
            <LightButton type={LightType.SOFTBOX} label="Soft" icon={<BoxSelect size={18} />} shortcut="6" />
          </div>

          <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block" />

          {/* Color & Size Group */}
          <div className="flex items-center gap-3">
             {/* Color */}
             <div className="relative group">
                <button 
                   className="flex items-center justify-center w-8 h-8 rounded-full border border-white/20 shadow-inner bg-white/5 hover:scale-105 transition-transform"
                   onClick={() => colorInputRef.current?.click()}
                   style={{ backgroundColor: currentColor }}
                >
                   <span className="absolute -top-1.5 -right-1 text-[9px] font-bold text-white/40 bg-black/40 px-1.5 py-0.5 rounded-md border border-white/10">7</span>
                </button>
                <input 
                  ref={colorInputRef}
                  type="color" 
                  value={currentColor}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="absolute opacity-0 w-0 h-0"
                />
             </div>

             {/* Eraser */}
             <div className="relative">
               <button
                  onClick={() => setIsEraserMode(!isEraserMode)}
                  className={`p-2 rounded-full transition-all ${
                    isEraserMode 
                      ? 'bg-red-500/20 text-red-400 border border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.3)]' 
                      : 'text-white/60 hover:text-white hover:bg-white/10 border border-transparent'
                  }`}
                  title="Eraser (E)"
               >
                 <Eraser size={18} />
               </button>
               <span className="absolute -top-1.5 -right-1 text-[9px] font-bold text-white/40 bg-black/40 px-1.5 py-0.5 rounded-md border border-white/10">E</span>
             </div>
          </div>

          <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block" />
          
          {/* Actions Group */}
          <div className="flex items-center gap-2">
             <button
                onClick={() => { setShowLayers(!showLayers); setShowHistory(false); }}
                className={`p-2 rounded-full transition-all ${
                  showLayers
                    ? 'bg-white/20 text-white' 
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
             >
               <Layers size={20} />
             </button>

             <button
                onClick={() => { setShowHistory(!showHistory); setShowLayers(false); }}
                className={`p-2 rounded-full transition-all relative ${
                  showHistory
                    ? 'bg-white/20 text-white' 
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
             >
               <Images size={20} />
               {history.length > 0 && (
                  <span className="absolute top-0 right-0 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0A84FF] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#0A84FF]"></span>
                  </span>
               )}
             </button>

             <div className="flex items-center bg-black/30 rounded-full p-1 border border-white/5">
               {[1, 2, 3, 4].map(n => (
                 <button
                  key={n}
                  onClick={() => setGenerationCount(n)}
                  className={`w-6 h-6 rounded-full text-xs font-medium transition-all ${
                    generationCount === n 
                    ? 'bg-[#0A84FF] text-white shadow-md' 
                    : 'text-white/40 hover:text-white'
                  }`}
                 >
                   {n}
                 </button>
               ))}
             </div>

             <Button 
               onClick={handleGenerate} 
               disabled={!imageLoaded}
               isLoading={isGenerating}
               icon={<Wand2 size={18} />}
               className="ml-2 !px-4 !py-1.5 rounded-full"
               title="Generate"
             />
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div 
        ref={containerRef}
        className={`relative flex-1 bg-transparent overflow-hidden flex items-center justify-center transition-colors duration-300 ${isDraggingFile ? 'bg-blue-500/10' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Upload State Center UI */}
        {!imageLoaded && (
          <div 
            className={`flex flex-col items-center justify-center h-full w-full pointer-events-none transition-all duration-300 ${isDraggingFile ? 'scale-105 opacity-100' : 'opacity-80'}`}
          >
            <div 
              className="bg-[#1c1c1e]/40 backdrop-blur-xl border border-white/10 p-12 rounded-[3rem] text-center shadow-2xl flex flex-col items-center gap-6 pointer-events-auto cursor-pointer hover:bg-[#1c1c1e]/50 transition-colors group"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-[0_0_30px_rgba(255,255,255,0.05)]">
                <ImagePlus className="w-10 h-10 text-white/70 group-hover:text-[#0A84FF] transition-colors" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-semibold text-white tracking-tight">Upload Image</h3>
                <p className="text-white/50 font-medium">Drag & drop or click to browse</p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <span className="px-2 py-1 rounded-md bg-white/5 text-[10px] font-mono text-white/40 border border-white/5">JPG</span>
                  <span className="px-2 py-1 rounded-md bg-white/5 text-[10px] font-mono text-white/40 border border-white/5">PNG</span>
                  <span className="px-2 py-1 rounded-md bg-white/5 text-[10px] font-mono text-white/40 border border-white/5">WEBP</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Canvas Layers */}
        <div 
          ref={canvasWrapperRef}
          className="relative transition-transform duration-75 ease-out origin-center will-change-transform"
          style={{ 
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            display: imageLoaded ? 'block' : 'none'
          }}
        >
           <canvas
             ref={imageCanvasRef}
             className="absolute top-0 left-0 pointer-events-none shadow-2xl"
           />
           <canvas
             ref={drawingCanvasRef}
             className="absolute top-0 left-0 pointer-events-none mix-blend-screen"
           />
           <canvas
             ref={tempCanvasRef}
             className="absolute top-0 left-0 cursor-crosshair"
           />
        </div>

        {/* Custom Brush Cursor */}
        <div 
          ref={cursorRef}
          className="fixed pointer-events-none rounded-full border-2 z-[60] transition-none opacity-0 mix-blend-screen"
          style={{ top: 0, left: 0 }}
        />
        
        {/* Navigation Hint */}
        {imageLoaded && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[11px] font-medium text-white/30 pointer-events-none bg-black/20 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/5">
             Scroll to Zoom • Middle/Right Click to Pan • [ ] Size
          </div>
        )}
      </div>

      {/* Glass Layers Panel */}
      {showLayers && (
        <div className="absolute right-6 top-24 w-72 bg-[#1c1c1e]/80 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-5 flex flex-col gap-2 max-h-[60%] z-[60] animate-in slide-in-from-right-5 zoom-in-95 duration-200">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
            <h3 className="font-semibold text-white tracking-tight">Layers</h3>
            <span className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded-full">{strokes.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1 custom-scrollbar">
            {strokes.length === 0 && (
              <p className="text-sm text-white/30 text-center py-8">No lights added yet.</p>
            )}
            {[...strokes].reverse().map((stroke) => (
              <div key={stroke.id} className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors group border border-transparent hover:border-white/5">
                <div 
                  className="w-5 h-5 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)] border border-white/10"
                  style={{ backgroundColor: stroke.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/90 font-medium truncate capitalize">
                    {stroke.type.toLowerCase()}
                  </p>
                </div>
                <button 
                  onClick={() => toggleLayerVisibility(stroke.id)}
                  className="text-white/40 hover:text-white transition-colors p-1"
                >
                  {stroke.isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button 
                  onClick={() => deleteLayer(stroke.id)}
                  className="text-white/40 hover:text-red-400 transition-colors p-1 opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Glass History Panel */}
      {showHistory && (
        <div className="absolute right-6 top-24 w-80 bg-[#1c1c1e]/80 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-5 flex flex-col gap-2 max-h-[70%] z-[60] animate-in slide-in-from-right-5 zoom-in-95 duration-200">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
            <h3 className="font-semibold text-white tracking-tight">Gallery</h3>
            <span className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded-full">{history.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-1 custom-scrollbar">
            {history.length === 0 && (
              <div className="text-center py-10">
                 <Images className="w-10 h-10 text-white/10 mx-auto mb-2" />
                 <p className="text-sm text-white/30">Your collection is empty.</p>
              </div>
            )}
            {history.map((item) => (
              <div key={item.id} className="relative group rounded-2xl overflow-hidden border border-white/10 shrink-0 bg-black/40 shadow-lg">
                <img 
                  src={item.url} 
                  alt="Gallery Item" 
                  className="w-full h-auto object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                />
                {/* Glass Overlay actions */}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-3 p-4">
                  <Button 
                    variant="primary" 
                    className="w-full text-xs !py-2 shadow-xl"
                    onClick={() => handleSetBaseImage(item.url)}
                    icon={<RotateCw size={14} />}
                  >
                    Use as Base
                  </Button>
                  <Button 
                    variant="danger" 
                    className="w-full text-xs !py-2 shadow-xl"
                    onClick={() => handleDeleteHistory(item.id)}
                    icon={<Trash2 size={14} />}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};