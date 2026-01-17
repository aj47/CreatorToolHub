'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as fabric from 'fabric';

// ============ Types ============
type Tool = 'select' | 'pen' | 'rect' | 'circle' | 'arrow' | 'text' | 'eraser';

interface WhiteboardCanvasProps {
  onExport: (dataUrl: string) => void;
  onClose: () => void;
  initialImage?: string;
  onAddFromVideo?: () => void;
  videoFrameToAdd?: string | null;
  existingVideoUrl?: string | null;
}

interface HistoryState {
  json: string;
}

// ============ Constants ============
const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const DEFAULT_STROKE_COLOR = '#000000';
const DEFAULT_FILL_COLOR = '#ffffff';
const DEFAULT_BRUSH_SIZE = 5;

// ============ Styles ============
const styles = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    flexDirection: 'column' as const,
    zIndex: 9999,
  },
  topToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    backgroundColor: 'var(--nb-card)',
    borderBottom: '3px solid var(--nb-border)',
    flexWrap: 'wrap' as const,
  },
  canvasContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    overflow: 'auto',
  },
  canvasWrapper: {
    border: '3px dashed var(--nb-border)',
    backgroundColor: 'var(--nb-card)',
    boxShadow: '4px 4px 0 var(--nb-border)',
    borderRadius: '10px',
    overflow: 'hidden',
  },
  bottomBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '12px 16px',
    backgroundColor: 'var(--nb-card)',
    borderTop: '3px solid var(--nb-border)',
  },
  button: {
    border: '3px solid var(--nb-border)',
    borderRadius: '8px',
    backgroundColor: 'var(--nb-bg)',
    color: 'var(--nb-fg)',
    padding: '8px 12px',
    fontWeight: 700,
    boxShadow: '4px 4px 0 var(--nb-border)',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  activeButton: {
    backgroundColor: 'var(--nb-accent)',
    color: '#fff',
  },
  accentButton: {
    backgroundColor: 'var(--nb-accent)',
    color: '#fff',
  },
  colorInput: {
    width: '36px',
    height: '36px',
    border: '3px solid var(--nb-border)',
    borderRadius: '8px',
    cursor: 'pointer',
    padding: 0,
  },
  rangeInput: {
    width: '80px',
    cursor: 'pointer',
  },
  separator: {
    width: '2px',
    height: '30px',
    backgroundColor: 'var(--nb-border)',
    margin: '0 4px',
  },
  label: {
    fontSize: '12px',
    fontWeight: 700,
    color: 'var(--nb-fg)',
  },
  hiddenInput: {
    display: 'none',
  },
  buttonGroup: {
    display: 'flex',
    gap: '8px',
  },
};

// ============ Component ============
export default function WhiteboardCanvas({ onExport, onClose, initialImage, onAddFromVideo, videoFrameToAdd, existingVideoUrl }: WhiteboardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [strokeColor, setStrokeColor] = useState(DEFAULT_STROKE_COLOR);
  const [fillColor, setFillColor] = useState(DEFAULT_FILL_COLOR);
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE);
  const [scale, setScale] = useState(1);

  // Video capture state
  const [showVideoCapture, setShowVideoCapture] = useState(false);
  const [internalVideoUrl, setInternalVideoUrl] = useState<string | null>(existingVideoUrl || null);

  // History for undo/redo
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isHistoryAction = useRef(false);

  // Drawing state for shapes
  const isDrawingShape = useRef(false);
  const shapeStartPoint = useRef<{ x: number; y: number } | null>(null);
  const currentShape = useRef<fabric.Object | null>(null);

  // Ref to track current history for use in callbacks (avoids stale closure issues)
  const historyRef = useRef<HistoryState[]>([]);
  const historyIndexRef = useRef(-1);

  // ============ Save History ============
  const saveHistory = useCallback(() => {
    if (isHistoryAction.current || !fabricRef.current) return;
    const json = JSON.stringify(fabricRef.current.toJSON());

    // Use refs to get current values and update them synchronously
    const currentHistory = historyRef.current;
    const currentIndex = historyIndexRef.current;

    // Truncate any redo history and add new state
    const newHistory = currentHistory.slice(0, currentIndex + 1);
    newHistory.push({ json });
    const newIndex = newHistory.length - 1;

    // Update refs synchronously to prevent race conditions
    historyRef.current = newHistory;
    historyIndexRef.current = newIndex;

    // Update state for UI re-renders
    setHistory(newHistory);
    setHistoryIndex(newIndex);
  }, []);

  // ============ Undo ============
  const handleUndo = useCallback(() => {
    const currentIndex = historyIndexRef.current;
    const currentHistory = historyRef.current;
    if (currentIndex <= 0 || !fabricRef.current) return;
    isHistoryAction.current = true;
    const newIndex = currentIndex - 1;
    fabricRef.current.loadFromJSON(JSON.parse(currentHistory[newIndex].json)).then(() => {
      fabricRef.current?.renderAll();
      historyIndexRef.current = newIndex;
      setHistoryIndex(newIndex);
      isHistoryAction.current = false;
    });
  }, []);

  // ============ Redo ============
  const handleRedo = useCallback(() => {
    const currentIndex = historyIndexRef.current;
    const currentHistory = historyRef.current;
    if (currentIndex >= currentHistory.length - 1 || !fabricRef.current) return;
    isHistoryAction.current = true;
    const newIndex = currentIndex + 1;
    fabricRef.current.loadFromJSON(JSON.parse(currentHistory[newIndex].json)).then(() => {
      fabricRef.current?.renderAll();
      historyIndexRef.current = newIndex;
      setHistoryIndex(newIndex);
      isHistoryAction.current = false;
    });
  }, []);

  // ============ Calculate Scale ============
  const calculateScale = useCallback(() => {
    if (!containerRef.current) return 1;
    const containerWidth = containerRef.current.clientWidth - 40;
    const containerHeight = containerRef.current.clientHeight - 40;
    const scaleX = containerWidth / CANVAS_WIDTH;
    const scaleY = containerHeight / CANVAS_HEIGHT;
    return Math.min(scaleX, scaleY, 1);
  }, []);

  // ============ Initialize Canvas ============
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: '#ffffff',
      selection: true,
    });
    fabricRef.current = canvas;

    // Calculate initial scale
    const initialScale = calculateScale();
    setScale(initialScale);

    // Set up events for history
    canvas.on('object:added', () => saveHistory());
    canvas.on('object:modified', () => saveHistory());
    canvas.on('object:removed', () => saveHistory());

    // Load initial image if provided
    if (initialImage) {
      fabric.FabricImage.fromURL(initialImage).then((img) => {
        const imgScale = Math.min(CANVAS_WIDTH / (img.width || 1), CANVAS_HEIGHT / (img.height || 1));
        img.scale(imgScale);
        img.set({
          left: (CANVAS_WIDTH - (img.width || 0) * imgScale) / 2,
          top: (CANVAS_HEIGHT - (img.height || 0) * imgScale) / 2,
        });
        canvas.add(img);
        canvas.renderAll();
        // Note: saveHistory is called by object:added event handler
      });
    } else {
      // Save initial state
      saveHistory();
    }

    // Handle window resize
    const handleResize = () => {
      const newScale = calculateScale();
      setScale(newScale);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.dispose();
    };
  }, []);

  // ============ Handle Video Frame Addition ============
  useEffect(() => {
    if (!videoFrameToAdd || !fabricRef.current) return;

    fabric.FabricImage.fromURL(videoFrameToAdd).then((img) => {
      const imgScale = Math.min(
        (CANVAS_WIDTH * 0.8) / (img.width || 1),
        (CANVAS_HEIGHT * 0.8) / (img.height || 1)
      );
      img.scale(imgScale);
      img.set({
        left: CANVAS_WIDTH / 2 - ((img.width || 0) * imgScale) / 2,
        top: CANVAS_HEIGHT / 2 - ((img.height || 0) * imgScale) / 2,
      });
      fabricRef.current?.add(img);
      fabricRef.current?.setActiveObject(img);
      fabricRef.current?.renderAll();
    });
  }, [videoFrameToAdd]);

  // ============ Handle Clipboard Paste ============
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!fabricRef.current) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (!blob) continue;

          const reader = new FileReader();
          reader.onload = async (event) => {
            const dataUrl = event.target?.result as string;
            const img = await fabric.FabricImage.fromURL(dataUrl);
            const imgScale = Math.min(
              (CANVAS_WIDTH * 0.5) / (img.width || 1),
              (CANVAS_HEIGHT * 0.5) / (img.height || 1)
            );
            img.scale(imgScale);
            img.set({
              left: CANVAS_WIDTH / 2 - ((img.width || 0) * imgScale) / 2,
              top: CANVAS_HEIGHT / 2 - ((img.height || 0) * imgScale) / 2,
            });
            fabricRef.current?.add(img);
            fabricRef.current?.setActiveObject(img);
            fabricRef.current?.renderAll();
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);


  // ============ Tool Change Handler ============
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    // Reset canvas state
    canvas.isDrawingMode = false;
    canvas.selection = true;
    canvas.defaultCursor = 'default';
    canvas.hoverCursor = 'move';

    // Remove existing shape drawing listeners
    canvas.off('mouse:down');
    canvas.off('mouse:move');
    canvas.off('mouse:up');

    switch (activeTool) {
      case 'select':
        // Default selection mode
        break;

      case 'pen':
        canvas.isDrawingMode = true;
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.color = strokeColor;
        canvas.freeDrawingBrush.width = brushSize;
        break;

      case 'eraser':
        canvas.isDrawingMode = true;
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.color = '#ffffff';
        canvas.freeDrawingBrush.width = brushSize * 3;
        break;

      case 'rect':
      case 'circle':
      case 'arrow':
        canvas.selection = false;
        canvas.defaultCursor = 'crosshair';
        setupShapeDrawing(canvas);
        break;

      case 'text':
        canvas.selection = false;
        canvas.defaultCursor = 'text';
        setupTextTool(canvas);
        break;
    }

    canvas.renderAll();
  }, [activeTool, strokeColor, fillColor, brushSize]);

  // ============ Shape Drawing Setup ============
  const setupShapeDrawing = (canvas: fabric.Canvas) => {
    canvas.on('mouse:down', (opt) => {
      const pointer = canvas.getScenePoint(opt.e);
      if (!pointer) return;
      isDrawingShape.current = true;
      shapeStartPoint.current = { x: pointer.x, y: pointer.y };

      // Suppress automatic history save during initial shape creation (0x0 dimensions)
      isHistoryAction.current = true;

      let shape: fabric.Object | null = null;

      if (activeTool === 'rect') {
        shape = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          fill: fillColor,
          stroke: strokeColor,
          strokeWidth: brushSize,
          selectable: false,
        });
      } else if (activeTool === 'circle') {
        shape = new fabric.Ellipse({
          left: pointer.x,
          top: pointer.y,
          rx: 0,
          ry: 0,
          fill: fillColor,
          stroke: strokeColor,
          strokeWidth: brushSize,
          selectable: false,
        });
      } else if (activeTool === 'arrow') {
        shape = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
          stroke: strokeColor,
          strokeWidth: brushSize,
          selectable: false,
        });
      }

      if (shape) {
        currentShape.current = shape;
        canvas.add(shape);
      }

      // Re-enable history after shape is added
      isHistoryAction.current = false;
    });

    canvas.on('mouse:move', (opt) => {
      const pointer = canvas.getScenePoint(opt.e);
      if (!isDrawingShape.current || !shapeStartPoint.current || !currentShape.current || !pointer) return;

      const startX = shapeStartPoint.current.x;
      const startY = shapeStartPoint.current.y;
      const currentX = pointer.x;
      const currentY = pointer.y;

      if (activeTool === 'rect') {
        const rect = currentShape.current as fabric.Rect;
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);
        rect.set({
          left: Math.min(startX, currentX),
          top: Math.min(startY, currentY),
          width,
          height,
        });
      } else if (activeTool === 'circle') {
        const ellipse = currentShape.current as fabric.Ellipse;
        const rx = Math.abs(currentX - startX) / 2;
        const ry = Math.abs(currentY - startY) / 2;
        ellipse.set({
          left: Math.min(startX, currentX),
          top: Math.min(startY, currentY),
          rx,
          ry,
        });
      } else if (activeTool === 'arrow') {
        const line = currentShape.current as fabric.Line;
        line.set({ x2: currentX, y2: currentY });
      }

      canvas.renderAll();
    });

    canvas.on('mouse:up', () => {
      if (isDrawingShape.current && currentShape.current) {
        currentShape.current.set({ selectable: true });

        // Suppress history during arrow group creation
        isHistoryAction.current = true;

        // Add arrowhead for arrow tool
        if (activeTool === 'arrow' && shapeStartPoint.current) {
          const line = currentShape.current as fabric.Line;
          const x1 = line.x1 || 0;
          const y1 = line.y1 || 0;
          const x2 = line.x2 || 0;
          const y2 = line.y2 || 0;

          const angle = Math.atan2(y2 - y1, x2 - x1);
          const headLength = 15;

          const arrowHead = new fabric.Triangle({
            left: x2,
            top: y2,
            width: headLength,
            height: headLength,
            fill: strokeColor,
            angle: (angle * 180 / Math.PI) + 90,
            originX: 'center',
            originY: 'center',
            selectable: false,
          });

          const group = new fabric.Group([line, arrowHead], {
            selectable: true,
          });

          canvas.remove(currentShape.current);
          canvas.add(group);
        }

        // Re-enable history and save the final shape state
        isHistoryAction.current = false;
        saveHistory();

        canvas.renderAll();
      }
      isDrawingShape.current = false;
      shapeStartPoint.current = null;
      currentShape.current = null;
    });
  };

  // ============ Text Tool Setup ============
  const setupTextTool = (canvas: fabric.Canvas) => {
    canvas.on('mouse:down', (opt) => {
      const pointer = canvas.getScenePoint(opt.e);
      if (!pointer) return;

      const text = new fabric.IText('Type here', {
        left: pointer.x,
        top: pointer.y,
        fontSize: 24,
        fill: strokeColor,
        fontFamily: 'Arial',
        editable: true,
      });

      canvas.add(text);
      canvas.setActiveObject(text);
      text.enterEditing();
      canvas.renderAll();

      // Switch back to select mode after adding text
      setActiveTool('select');
    });
  };

  // ============ Import Image ============
  const handleImportImage = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fabricRef.current) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      const img = await fabric.FabricImage.fromURL(dataUrl);
      const imgScale = Math.min(
        (CANVAS_WIDTH * 0.5) / (img.width || 1),
        (CANVAS_HEIGHT * 0.5) / (img.height || 1)
      );
      img.scale(imgScale);
      img.set({
        left: CANVAS_WIDTH / 2 - ((img.width || 0) * imgScale) / 2,
        top: CANVAS_HEIGHT / 2 - ((img.height || 0) * imgScale) / 2,
      });
      fabricRef.current?.add(img);
      fabricRef.current?.setActiveObject(img);
      fabricRef.current?.renderAll();
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // ============ Export Canvas ============
  const handleExport = useCallback(() => {
    if (!fabricRef.current) return;

    // Export at full resolution
    const dataUrl = fabricRef.current.toDataURL({
      format: 'png',
      multiplier: 1,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
    });

    onExport(dataUrl);
  }, [onExport]);

  // ============ Delete Selected ============
  const handleDelete = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const activeObjects = canvas.getActiveObjects();
    activeObjects.forEach(obj => canvas.remove(obj));
    canvas.discardActiveObject();
    canvas.renderAll();
  }, []);

  // ============ Keyboard Shortcuts ============
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept shortcuts if editing text (allow native text undo/redo)
      const activeObj = fabricRef.current?.getActiveObject();
      const isEditingText = activeObj && activeObj.type === 'i-text' && (activeObj as fabric.IText).isEditing;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Don't delete if editing text
        if (isEditingText) {
          return;
        }
        handleDelete();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        // Don't intercept undo/redo if editing text (allow native text undo)
        if (isEditingText) {
          return;
        }
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDelete, handleUndo, handleRedo]);

  // Track blob URLs we've created for proper cleanup
  const createdBlobUrlsRef = useRef<Set<string>>(new Set());

  // ============ Video Handling ============
  const handleVideoFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Revoke old blob URL if it was one we created
    if (internalVideoUrl && createdBlobUrlsRef.current.has(internalVideoUrl)) {
      URL.revokeObjectURL(internalVideoUrl);
      createdBlobUrlsRef.current.delete(internalVideoUrl);
    }

    const url = URL.createObjectURL(file);
    createdBlobUrlsRef.current.add(url);
    setInternalVideoUrl(url);
    setShowVideoCapture(true);

    // Reset input
    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }
  }, [internalVideoUrl]);

  const handleCaptureVideoFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !fabricRef.current) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth || 1280;
    tempCanvas.height = video.videoHeight || 720;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const dataUrl = tempCanvas.toDataURL('image/png');

    // Add to fabric canvas
    fabric.FabricImage.fromURL(dataUrl).then((img) => {
      const canvas = fabricRef.current;
      if (!canvas || !img) return;

      // Scale to fit canvas
      const maxWidth = CANVAS_WIDTH * 0.8;
      const maxHeight = CANVAS_HEIGHT * 0.8;
      const scaleX = maxWidth / (img.width || 1);
      const scaleY = maxHeight / (img.height || 1);
      const scale = Math.min(scaleX, scaleY, 1);

      img.set({
        left: CANVAS_WIDTH / 2,
        top: CANVAS_HEIGHT / 2,
        originX: 'center',
        originY: 'center',
        scaleX: scale,
        scaleY: scale,
      });

      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
      // Note: saveHistory is called by object:added event handler
    });

    setShowVideoCapture(false);
  }, []);

  const handleAddFromVideoClick = useCallback(() => {
    if (internalVideoUrl || existingVideoUrl) {
      // We have a video URL, show capture modal
      setShowVideoCapture(true);
    } else if (onAddFromVideo) {
      // Use external handler if provided
      onAddFromVideo();
    } else {
      // No video loaded, prompt to select one
      videoInputRef.current?.click();
    }
  }, [internalVideoUrl, existingVideoUrl, onAddFromVideo]);

  // Cleanup all created blob URLs on unmount
  useEffect(() => {
    const blobUrls = createdBlobUrlsRef.current;
    return () => {
      blobUrls.forEach(url => {
        URL.revokeObjectURL(url);
      });
      blobUrls.clear();
    };
  }, []);

  // ============ Crop Selected Image ============
  const [cropMode, setCropMode] = useState(false);
  const cropRectRef = useRef<fabric.Rect | null>(null);
  const cropTargetRef = useRef<fabric.FabricImage | null>(null);

  const handleCropImage = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const activeObj = canvas.getActiveObject();
    if (!activeObj || activeObj.type !== 'image') {
      alert('Please select an image to crop');
      return;
    }

    // Create a crop rectangle
    const img = activeObj as fabric.FabricImage;

    // Use getBoundingRect to get the actual visual bounds regardless of origin setting
    const boundingRect = img.getBoundingRect();
    const imgLeft = boundingRect.left;
    const imgTop = boundingRect.top;
    const imgWidth = boundingRect.width;
    const imgHeight = boundingRect.height;

    const cropRect = new fabric.Rect({
      left: imgLeft + imgWidth * 0.1,
      top: imgTop + imgHeight * 0.1,
      width: imgWidth * 0.8,
      height: imgHeight * 0.8,
      fill: 'rgba(255,0,0,0.1)',
      stroke: '#ff0000',
      strokeWidth: 2,
      strokeDashArray: [5, 5],
      selectable: true,
      hasControls: true,
      lockRotation: true,
    });

    cropRectRef.current = cropRect;
    cropTargetRef.current = img;
    setCropMode(true);

    canvas.add(cropRect);
    canvas.setActiveObject(cropRect);
    canvas.renderAll();
  }, []);

  const handleApplyCrop = useCallback(() => {
    const canvas = fabricRef.current;
    const cropRect = cropRectRef.current;
    const img = cropTargetRef.current;

    if (!canvas || !cropRect || !img) return;

    // Get crop rectangle bounds (visual position on canvas)
    const rectBounds = cropRect.getBoundingRect();
    const rectLeft = rectBounds.left;
    const rectTop = rectBounds.top;
    const rectWidth = rectBounds.width;
    const rectHeight = rectBounds.height;

    // Get image bounds (visual position on canvas)
    const imgBounds = img.getBoundingRect();
    const imgLeft = imgBounds.left;
    const imgTop = imgBounds.top;
    const imgScaleX = img.scaleX || 1;
    const imgScaleY = img.scaleY || 1;

    // Calculate clip path relative to image's local coordinate system
    // The clip path needs to be in the image's unscaled, local coordinates
    const clipLeft = (rectLeft - imgLeft) / imgScaleX;
    const clipTop = (rectTop - imgTop) / imgScaleY;
    const clipWidth = rectWidth / imgScaleX;
    const clipHeight = rectHeight / imgScaleY;

    // Apply clip path
    img.set({
      clipPath: new fabric.Rect({
        left: clipLeft,
        top: clipTop,
        width: clipWidth,
        height: clipHeight,
        absolutePositioned: false,
      }),
    });

    // Remove crop rectangle
    canvas.remove(cropRect);
    cropRectRef.current = null;
    cropTargetRef.current = null;
    setCropMode(false);

    canvas.setActiveObject(img);
    canvas.renderAll();
    // Note: saveHistory is called by object:modified event handler when clipPath is set
  }, []);

  const handleCancelCrop = useCallback(() => {
    const canvas = fabricRef.current;
    const cropRect = cropRectRef.current;

    if (canvas && cropRect) {
      canvas.remove(cropRect);
    }

    cropRectRef.current = null;
    cropTargetRef.current = null;
    setCropMode(false);
    canvas?.renderAll();
  }, []);

  // ============ Tool Button ============
  const ToolButton = ({ tool, icon, label }: { tool: Tool; icon: string; label: string }) => (
    <button
      type="button"
      style={{
        ...styles.button,
        ...(activeTool === tool ? styles.activeButton : {}),
      }}
      onClick={() => setActiveTool(tool)}
      title={label}
    >
      {icon}
    </button>
  );

  // ============ Render ============
  return (
    <div style={styles.overlay}>
      {/* Top Toolbar */}
      <div style={styles.topToolbar}>
        <ToolButton tool="select" icon="👆" label="Select (V)" />
        <ToolButton tool="pen" icon="✏️" label="Pen/Pencil" />
        <ToolButton tool="eraser" icon="🧹" label="Eraser" />

        <div style={styles.separator} />

        <ToolButton tool="rect" icon="⬜" label="Rectangle" />
        <ToolButton tool="circle" icon="⭕" label="Circle" />
        <ToolButton tool="arrow" icon="➡️" label="Arrow" />
        <ToolButton tool="text" icon="T" label="Text" />

        <div style={styles.separator} />

        {/* Color Pickers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={styles.label}>Stroke:</span>
          <input
            type="color"
            value={strokeColor}
            onChange={(e) => setStrokeColor(e.target.value)}
            style={styles.colorInput}
            title="Stroke Color"
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={styles.label}>Fill:</span>
          <input
            type="color"
            value={fillColor}
            onChange={(e) => setFillColor(e.target.value)}
            style={styles.colorInput}
            title="Fill Color"
          />
        </div>

        <div style={styles.separator} />

        {/* Brush Size */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={styles.label}>Size: {brushSize}</span>
          <input
            type="range"
            min="1"
            max="50"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            style={styles.rangeInput}
          />
        </div>

        <div style={styles.separator} />

        {/* Undo/Redo */}
        <button
          type="button"
          style={{ ...styles.button, opacity: historyIndex <= 0 ? 0.5 : 1 }}
          onClick={handleUndo}
          disabled={historyIndex <= 0}
          title="Undo (Ctrl+Z)"
        >
          ↩️ Undo
        </button>
        <button
          type="button"
          style={{ ...styles.button, opacity: historyIndex >= history.length - 1 ? 0.5 : 1 }}
          onClick={handleRedo}
          disabled={historyIndex >= history.length - 1}
          title="Redo (Ctrl+Shift+Z)"
        >
          ↪️ Redo
        </button>

        <button type="button" style={styles.button} onClick={handleDelete} title="Delete Selected">
          🗑️ Delete
        </button>

        {cropMode ? (
          <>
            <button
              type="button"
              style={{ ...styles.button, background: '#22c55e', color: '#fff' }}
              onClick={handleApplyCrop}
              title="Apply Crop"
            >
              ✅ Apply Crop
            </button>
            <button
              type="button"
              style={{ ...styles.button, background: '#ef4444', color: '#fff' }}
              onClick={handleCancelCrop}
              title="Cancel Crop"
            >
              ❌ Cancel
            </button>
          </>
        ) : (
          <button type="button" style={styles.button} onClick={handleCropImage} title="Crop Selected Image">
            ✂️ Crop
          </button>
        )}
      </div>

      {/* Canvas Container */}
      <div ref={containerRef} style={styles.canvasContainer}>
        <div
          style={{
            ...styles.canvasWrapper,
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
          }}
        >
          <canvas ref={canvasRef} />
        </div>
      </div>

      {/* Bottom Bar */}
      <div style={styles.bottomBar}>
        <div style={styles.buttonGroup}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImportImage}
            style={styles.hiddenInput}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            onChange={handleVideoFileSelect}
            style={styles.hiddenInput}
          />
          <button
            type="button"
            style={styles.button}
            onClick={() => fileInputRef.current?.click()}
          >
            📁 Import Image
          </button>
          <button
            type="button"
            style={styles.button}
            onClick={handleAddFromVideoClick}
            title={internalVideoUrl || existingVideoUrl ? "Capture frame from loaded video" : "Select a video to capture frames"}
          >
            🎬 {internalVideoUrl || existingVideoUrl ? 'Capture Frame' : 'Add Video'}
          </button>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--nb-fg)' }}>
          {CANVAS_WIDTH} × {CANVAS_HEIGHT} | Scale: {Math.round(scale * 100)}%
        </div>

        <div style={styles.buttonGroup}>
          <button type="button" style={styles.button} onClick={onClose}>
            ❌ Cancel
          </button>
          <button
            type="button"
            style={{ ...styles.button, ...styles.accentButton }}
            onClick={handleExport}
          >
            ✅ Export & Close
          </button>
        </div>
      </div>

      {/* Video Capture Modal */}
      {showVideoCapture && (internalVideoUrl || existingVideoUrl) && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.9)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: 20,
        }}>
          <div style={{
            background: '#fff',
            color: '#111',
            padding: 20,
            borderRadius: 10,
            border: '3px solid var(--nb-border)',
            boxShadow: '8px 8px 0 var(--nb-border)',
            maxWidth: '90vw',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>📹 Capture Frame from Video</div>
            <p style={{ margin: 0, fontSize: 14, color: '#666' }}>
              Scrub to find the perfect moment, then click &quot;Capture Frame&quot;
            </p>
            <video
              ref={videoRef}
              src={internalVideoUrl || existingVideoUrl || undefined}
              controls
              style={{ maxWidth: '100%', maxHeight: '50vh', background: '#000', borderRadius: 8 }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '2px solid var(--nb-border)',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                📂 Load Different Video
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowVideoCapture(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: '2px solid var(--nb-border)',
                    background: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCaptureVideoFrame}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: '2px solid var(--nb-border)',
                    background: 'var(--nb-accent)',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  📸 Capture Frame
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
