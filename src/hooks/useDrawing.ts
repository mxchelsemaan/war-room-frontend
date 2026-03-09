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
  drawGlow: boolean;
  drawDash: boolean;
  drawFloat: boolean;
  tempCoords: [number, number][];
  completed: Annotation | null;
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
  clearCompleted: () => void;
}

export function useDrawing(): DrawingHookResult {
  const [mode, setMode] = useState<AnnotationType | null>(null);
  const [color, setColorState] = useState<string>(DRAW_COLOR_PRESETS[0]);
  const [drawWidth, setDrawWidthState] = useState(3);
  const [drawArrowStyle, setDrawArrowStyleState] = useState<ArrowStyle>("simple");
  const [drawGlow, setDrawGlowState] = useState(false);
  const [drawDash, setDrawDashState] = useState(false);
  const [drawFloat, setDrawFloatState] = useState(false);
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
  const drawGlowRef = useRef(drawGlow);
  drawGlowRef.current = drawGlow;
  const drawDashRef = useRef(drawDash);
  drawDashRef.current = drawDash;
  const drawFloatRef = useRef(drawFloat);
  drawFloatRef.current = drawFloat;
  // Live ref updated synchronously — not derived from React state.
  const liveCoordsRef = useRef<[number, number][]>([]);
  // Track last click time to detect double-clicks in handleClick itself.
  const lastClickMsRef = useRef<number>(0);

  const finishDrawing = useCallback((m: AnnotationType) => {
    const coords = liveCoordsRef.current;
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
      glow: drawGlowRef.current,
      dash: drawDashRef.current,
      float: drawFloatRef.current,
      coordinates: finalCoords,
      width: drawWidthRef.current,
      arrowStyle: drawArrowStyleRef.current,
    });
    liveCoordsRef.current = [];
    lastClickMsRef.current = 0;
    setMode(null);
    setTempCoords([]);
  }, []);

  const startDrawing = useCallback((m: AnnotationType) => {
    liveCoordsRef.current = [];
    lastClickMsRef.current = 0;
    setMode(m);
    setTempCoords([]);
  }, []);

  const setColor = useCallback((c: string) => setColorState(c), []);
  const setDrawWidth = useCallback((w: number) => setDrawWidthState(w), []);
  const setDrawArrowStyle = useCallback((s: ArrowStyle) => setDrawArrowStyleState(s), []);
  const setDrawGlow = useCallback((v: boolean) => setDrawGlowState(v), []);
  const setDrawDash = useCallback((v: boolean) => setDrawDashState(v), []);
  const setDrawFloat = useCallback((v: boolean) => setDrawFloatState(v), []);

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
        glow: drawGlowRef.current,
        dash: false,
        float: false,
        coordinates: [lngLat],
        width: drawWidthRef.current,
        arrowStyle: drawArrowStyleRef.current,
      });
      liveCoordsRef.current = [];
      lastClickMsRef.current = 0;
      setMode(null);
      setTempCoords([]);
      return;
    }

    const now = Date.now();
    const isDbl = (now - lastClickMsRef.current) < 400;

    if (isDbl) {
      // Double-click detected via timing — finish without adding this point.
      finishDrawing(m);
    } else {
      lastClickMsRef.current = now;
      const next: [number, number][] = [...liveCoordsRef.current, lngLat];
      liveCoordsRef.current = next;
      setTempCoords(next);
    }
  }, [finishDrawing]);

  // Fallback: fires when MapLibre emits dblclick without a preceding second click.
  // If handleClick already finished drawing, mode is null and this is a no-op.
  const handleDblClick = useCallback((_lngLat: [number, number]) => {
    const m = modeRef.current;
    if (!m || m === "pin") return;
    finishDrawing(m);
  }, [finishDrawing]);

  const cancel = useCallback(() => {
    liveCoordsRef.current = [];
    lastClickMsRef.current = 0;
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
    mode, color, drawWidth, drawArrowStyle, drawGlow, drawDash, drawFloat, tempCoords, completed,
    startDrawing, setColor, setDrawWidth, setDrawArrowStyle, setDrawGlow, setDrawDash, setDrawFloat,
    handleClick, handleDblClick, cancel, clearCompleted,
  };
}
