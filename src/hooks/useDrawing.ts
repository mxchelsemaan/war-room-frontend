import { useCallback, useEffect, useRef, useState } from "react";

export type AnnotationType = "pin" | "line" | "arrow" | "area";
export type ArrowStyle = "simple" | "jagged";

export interface Annotation {
  id: string;
  type: AnnotationType;
  label: string;
  showLabel: boolean;
  color: string;
  glow: boolean;
  dash: boolean;
  float: boolean;
  coordinates: [number, number][];
  width: number;
  arrowStyle: ArrowStyle;
}

export const DRAW_COLOR_PRESETS = [
  "#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#e2e8f0",
] as const;

interface DrawingHookResult {
  mode: AnnotationType | null;
  color: string;
  drawWidth: number;
  drawArrowStyle: ArrowStyle;
  tempCoords: [number, number][];
  completed: Annotation | null;
  startDrawing: (m: AnnotationType) => void;
  setColor: (c: string) => void;
  setDrawWidth: (w: number) => void;
  setDrawArrowStyle: (s: ArrowStyle) => void;
  handleClick: (lngLat: [number, number]) => void;
  handleDblClick: (lngLat: [number, number]) => void;
  cancel: () => void;
  clearCompleted: () => void;
}

export function useDrawing(): DrawingHookResult {
  const [mode, setMode] = useState<AnnotationType | null>(null);
  const [color, setColorState] = useState<string>(DRAW_COLOR_PRESETS[0]);
  const [drawWidth, setDrawWidthState] = useState(3);
  const [drawArrowStyle, setDrawArrowStyleState] = useState<ArrowStyle>("simple");
  const [tempCoords, setTempCoords] = useState<[number, number][]>([]);
  const [completed, setCompleted] = useState<Annotation | null>(null);

  const counters = useRef<Record<AnnotationType, number>>({ pin: 0, line: 0, arrow: 0, area: 0 });
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const colorRef = useRef(color);
  colorRef.current = color;
  const drawWidthRef = useRef(drawWidth);
  drawWidthRef.current = drawWidth;
  const drawArrowStyleRef = useRef(drawArrowStyle);
  drawArrowStyleRef.current = drawArrowStyle;
  // Live ref updated synchronously on every click — NOT derived from state.
  // This ensures handleDblClick reads the correct coords even when React
  // batches the preceding click state updates and hasn't re-rendered yet.
  const liveCoordsRef = useRef<[number, number][]>([]);

  const startDrawing = useCallback((m: AnnotationType) => {
    liveCoordsRef.current = [];
    setMode(m);
    setTempCoords([]);
  }, []);

  const setColor = useCallback((c: string) => setColorState(c), []);
  const setDrawWidth = useCallback((w: number) => setDrawWidthState(w), []);
  const setDrawArrowStyle = useCallback((s: ArrowStyle) => setDrawArrowStyleState(s), []);

  const handleClick = useCallback((lngLat: [number, number]) => {
    const m = modeRef.current;
    if (!m) return;

    if (m === "pin") {
      counters.current.pin += 1;
      setCompleted({
        id: crypto.randomUUID(),
        type: "pin",
        label: `Pin ${counters.current.pin}`,
        showLabel: true,
        color: colorRef.current,
        glow: false,
        dash: false,
        float: false,
        coordinates: [lngLat],
        width: drawWidthRef.current,
        arrowStyle: drawArrowStyleRef.current,
      });
      liveCoordsRef.current = [];
      setMode(null);
      setTempCoords([]);
    } else {
      const next: [number, number][] = [...liveCoordsRef.current, lngLat];
      liveCoordsRef.current = next;
      setTempCoords(next);
    }
  }, []);

  const handleDblClick = useCallback((_lngLat: [number, number]) => {
    const m = modeRef.current;
    if (!m || m === "pin") return;

    // Remove the extra vertex added by the second click of the double-click.
    // liveCoordsRef is updated synchronously so it's always current.
    const coords = liveCoordsRef.current.slice(0, -1);

    if ((m === "line" || m === "arrow") && coords.length < 2) return;
    if (m === "area" && coords.length < 3) return;

    const finalCoords = m === "area" ? [...coords, coords[0]] : coords;

    counters.current[m] += 1;
    const typeLabel = m.charAt(0).toUpperCase() + m.slice(1);

    setCompleted({
      id: crypto.randomUUID(),
      type: m,
      label: `${typeLabel} ${counters.current[m]}`,
      showLabel: true,
      color: colorRef.current,
      glow: false,
      dash: false,
      float: false,
      coordinates: finalCoords,
      width: drawWidthRef.current,
      arrowStyle: drawArrowStyleRef.current,
    });
    liveCoordsRef.current = [];
    setMode(null);
    setTempCoords([]);
  }, []);

  const cancel = useCallback(() => {
    liveCoordsRef.current = [];
    setMode(null);
    setTempCoords([]);
  }, []);

  const clearCompleted = useCallback(() => setCompleted(null), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (modeRef.current) cancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancel]);

  return {
    mode, color, drawWidth, drawArrowStyle, tempCoords, completed,
    startDrawing, setColor, setDrawWidth, setDrawArrowStyle,
    handleClick, handleDblClick, cancel, clearCompleted,
  };
}
