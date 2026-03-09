import { useCallback, useEffect, useRef, useState } from "react";
import { DRAW_COLOR_PRESETS } from "@/config/colors";

// crypto.randomUUID() requires a secure context (HTTPS/localhost).
// Fall back to a Math.random UUID for plain-HTTP deployments.
const uuid = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });

export { DRAW_COLOR_PRESETS };

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
  // Timestamp of last click — used to detect double-clicks without relying on onDblClick.
  const lastClickTimeRef = useRef(0);

  const finishDrawing = useCallback((coords: [number, number][], m: AnnotationType) => {
    if ((m === "line" || m === "arrow") && coords.length < 2) return;
    if (m === "area" && coords.length < 3) return;
    const finalCoords = m === "area" ? [...coords, coords[0]] : coords;
    counters.current[m] += 1;
    const typeLabel = m.charAt(0).toUpperCase() + m.slice(1);
    setCompleted({
      id: uuid(),
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
    setMode(null);
    setTempCoords([]);
  }, []);

  const startDrawing = useCallback((m: AnnotationType) => {
    liveCoordsRef.current = [];
    setMode(m);
    setTempCoords([]);
  }, []);

  const setColor = useCallback((c: string) => setColorState(c), []);
  const setDrawWidth = useCallback((w: number) => setDrawWidthState(w), []);
  const setDrawArrowStyle = useCallback((s: ArrowStyle) => setDrawArrowStyleState(s), []);
  const setDrawGlow = useCallback((v: boolean) => setDrawGlowState(v), []);
  const setDrawDash = useCallback((v: boolean) => setDrawDashState(v), []);
  const setDrawFloat = useCallback((v: boolean) => setDrawFloatState(v), []);

  // click always adds a point — no timers, no debounce.
  // Double-click is detected by timing two rapid successive clicks (< 300 ms),
  // so we never rely on the unreliable onDblClick event from react-map-gl.
  const handleClick = useCallback((lngLat: [number, number]) => {
    const m = modeRef.current;
    if (!m) return;

    if (m === "pin") {
      counters.current.pin += 1;
      setCompleted({
        id: uuid(),
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
      setMode(null);
      setTempCoords([]);
      return;
    }

    const now = Date.now();
    const isDbl = now - lastClickTimeRef.current < 300;
    lastClickTimeRef.current = now;

    if (isDbl) {
      // Second click of a double-click — finish without adding a duplicate point.
      finishDrawing(liveCoordsRef.current, m);
      return;
    }

    const next: [number, number][] = [...liveCoordsRef.current, lngLat];
    liveCoordsRef.current = next;
    setTempCoords(next);
  }, [finishDrawing]);

  // no-op: double-click is now handled entirely in handleClick via timestamp detection.
  // onDblClick on the Map still calls e.preventDefault() to suppress zoom — that stays.
  const handleDblClick = useCallback((_lngLat: [number, number]) => {
    // intentionally empty
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
    mode, color, drawWidth, drawArrowStyle, drawGlow, drawDash, drawFloat, tempCoords, completed,
    startDrawing, setColor, setDrawWidth, setDrawArrowStyle, setDrawGlow, setDrawDash, setDrawFloat,
    handleClick, handleDblClick, cancel, clearCompleted,
  };
}
