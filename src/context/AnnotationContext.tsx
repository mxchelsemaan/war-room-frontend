import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useDrawing } from "@/hooks/useDrawing";
import type { Annotation, AnnotationType, ArrowStyle } from "@/hooks/useDrawing";

// ── Drawing context (mode, color, width, style, temp coords, drawing actions) ──

interface DrawingContextValue {
  mode: AnnotationType | null;
  color: string;
  drawWidth: number;
  drawArrowStyle: ArrowStyle;
  drawGlow: boolean;
  drawDash: boolean;
  drawFloat: boolean;
  tempCoords: [number, number][];
  startDrawing: (m: AnnotationType) => void;
  setColor: (c: string) => void;
  setDrawWidth: (w: number) => void;
  setDrawArrowStyle: (s: ArrowStyle) => void;
  setDrawGlow: (v: boolean) => void;
  setDrawDash: (v: boolean) => void;
  setDrawFloat: (v: boolean) => void;
  handleClick: (lngLat: [number, number]) => void;
  handleDblClick: (lngLat: [number, number]) => void;
  cancel: () => void;
}

const DrawingCtx = createContext<DrawingContextValue | null>(null);

export function useDrawingContext() {
  const ctx = useContext(DrawingCtx);
  if (!ctx) throw new Error("useDrawingContext must be used within AnnotationProvider");
  return ctx;
}

// ── Annotation list context (annotations CRUD, selection, reorder) ──

interface AnnotationListContextValue {
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  setSelectedAnnotationId: (id: string | null) => void;
  deleteAnnotation: (id: string) => void;
  renameAnnotation: (id: string, label: string) => void;
  toggleGlow: (id: string) => void;
  toggleDash: (id: string) => void;
  toggleLabel: (id: string) => void;
  toggleAnnotationFloat: (id: string) => void;
  setAnnotationColor: (id: string, color: string) => void;
  setAnnotationWidth: (id: string, width: number) => void;
  reorderAnnotation: (id: string, toIndex: number) => void;
}

const AnnotationListCtx = createContext<AnnotationListContextValue | null>(null);

export function useAnnotationListContext() {
  const ctx = useContext(AnnotationListCtx);
  if (!ctx) throw new Error("useAnnotationListContext must be used within AnnotationProvider");
  return ctx;
}

// ── Combined hook for backwards compatibility ──

export function useAnnotationContext() {
  const drawing = useDrawingContext();
  const list = useAnnotationListContext();
  return useMemo(() => ({ ...drawing, ...list }), [drawing, list]);
}

// ── Provider (wraps both contexts) ──

export function AnnotationProvider({ children }: { children: React.ReactNode }) {
  const drawing = useDrawing();
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);

  // Consume completed annotation from drawing hook
  useEffect(() => {
    if (!drawing.completed) return;
    setAnnotations(prev => [...prev, { ...drawing.completed!, float: false }]);
    drawing.clearCompleted();
  }, [drawing.completed]); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteAnnotation = useCallback((id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
    setSelectedAnnotationId(prev => prev === id ? null : prev);
  }, []);

  const renameAnnotation = useCallback((id: string, label: string) => {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, label } : a));
  }, []);

  const toggleGlow = useCallback((id: string) => {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, glow: !a.glow } : a));
  }, []);

  const toggleDash = useCallback((id: string) => {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, dash: !a.dash } : a));
  }, []);

  const toggleLabel = useCallback((id: string) => {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, showLabel: !a.showLabel } : a));
  }, []);

  const toggleAnnotationFloat = useCallback((id: string) => {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, float: !a.float } : a));
  }, []);

  const setAnnotationColor = useCallback((id: string, color: string) => {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, color } : a));
  }, []);

  const setAnnotationWidth = useCallback((id: string, width: number) => {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, width } : a));
  }, []);

  const reorderAnnotation = useCallback((id: string, toIndex: number) => {
    setAnnotations(prev => {
      const from = prev.findIndex(a => a.id === id);
      if (from === -1) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
  }, []);

  const drawingValue = useMemo<DrawingContextValue>(() => ({
    mode: drawing.mode,
    color: drawing.color,
    drawWidth: drawing.drawWidth,
    drawArrowStyle: drawing.drawArrowStyle,
    drawGlow: drawing.drawGlow,
    drawDash: drawing.drawDash,
    drawFloat: drawing.drawFloat,
    tempCoords: drawing.tempCoords,
    startDrawing: drawing.startDrawing,
    setColor: drawing.setColor,
    setDrawWidth: drawing.setDrawWidth,
    setDrawArrowStyle: drawing.setDrawArrowStyle,
    setDrawGlow: drawing.setDrawGlow,
    setDrawDash: drawing.setDrawDash,
    setDrawFloat: drawing.setDrawFloat,
    handleClick: drawing.handleClick,
    handleDblClick: drawing.handleDblClick,
    cancel: drawing.cancel,
  }), [
    drawing.mode, drawing.color, drawing.drawWidth, drawing.drawArrowStyle,
    drawing.drawGlow, drawing.drawDash, drawing.drawFloat, drawing.tempCoords,
    drawing.startDrawing, drawing.setColor, drawing.setDrawWidth, drawing.setDrawArrowStyle,
    drawing.setDrawGlow, drawing.setDrawDash, drawing.setDrawFloat,
    drawing.handleClick, drawing.handleDblClick, drawing.cancel,
  ]);

  const listValue = useMemo<AnnotationListContextValue>(() => ({
    annotations,
    selectedAnnotationId,
    setSelectedAnnotationId,
    deleteAnnotation,
    renameAnnotation,
    toggleGlow,
    toggleDash,
    toggleLabel,
    toggleAnnotationFloat,
    setAnnotationColor,
    setAnnotationWidth,
    reorderAnnotation,
  }), [
    annotations, selectedAnnotationId,
    deleteAnnotation, renameAnnotation, toggleGlow, toggleDash, toggleLabel,
    toggleAnnotationFloat, setAnnotationColor, setAnnotationWidth, reorderAnnotation,
  ]);

  return (
    <DrawingCtx.Provider value={drawingValue}>
      <AnnotationListCtx.Provider value={listValue}>
        {children}
      </AnnotationListCtx.Provider>
    </DrawingCtx.Provider>
  );
}
