import { useCallback, useEffect, useRef, useState } from "react";
import { DRAW_COLOR_PRESETS } from "@/config/colors";

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
  // Pending single-click: commit point after this fires unless cancelled by a second click.
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The lngLat waiting to be committed by the pending timer.
  const pendingCoordRef = useRef<[number, number] | null>(null);

  const finishDrawing = useCallback((m: AnnotationType) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
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
    setMode(null);
    setTempCoords([]);
  }, []);

  const startDrawing = useCallback((m: AnnotationType) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    pendingCoordRef.current = null;
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
      setMode(null);
      setTempCoords([]);
      return;
    }

    // Timer-debounce double-click detection:
    // If a pending timer exists, this is the second click of a double-click — finish.
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      // Commit the pending point (from click 1 of dblclick) so the last segment is included.
      const pending = pendingCoordRef.current;
      pendingCoordRef.current = null;
      if (pending) {
        liveCoordsRef.current = [...liveCoordsRef.current, pending];
      }
      finishDrawing(m);
      return;
    }

    // First click: wait 300ms before committing the point.
    // If a second click arrives within that window, it cancels this timer (above).
    pendingCoordRef.current = lngLat;
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      pendingCoordRef.current = null;
      if (!modeRef.current) return; // cancelled in the meantime
      const next: [number, number][] = [...liveCoordsRef.current, lngLat];
      liveCoordsRef.current = next;
      setTempCoords(next);
    }, 300);
  }, [finishDrawing]);

  // Fired by MapLibre's native dblclick event — reliable fallback.
  // The timer approach in handleClick already handles most cases, but if MapLibre
  // fires dblclick without two preceding click events, this catches it.
  const handleDblClick = useCallback((_lngLat: [number, number]) => {
    const m = modeRef.current;
    if (!m || m === "pin") return;
    finishDrawing(m);
  }, [finishDrawing]);

  const cancel = useCallback(() => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    pendingCoordRef.current = null;
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
