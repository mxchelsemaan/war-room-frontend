import { useEffect, useRef, useState } from "react";
import { useMap } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import type { Annotation, AnnotationType, ArrowStyle } from "@/hooks/useDrawing";

function computeCentroid(coords: [number, number][]): [number, number] {
  const n = coords.length;
  return [
    coords.reduce((s, c) => s + c[0], 0) / n,
    coords.reduce((s, c) => s + c[1], 0) / n,
  ];
}

// Returns the arrowhead triangle polygon + the base-center point (body ends here)
function computeArrowhead(
  coords: [number, number][],
  widthScale = 2,
): { polygon: [number, number][]; base: [number, number] } | null {
  if (coords.length < 2) return null;
  const tip  = coords[coords.length - 1];
  const prev = coords[coords.length - 2];
  const dx = tip[0] - prev[0];
  const dy = tip[1] - prev[1];
  const L = Math.sqrt(dx * dx + dy * dy);
  if (L < 1e-10) return null;

  const scale = Math.max(0.4, widthScale / 3);
  const hl = Math.min(Math.max(L * 0.15, 0.003), 0.009) * scale;
  const hw = hl * 0.7;

  const ux = dx / L, uy = dy / L;
  const px = -uy,    py =  ux;

  const bx = tip[0] - ux * hl;
  const by = tip[1] - uy * hl;

  return {
    polygon: [tip, [bx + px * hw, by + py * hw], [bx - px * hw, by - py * hw], tip],
    base: [bx, by],
  };
}

// Broad (jagged-tail) arrow: filled polygon with V-notch tail and pointed head
function computeJaggedArrowPolygon(
  coords: [number, number][],
  halfWidth: number,
): [number, number][] | null {
  const n = coords.length;
  if (n < 2) return null;

  // Per-segment forward directions and left normals
  const segFwd: [number, number][] = [];
  const segNorm: [number, number][] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = coords[i+1][0] - coords[i][0];
    const dy = coords[i+1][1] - coords[i][1];
    const L = Math.sqrt(dx*dx + dy*dy);
    if (L < 1e-12) { segFwd.push([1,0]); segNorm.push([0,1]); continue; }
    segFwd.push([dx/L, dy/L]);
    segNorm.push([-dy/L, dx/L]);
  }

  // Per-vertex miter normals for body vertices (0..n-2)
  const vertNorm: [number, number][] = [];
  for (let i = 0; i < n - 1; i++) {
    if (i === 0) {
      vertNorm.push(segNorm[0]);
    } else {
      let nx = segNorm[i-1][0] + segNorm[i][0];
      let ny = segNorm[i-1][1] + segNorm[i][1];
      const L = Math.sqrt(nx*nx + ny*ny);
      if (L > 1e-10) { nx /= L; ny /= L; }
      vertNorm.push([nx, ny]);
    }
  }

  // Head geometry based on last segment
  const lastFwd = segFwd[n-2];
  const lastNorm = segNorm[n-2];
  const tip = coords[n-1];
  const lastBodyPt = coords[n-2];
  const lastSegLen = Math.sqrt((tip[0]-lastBodyPt[0])**2 + (tip[1]-lastBodyPt[1])**2);

  const headHW = halfWidth * 2.0;
  const hl = Math.min(halfWidth * 4.0, lastSegLen * 0.7);
  const headBase: [number, number] = [tip[0] - lastFwd[0]*hl, tip[1] - lastFwd[1]*hl];
  const headLeft:  [number, number] = [headBase[0] + lastNorm[0]*headHW, headBase[1] + lastNorm[1]*headHW];
  const headRight: [number, number] = [headBase[0] - lastNorm[0]*headHW, headBase[1] - lastNorm[1]*headHW];

  // Body left/right offsets for all body vertices (0..n-2)
  const bodyL: [number, number][] = [];
  const bodyR: [number, number][] = [];
  for (let i = 0; i < n - 1; i++) {
    const [nx, ny] = vertNorm[i];
    bodyL.push([coords[i][0] + nx*halfWidth, coords[i][1] + ny*halfWidth]);
    bodyR.push([coords[i][0] - nx*halfWidth, coords[i][1] - ny*halfWidth]);
  }

  // V-notch at tail: a point pushed forward into the body
  const tailFwd = segFwd[0];
  const notchDepth = halfWidth * 1.5;
  const notchPt: [number, number] = [
    coords[0][0] + tailFwd[0]*notchDepth,
    coords[0][1] + tailFwd[1]*notchDepth,
  ];

  // Build polygon: left side → head → tip → right side reversed → notch → close
  return [
    ...bodyL.slice(0, n-2),
    bodyL[n-2],
    headLeft,
    tip,
    headRight,
    bodyR[n-2],
    ...[...bodyR.slice(0, n-2)].reverse(),
    notchPt,
    bodyL[0],
  ];
}

function buildAnnotationGeoJSON(annotations: Annotation[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const ann of annotations) {
    const shownLabel = ann.showLabel ? ann.label : "";
    const w = ann.width ?? 2;

    const dash = ann.dash ?? false;

    if (ann.type === "line") {
      features.push({
        type: "Feature",
        properties: { id: ann.id, color: ann.color, glow: ann.glow, dash, label: "", annotationType: "line", width: w },
        geometry: { type: "LineString", coordinates: ann.coordinates },
      });
      features.push({
        type: "Feature",
        properties: { id: ann.id, color: ann.color, glow: ann.glow, dash, label: shownLabel, annotationType: "line-label" },
        geometry: { type: "Point", coordinates: computeCentroid(ann.coordinates) },
      });
    } else if (ann.type === "arrow") {
      if (ann.arrowStyle === "jagged") {
        const halfWidth = 0.0025 * w;
        const poly = computeJaggedArrowPolygon(ann.coordinates, halfWidth);
        if (poly) {
          features.push({
            type: "Feature",
            properties: { id: ann.id, color: ann.color, glow: ann.glow, dash, label: "", annotationType: "arrow-jagged" },
            geometry: { type: "Polygon", coordinates: [poly] },
          });
        }
      } else {
        const arrowResult = computeArrowhead(ann.coordinates, w);
        const bodyCoords = arrowResult
          ? [...ann.coordinates.slice(0, -1), arrowResult.base]
          : ann.coordinates;
        features.push({
          type: "Feature",
          properties: { id: ann.id, color: ann.color, glow: ann.glow, dash, label: "", annotationType: "arrow", width: w },
          geometry: { type: "LineString", coordinates: bodyCoords },
        });
        if (arrowResult) {
          features.push({
            type: "Feature",
            properties: { id: ann.id, color: ann.color, glow: ann.glow, dash, label: "", annotationType: "arrow-head" },
            geometry: { type: "Polygon", coordinates: [arrowResult.polygon] },
          });
        }
      }
      features.push({
        type: "Feature",
        properties: { id: ann.id, color: ann.color, glow: ann.glow, dash, label: shownLabel, annotationType: "arrow-label" },
        geometry: { type: "Point", coordinates: computeCentroid(ann.coordinates) },
      });
    } else if (ann.type === "area") {
      features.push({
        type: "Feature",
        properties: { id: ann.id, color: ann.color, glow: ann.glow, dash, label: "", annotationType: "area", width: w },
        geometry: { type: "Polygon", coordinates: [ann.coordinates] },
      });
      features.push({
        type: "Feature",
        properties: { id: ann.id, color: ann.color, glow: ann.glow, dash, label: shownLabel, annotationType: "area-label" },
        geometry: { type: "Point", coordinates: computeCentroid(ann.coordinates) },
      });
    }
  }
  return { type: "FeatureCollection", features };
}

function buildPreviewGeoJSON(
  mode: AnnotationType | null,
  tempCoords: [number, number][],
  cursorCoord: [number, number] | null,
  previewWidth: number,
  previewArrowStyle: ArrowStyle,
  previewColor: string,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  if (!mode || mode === "pin" || tempCoords.length === 0) {
    return { type: "FeatureCollection", features };
  }

  const previewCoords = cursorCoord ? [...tempCoords, cursorCoord] : tempCoords;

  if ((mode === "line" || mode === "arrow") && previewCoords.length >= 2) {
    if (mode === "arrow" && previewArrowStyle === "jagged") {
      const halfWidth = 0.0025 * previewWidth;
      const poly = computeJaggedArrowPolygon(previewCoords, halfWidth);
      if (poly) {
        features.push({
          type: "Feature",
          properties: { previewType: "arrow-jagged-fill", previewColor },
          geometry: { type: "Polygon", coordinates: [poly] },
        });
        features.push({
          type: "Feature",
          properties: { previewType: "arrow-jagged-line", previewColor },
          geometry: { type: "Polygon", coordinates: [poly] },
        });
      }
    } else {
      const arrowResult = mode === "arrow" ? computeArrowhead(previewCoords, previewWidth) : null;
      const bodyCoords = arrowResult
        ? [...previewCoords.slice(0, -1), arrowResult.base]
        : previewCoords;
      features.push({
        type: "Feature",
        properties: { previewType: "line", previewColor },
        geometry: { type: "LineString", coordinates: bodyCoords },
      });
      if (arrowResult) {
        features.push({
          type: "Feature",
          properties: { previewType: "arrow-head", previewColor },
          geometry: { type: "Polygon", coordinates: [arrowResult.polygon] },
        });
      }
    }
  } else if (mode === "area" && previewCoords.length >= 2) {
    features.push({
      type: "Feature",
      properties: { previewType: "line", previewColor },
      geometry: { type: "LineString", coordinates: [...previewCoords, previewCoords[0]] },
    });
  }

  for (const coord of tempCoords) {
    features.push({
      type: "Feature",
      properties: { previewType: "vertex", previewColor },
      geometry: { type: "Point", coordinates: coord },
    });
  }

  return { type: "FeatureCollection", features };
}

// ── Pin HTML element (shadcn-native) ─────────────────────────────────────────
let pinStyleInjected = false;
function injectPinStyle() {
  if (pinStyleInjected) return;
  pinStyleInjected = true;
  const s = document.createElement("style");
  s.textContent = `
    @keyframes pinPulse {
      0%   { transform: scale(1);   opacity: 0.7; }
      100% { transform: scale(2.4); opacity: 0; }
    }
    .pin-pulse { animation: pinPulse 1.6s ease-out infinite; }
    .pin-pulse-2 { animation: pinPulse 1.6s ease-out infinite; animation-delay: 0.8s; }
  `;
  document.head.appendChild(s);
}

function createPinElement(color: string, label: string, showLabel: boolean, glow: boolean): HTMLDivElement {
  injectPinStyle();
  const el = document.createElement("div");
  el.style.cssText = "display:flex;flex-direction:column;align-items:center;cursor:pointer;pointer-events:auto;user-select:none;";
  el.innerHTML = `
    <div style="position:relative;display:flex;align-items:center;justify-content:center;width:24px;height:24px;">
      ${glow ? `
        <div class="pin-pulse"   style="position:absolute;inset:0;border-radius:50%;border:1.5px solid ${color};pointer-events:none;"></div>
        <div class="pin-pulse-2" style="position:absolute;inset:0;border-radius:50%;border:1.5px solid ${color};pointer-events:none;"></div>
      ` : ""}
      <div style="
        position:relative;
        width:20px;height:20px;border-radius:50%;
        background:hsl(var(--card));
        border:2px solid ${color};
        box-shadow:0 2px 6px rgba(0,0,0,0.45),0 0 0 1px ${color}33;
        display:flex;align-items:center;justify-content:center;
        z-index:1;
      ">
        <div style="width:8px;height:8px;border-radius:50%;background:${color};"></div>
      </div>
    </div>
    <div style="width:2px;height:7px;background:linear-gradient(to bottom,${color}bb,transparent);margin-top:-1px;"></div>
    ${showLabel && label ? `
      <div style="
        margin-top:1px;
        font-size:10px;
        font-family:var(--font-sans,system-ui,sans-serif);
        font-weight:500;
        color:hsl(var(--foreground));
        background:hsl(var(--card));
        border:1px solid hsl(var(--border));
        padding:1px 6px;
        border-radius:4px;
        white-space:nowrap;
        box-shadow:0 1px 4px rgba(0,0,0,0.35);
        pointer-events:none;
      ">${label}</div>
    ` : ""}
  `;
  return el;
}

interface DrawingLayersProps {
  annotations: Annotation[];
  previewMode: AnnotationType | null;
  previewColor?: string;
  tempCoords: [number, number][];
  onPinClick: (ann: Annotation, lngLat: [number, number]) => void;
  previewWidth?: number;
  previewArrowStyle?: ArrowStyle;
  terrainActive?: boolean;
}

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export function DrawingLayers({
  annotations, previewMode, previewColor = "#ffffff", tempCoords, onPinClick,
  previewWidth = 2, previewArrowStyle = "simple", terrainActive = false,
}: DrawingLayersProps) {
  const { current: mapRef } = useMap();
  const [ready, setReady] = useState(false);
  const animRef = useRef<number | null>(null);
  const lastGlow = useRef(0);
  const pinMarkersRef = useRef<Map<string, { marker: maplibregl.Marker; color: string; label: string; showLabel: boolean; glow: boolean }>>(new Map());
  const onPinClickRef = useRef(onPinClick);
  onPinClickRef.current = onPinClick;

  // Ref for last cursor position — used so color/width changes keep the rubber-band line
  const cursorCoordRef = useRef<[number, number] | null>(null);

  // Refs for imperative preview updates (bypasses React re-renders on mousemove)
  const previewModeRef = useRef(previewMode);
  previewModeRef.current = previewMode;
  const tempCoordsRef = useRef(tempCoords);
  tempCoordsRef.current = tempCoords;
  const previewWidthRef = useRef(previewWidth);
  previewWidthRef.current = previewWidth;
  const previewArrowStyleRef = useRef(previewArrowStyle);
  previewArrowStyleRef.current = previewArrowStyle;
  const previewColorRef = useRef(previewColor);
  previewColorRef.current = previewColor;

  // Detect style load
  useEffect(() => {
    if (!mapRef) return;
    const m = mapRef.getMap();
    if (m.isStyleLoaded()) {
      setReady(true);
    } else {
      const onStyleData = () => { if (m.isStyleLoaded()) setReady(true); };
      m.on("styledata", onStyleData);
      return () => { m.off("styledata", onStyleData); };
    }
  }, [mapRef]);

  // Set up MapLibre sources and layers
  useEffect(() => {
    if (!ready || !mapRef) return;
    const m = mapRef.getMap();

    if (!m.getSource("draw-src")) {
      m.addSource("draw-src", { type: "geojson", data: EMPTY_FC });
    }
    if (!m.getSource("draw-preview-src")) {
      m.addSource("draw-preview-src", { type: "geojson", data: EMPTY_FC });
    }

    // Data-driven width expressions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const W = (fallback: number): any => ["coalesce", ["get", "width"], fallback];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const WPlus = (add: number, fallback: number): any => ["+", W(fallback), add];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const annLayers: any[] = [
      // ── Area ────────────────────────────────────────────────────────────────
      { id: "draw-area-fill", type: "fill", source: "draw-src",
        filter: ["==", ["get", "annotationType"], "area"],
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0.15 } },
      { id: "draw-area-glow-outer", type: "line", source: "draw-src",
        filter: ["==", ["get", "annotationType"], "area"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": WPlus(10, 2), "line-blur": 6, "line-opacity": 0 } },
      { id: "draw-area-glow-inner", type: "line", source: "draw-src",
        filter: ["==", ["get", "annotationType"], "area"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": WPlus(3, 2), "line-blur": 2, "line-opacity": 0 } },
      { id: "draw-area-edge", type: "line", source: "draw-src",
        filter: ["all", ["==", ["get", "annotationType"], "area"], ["!=", ["get", "dash"], true]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": W(2), "line-opacity": 0.75 } },
      { id: "draw-area-edge-dashed", type: "line", source: "draw-src",
        filter: ["all", ["==", ["get", "annotationType"], "area"], ["==", ["get", "dash"], true]],
        layout: { "line-cap": "butt", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": W(2), "line-opacity": 0.75, "line-dasharray": [6, 4] } },
      // ── Line ─────────────────────────────────────────────────────────────────
      { id: "draw-line-glow-outer", type: "line", source: "draw-src",
        filter: ["==", ["get", "annotationType"], "line"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": WPlus(10, 2), "line-blur": 5, "line-opacity": 0 } },
      { id: "draw-line-glow-inner", type: "line", source: "draw-src",
        filter: ["==", ["get", "annotationType"], "line"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": WPlus(3, 2), "line-blur": 2, "line-opacity": 0 } },
      { id: "draw-line-main", type: "line", source: "draw-src",
        filter: ["all", ["==", ["get", "annotationType"], "line"], ["!=", ["get", "dash"], true]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": W(2), "line-opacity": 0.85 } },
      { id: "draw-line-dashed", type: "line", source: "draw-src",
        filter: ["all", ["==", ["get", "annotationType"], "line"], ["==", ["get", "dash"], true]],
        layout: { "line-cap": "butt", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": W(2), "line-opacity": 0.85, "line-dasharray": [6, 4] } },
      // ── Arrow body (simple) ──────────────────────────────────────────────────
      { id: "draw-arrow-glow-outer", type: "line", source: "draw-src",
        filter: ["==", ["get", "annotationType"], "arrow"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": WPlus(10, 2), "line-blur": 5, "line-opacity": 0 } },
      { id: "draw-arrow-glow-inner", type: "line", source: "draw-src",
        filter: ["==", ["get", "annotationType"], "arrow"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": WPlus(3, 2), "line-blur": 2, "line-opacity": 0 } },
      { id: "draw-arrow-main", type: "line", source: "draw-src",
        filter: ["all", ["==", ["get", "annotationType"], "arrow"], ["!=", ["get", "dash"], true]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": W(2), "line-opacity": 0.85 } },
      { id: "draw-arrow-dashed", type: "line", source: "draw-src",
        filter: ["all", ["==", ["get", "annotationType"], "arrow"], ["==", ["get", "dash"], true]],
        layout: { "line-cap": "butt", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": W(2), "line-opacity": 0.85, "line-dasharray": [6, 4] } },
      // ── Arrow head (simple) — glow AFTER fill so it renders on top ───────────
      { id: "draw-arrow-head-fill", type: "fill", source: "draw-src",
        filter: ["==", ["get", "annotationType"], "arrow-head"],
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0.9 } },
      { id: "draw-arrow-head-glow", type: "fill", source: "draw-src",
        filter: ["==", ["get", "annotationType"], "arrow-head"],
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0 } },
      { id: "draw-arrow-head-edge", type: "line", source: "draw-src",
        filter: ["==", ["get", "annotationType"], "arrow-head"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": 1, "line-opacity": 0.5 } },
      // ── Arrow jagged (broad) — glow AFTER fill ───────────────────────────────
      { id: "draw-arrow-jagged-fill", type: "fill", source: "draw-src",
        filter: ["==", ["get", "annotationType"], "arrow-jagged"],
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0.85 } },
      { id: "draw-arrow-jagged-glow", type: "fill", source: "draw-src",
        filter: ["==", ["get", "annotationType"], "arrow-jagged"],
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0 } },
      { id: "draw-arrow-jagged-edge", type: "line", source: "draw-src",
        filter: ["==", ["get", "annotationType"], "arrow-jagged"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": 1, "line-opacity": 0.5 } },
      // ── Labels ───────────────────────────────────────────────────────────────
      { id: "draw-label", type: "symbol", source: "draw-src",
        filter: ["==", ["geometry-type"], "Point"],
        layout: {
          "text-field": ["get", "label"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 11,
          "text-offset": [0, 1.3],
          "text-anchor": "top",
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": ["get", "color"],
          "text-halo-color": "#060e1a",
          "text-halo-width": 1.5,
          "text-opacity": 0.9,
        } },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const C: any = ["coalesce", ["get", "previewColor"], "#ffffff"];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const previewLayers: any[] = [
      { id: "draw-preview-line", type: "line", source: "draw-preview-src",
        filter: ["==", ["get", "previewType"], "line"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": C, "line-width": 1.5, "line-opacity": 0.6, "line-dasharray": [4, 3] } },
      { id: "draw-preview-arrow-head", type: "fill", source: "draw-preview-src",
        filter: ["==", ["get", "previewType"], "arrow-head"],
        paint: { "fill-color": C, "fill-opacity": 0.55 } },
      { id: "draw-preview-jagged-fill", type: "fill", source: "draw-preview-src",
        filter: ["==", ["get", "previewType"], "arrow-jagged-fill"],
        paint: { "fill-color": C, "fill-opacity": 0.30 } },
      { id: "draw-preview-jagged-line", type: "line", source: "draw-preview-src",
        filter: ["==", ["get", "previewType"], "arrow-jagged-line"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": C, "line-width": 1.5, "line-opacity": 0.6, "line-dasharray": [4, 3] } },
      { id: "draw-preview-vertex", type: "circle", source: "draw-preview-src",
        filter: ["==", ["get", "previewType"], "vertex"],
        paint: { "circle-color": C, "circle-radius": 4, "circle-opacity": 0.8,
          "circle-stroke-width": 1.5, "circle-stroke-color": "#000000" } },
    ];

    for (const spec of [...annLayers, ...previewLayers]) {
      if (!m.getLayer(spec.id)) m.addLayer(spec);
    }

    return () => {
      for (const spec of [...annLayers, ...previewLayers]) {
        if (m.getLayer(spec.id)) m.removeLayer(spec.id);
      }
      if (m.getSource("draw-src")) m.removeSource("draw-src");
      if (m.getSource("draw-preview-src")) m.removeSource("draw-preview-src");
    };
  }, [ready, mapRef]);

  // Sync pin HTML markers
  useEffect(() => {
    if (!ready || !mapRef) return;
    const m = mapRef.getMap();
    const pinAnnotations = annotations.filter(a => a.type === "pin");
    const newIds = new Set(pinAnnotations.map(a => a.id));

    for (const [id, entry] of pinMarkersRef.current) {
      if (!newIds.has(id)) {
        entry.marker.remove();
        pinMarkersRef.current.delete(id);
      }
    }

    for (const ann of pinAnnotations) {
      const existing = pinMarkersRef.current.get(ann.id);
      if (existing && existing.color === ann.color && existing.label === ann.label && existing.showLabel === ann.showLabel && existing.glow === ann.glow) continue;

      if (existing) {
        existing.marker.remove();
        pinMarkersRef.current.delete(ann.id);
      }

      const el = createPinElement(ann.color, ann.label, ann.showLabel, ann.glow);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const lngLat = marker.getLngLat();
        onPinClickRef.current(ann, [lngLat.lng, lngLat.lat]);
      });

      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat(ann.coordinates[0] as [number, number])
        .addTo(m);

      pinMarkersRef.current.set(ann.id, { marker, color: ann.color, label: ann.label, showLabel: ann.showLabel, glow: ann.glow });
    }
  }, [ready, mapRef, annotations]);

  useEffect(() => {
    return () => {
      for (const entry of pinMarkersRef.current.values()) entry.marker.remove();
      pinMarkersRef.current.clear();
    };
  }, []);

  // Update annotation data — exclude per-annotation floated ones (rendered by SVG overlay)
  useEffect(() => {
    if (!ready || !mapRef) return;
    const src = mapRef.getMap().getSource("draw-src") as maplibregl.GeoJSONSource | undefined;
    // In non-terrain mode float has no effect — all annotations render via MapLibre
    const visible = annotations.filter(a => a.type === "pin" || !terrainActive || !a.float);
    src?.setData(buildAnnotationGeoJSON(visible));
  }, [ready, mapRef, annotations, terrainActive]);

  // Update preview data when color/width/coords change — keeps rubber-band line using last cursor pos
  useEffect(() => {
    if (!previewMode) { cursorCoordRef.current = null; }
    if (!ready || !mapRef) return;
    const src = mapRef.getMap().getSource("draw-preview-src") as maplibregl.GeoJSONSource | undefined;
    src?.setData(buildPreviewGeoJSON(previewMode, tempCoords, cursorCoordRef.current, previewWidth, previewArrowStyle, previewColorRef.current));
  }, [ready, mapRef, previewMode, tempCoords, previewWidth, previewArrowStyle, previewColor]);

  // Update preview line width dynamically when drawWidth changes
  useEffect(() => {
    if (!ready || !mapRef) return;
    const m = mapRef.getMap();
    if (m.getLayer("draw-preview-line")) m.setPaintProperty("draw-preview-line", "line-width", Math.max(1.5, previewWidth));
    if (m.getLayer("draw-preview-jagged-line")) m.setPaintProperty("draw-preview-jagged-line", "line-width", Math.max(1.5, previewWidth));
  }, [ready, mapRef, previewWidth]);

  // Imperative mousemove listener — updates preview source directly, no React re-renders
  useEffect(() => {
    if (!ready || !mapRef) return;
    const m = mapRef.getMap();

    function onMouseMove(e: maplibregl.MapMouseEvent) {
      const mode = previewModeRef.current;
      if (!mode || mode === "pin") return;
      cursorCoordRef.current = [e.lngLat.lng, e.lngLat.lat];
      const src = m.getSource("draw-preview-src") as maplibregl.GeoJSONSource | undefined;
      src?.setData(buildPreviewGeoJSON(
        mode,
        tempCoordsRef.current,
        cursorCoordRef.current,
        previewWidthRef.current,
        previewArrowStyleRef.current,
        previewColorRef.current,
      ));
    }

    m.on("mousemove", onMouseMove);
    return () => { m.off("mousemove", onMouseMove); };
  }, [ready, mapRef]);

  // Track whether any annotation has glow, so we can skip animation when none do
  const hasGlowRef = useRef(false);
  hasGlowRef.current = annotations.some(a => a.glow);

  // Glow animation — data-driven: only features with glow:true are affected
  useEffect(() => {
    if (!ready || !mapRef) return;
    const m = mapRef.getMap();

    function frame(ts: number) {
      if (hasGlowRef.current && ts - lastGlow.current > 33) {
        const t = Math.sin((ts / 1250) * Math.PI) * 0.5 + 0.5;
        const lineOuter  = 0.020 + t * 0.086;
        const lineInner  = 0.149 + t * 0.204;
        const headGlow   = 0.10  + t * 0.35;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ifGlow = (v: number): any => ["case", ["boolean", ["get", "glow"], false], v, 0];

        if (m.getLayer("draw-line-glow-outer"))        m.setPaintProperty("draw-line-glow-outer",        "line-opacity",  ifGlow(lineOuter));
        if (m.getLayer("draw-line-glow-inner"))        m.setPaintProperty("draw-line-glow-inner",        "line-opacity",  ifGlow(lineInner));
        if (m.getLayer("draw-arrow-glow-outer"))       m.setPaintProperty("draw-arrow-glow-outer",       "line-opacity",  ifGlow(lineOuter));
        if (m.getLayer("draw-arrow-glow-inner"))       m.setPaintProperty("draw-arrow-glow-inner",       "line-opacity",  ifGlow(lineInner));
        if (m.getLayer("draw-area-glow-outer"))        m.setPaintProperty("draw-area-glow-outer",        "line-opacity",  ifGlow(lineOuter));
        if (m.getLayer("draw-area-glow-inner"))        m.setPaintProperty("draw-area-glow-inner",        "line-opacity",  ifGlow(lineInner));
        if (m.getLayer("draw-arrow-head-glow"))        m.setPaintProperty("draw-arrow-head-glow",        "fill-opacity",  ifGlow(headGlow));
        if (m.getLayer("draw-arrow-jagged-glow"))      m.setPaintProperty("draw-arrow-jagged-glow",      "fill-opacity",  ifGlow(headGlow));
        lastGlow.current = ts;
      }
      animRef.current = requestAnimationFrame(frame);
    }
    animRef.current = requestAnimationFrame(frame);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [ready, mapRef]);

  return null;
}
