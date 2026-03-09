import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type { MapRef } from "react-map-gl/maplibre";
import type { Annotation } from "@/hooks/useDrawing";

interface Pt { x: number; y: number }

/**
 * Altitude for floating annotations — just above the highest Lebanese peak
 * (Qurnat as Sawda, 3,088 m), below aircraft (24,000 m).
 */
const FLOAT_ALT_M = 3500;

function project(map: maplibregl.Map, coords: [number, number][]): Pt[] {
  return coords.map(([lng, lat]) => {
    // Project at a fixed world altitude so the layer is flat (not terrain-following)
    const mercCoord = maplibregl.MercatorCoordinate.fromLngLat(
      new maplibregl.LngLat(lng, lat),
      FLOAT_ALT_M,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pt = (map.transform as any).coordinatePoint(mercCoord) as { x: number; y: number } | undefined;
    return pt ?? { x: 0, y: 0 };
  });
}

function arrowhead(pts: Pt[], width = 4): { polygon: Pt[]; base: Pt } | null {
  if (pts.length < 2) return null;
  const tip  = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  const dx = tip.x - prev.x;
  const dy = tip.y - prev.y;
  const L  = Math.sqrt(dx * dx + dy * dy);
  if (L < 1) return null;

  const scale = Math.max(0.5, width / 4);
  const hl = Math.min(Math.max(L * 0.18, 12), 40) * scale;
  const hw = hl * 0.9;
  const ux = dx / L, uy = dy / L;
  const px = -uy,    py =  ux;
  const bx = tip.x - ux * hl;
  const by = tip.y - uy * hl;

  return {
    polygon: [tip, { x: bx + px * hw, y: by + py * hw }, { x: bx - px * hw, y: by - py * hw }],
    base: { x: bx, y: by },
  };
}

function jaggedArrowPts(pts: Pt[], halfW: number): Pt[] | null {
  const n = pts.length;
  if (n < 2) return null;

  const segFwd: Pt[] = [];
  const segNorm: Pt[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i+1].x - pts[i].x;
    const dy = pts[i+1].y - pts[i].y;
    const L = Math.sqrt(dx*dx + dy*dy);
    if (L < 1e-6) { segFwd.push({x:1,y:0}); segNorm.push({x:0,y:1}); continue; }
    segFwd.push({x: dx/L, y: dy/L});
    segNorm.push({x: -dy/L, y: dx/L});
  }

  const vertNorm: Pt[] = [];
  for (let i = 0; i < n - 1; i++) {
    if (i === 0) {
      vertNorm.push(segNorm[0]);
    } else {
      let nx = segNorm[i-1].x + segNorm[i].x;
      let ny = segNorm[i-1].y + segNorm[i].y;
      const L = Math.sqrt(nx*nx + ny*ny);
      if (L > 1e-6) { nx /= L; ny /= L; }
      vertNorm.push({x: nx, y: ny});
    }
  }

  const lastFwd = segFwd[n-2];
  const lastNorm = segNorm[n-2];
  const tip = pts[n-1];
  const lastBodyPt = pts[n-2];
  const lastSegLen = Math.sqrt((tip.x-lastBodyPt.x)**2 + (tip.y-lastBodyPt.y)**2);

  const headHW = halfW * 2.0;
  const hl = Math.min(halfW * 4.0, lastSegLen * 0.7);
  const headBase: Pt = {x: tip.x - lastFwd.x*hl, y: tip.y - lastFwd.y*hl};
  const headLeft: Pt = {x: headBase.x + lastNorm.x*headHW, y: headBase.y + lastNorm.y*headHW};
  const headRight: Pt = {x: headBase.x - lastNorm.x*headHW, y: headBase.y - lastNorm.y*headHW};

  const bodyL: Pt[] = [];
  const bodyR: Pt[] = [];
  for (let i = 0; i < n - 1; i++) {
    const nv = vertNorm[i];
    bodyL.push({x: pts[i].x + nv.x*halfW, y: pts[i].y + nv.y*halfW});
    bodyR.push({x: pts[i].x - nv.x*halfW, y: pts[i].y - nv.y*halfW});
  }

  const tailFwd = segFwd[0];
  const notchDepth = halfW * 1.5;
  const notchPt: Pt = {
    x: pts[0].x + tailFwd.x*notchDepth,
    y: pts[0].y + tailFwd.y*notchDepth,
  };

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

function toPath(pts: Pt[], close = false): string {
  if (!pts.length) return "";
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + (close ? " Z" : "");
}

function toPoly(pts: Pt[]): string {
  return pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

function centroid(pts: Pt[]): Pt {
  return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
}

/**
 * Label position: perpendicular to line at its midpoint, offset to the "upper" side on screen.
 * For areas, falls back to the centroid.
 */
function sideLabel(pts: Pt[], offset = 18): Pt {
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length === 1) return { x: pts[0].x + offset, y: pts[0].y };
  const mid = Math.floor((pts.length - 1) / 2);
  const a = pts[mid];
  const b = pts[Math.min(mid + 1, pts.length - 1)];
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.sqrt(dx * dx + dy * dy) || 1;
  // Left perp: (-dy/L, dx/L)  Right perp: (dy/L, -dx/L)
  // Pick whichever goes more "upward" (lower y in screen space)
  const leftPy  =  dx / L;
  const rightPy = -dx / L;
  const [px, py] = leftPy <= rightPy
    ? [-dy / L,  dx / L]   // left
    : [ dy / L, -dx / L];  // right
  return { x: mx + px * offset, y: my + py * offset };
}

// Glow animation via CSS on SVG elements
const STYLE = `
  @keyframes floatGlowPulse {
    0%,100% { opacity: 0.04; }
    50%      { opacity: 0.16; }
  }
  @keyframes floatGlowInner {
    0%,100% { opacity: 0.18; }
    50%      { opacity: 0.42; }
  }
  .fao-glow-outer { animation: floatGlowPulse 2.5s ease-in-out infinite; }
  .fao-glow-inner { animation: floatGlowInner 2.5s ease-in-out infinite; }
`;

let styleInjected = false;
function injectStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const el = document.createElement("style");
  el.textContent = STYLE;
  document.head.appendChild(el);
}

/** Floating pill label rendered in SVG */
function PillLabel({ x, y, text, color }: { x: number; y: number; text: string; color: string }) {
  const w = text.length * 6.5 + 14;
  const h = 18;
  return (
    <g transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`} style={{ pointerEvents: "none" }}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={5}
        fill="#0c111a" fillOpacity={0.82} stroke={color} strokeWidth={0.8} strokeOpacity={0.6} />
      <text textAnchor="middle" dominantBaseline="middle"
        fontSize={11} fontFamily="system-ui,sans-serif" fontWeight={500} fill={color}>
        {text}
      </text>
    </g>
  );
}

interface Props {
  annotations: Annotation[];
  mapRef: React.RefObject<MapRef | null>;
  terrainActive?: boolean;
}

export function FloatAnnotationOverlay({ annotations, mapRef, terrainActive = false }: Props) {
  const [tick, setTick] = useState(0);
  const rafRef = useRef<number | null>(null);

  injectStyle();

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const update = () => setTick(n => n + 1);
    map.on("render", update);
    return () => { map.off("render", update); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  void tick;
  void rafRef;

  const map = mapRef.current?.getMap();
  if (!map) return null;

  // Float only applies in 3D terrain mode; in flat mode all annotations drape fine on the map
  const nonPins = terrainActive
    ? annotations.filter(a => a.type !== "pin" && a.float)
    : [];

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width="100%"
      height="100%"
      style={{ overflow: "visible", zIndex: 30 }}
    >
      <defs>
        <filter id="fao-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="10" stdDeviation="6" floodColor="rgba(0,0,0,0.75)" />
        </filter>
      </defs>

      {nonPins.map(ann => {
        const pts = project(map, ann.coordinates as [number, number][]);
        if (!pts.length) return null;
        const w = ann.width ?? 3;

        if (ann.type === "line") {
          const d = toPath(pts);
          const lp = sideLabel(pts);
          return (
            <g key={ann.id} filter="url(#fao-shadow)">
              {ann.glow && <>
                <path className="fao-glow-outer" d={d} stroke={ann.color} strokeWidth={w + 14} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path className="fao-glow-inner" d={d} stroke={ann.color} strokeWidth={w + 5}  strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </>}
              <path d={d} stroke={ann.color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.9} />
              {ann.showLabel && ann.label && <PillLabel x={lp.x} y={lp.y} text={ann.label} color={ann.color} />}
            </g>
          );
        }

        if (ann.type === "arrow") {
          if (ann.arrowStyle === "jagged") {
            const halfW = w * 5;
            const jagPts = jaggedArrowPts(pts, halfW);
            if (!jagPts) return null;
            const lp = sideLabel(pts);
            return (
              <g key={ann.id} filter="url(#fao-shadow)">
                {ann.glow && <>
                  <polygon className="fao-glow-outer" points={toPoly(jagPts)} fill={ann.color} />
                  <polygon className="fao-glow-inner" points={toPoly(jagPts)} fill={ann.color} />
                </>}
                <polygon points={toPoly(jagPts)} fill={ann.color} opacity={0.85} />
                <polygon points={toPoly(jagPts)} fill="none" stroke={ann.color} strokeWidth={1} strokeLinejoin="round" opacity={0.5} />
                {ann.showLabel && ann.label && <PillLabel x={lp.x} y={lp.y} text={ann.label} color={ann.color} />}
              </g>
            );
          }

          const ah = arrowhead(pts, w);
          const bodyPts = ah ? [...pts.slice(0, -1), ah.base] : pts;
          const d = toPath(bodyPts);
          const lp = sideLabel(pts);
          return (
            <g key={ann.id} filter="url(#fao-shadow)">
              {ann.glow && <>
                <path className="fao-glow-outer" d={d} stroke={ann.color} strokeWidth={w + 14} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path className="fao-glow-inner" d={d} stroke={ann.color} strokeWidth={w + 5}  strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </>}
              <path d={d} stroke={ann.color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.9} />
              {ah && <polygon points={toPoly(ah.polygon)} fill={ann.color} opacity={0.92} />}
              {ann.showLabel && ann.label && <PillLabel x={lp.x} y={lp.y} text={ann.label} color={ann.color} />}
            </g>
          );
        }

        if (ann.type === "area") {
          const d = toPath(pts, true);
          const c = centroid(pts);
          return (
            <g key={ann.id} filter="url(#fao-shadow)">
              <path d={d} fill={ann.color} fillOpacity={0.18} stroke={ann.color} strokeWidth={w}
                strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
              {ann.glow && <>
                <path className="fao-glow-outer" d={d} fill="none" stroke={ann.color} strokeWidth={w + 14} strokeLinecap="round" strokeLinejoin="round" />
                <path className="fao-glow-inner" d={d} fill="none" stroke={ann.color} strokeWidth={w + 5}  strokeLinecap="round" strokeLinejoin="round" />
              </>}
              {ann.showLabel && ann.label && <PillLabel x={c.x} y={c.y} text={ann.label} color={ann.color} />}
            </g>
          );
        }

        return null;
      })}
    </svg>
  );
}
