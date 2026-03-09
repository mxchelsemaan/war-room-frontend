import { useEffect, useRef } from "react";
import { useMap } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import { SHIP_SPECS } from "@/data/ships";
import { buildSpline, buildArc, getState } from "@/lib/spline";

// ── Spline constants ──────────────────────────────────────────────────────────
const N_SAMPLES  = 400;
const LOOK_AHEAD = 8;

// ── CSS ping animation (injected once) ───────────────────────────────────────
let pingStyleInjected = false;
function injectPingStyle() {
  if (pingStyleInjected) return;
  pingStyleInjected = true;
  const s = document.createElement("style");
  s.textContent = `
    @keyframes shipPing {
      0%   { transform: scale(1);   opacity: 0.5; }
      100% { transform: scale(2.5); opacity: 0; }
    }
    .ship-ping {
      position: absolute;
      top: 50%; left: 50%;
      border-radius: 50%;
      animation: shipPing 3s ease-out infinite;
      pointer-events: none;
    }
  `;
  document.head.appendChild(s);
}

// ── Ship SVG (top-down silhouette) ───────────────────────────────────────────
function shipSVG(color: string, type: string): string {
  const isNaval = type === "naval" || type === "patrol";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 32 32">
    <defs>
      <filter id="glow-s-${color.replace('#','')}" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="1.5" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <path d="M16,3 L21,10 L22,24 L20,29 L12,29 L10,24 L11,10 Z" fill="${color}" filter="url(#glow-s-${color.replace('#','')})" opacity="0.95"/>
    <path d="M16,3 L18,8 L16,7 L14,8 Z" fill="white" opacity="0.3"/>
    <rect x="13" y="14" width="6" height="5" rx="1" fill="${color}" stroke="white" stroke-width="0.5" opacity="0.85"/>
    ${isNaval
      ? `<circle cx="16" cy="10" r="2" fill="${color}" stroke="white" stroke-width="0.5" opacity="0.8"/>
         <line x1="16" y1="10" x2="16" y2="5" stroke="white" stroke-width="0.8" opacity="0.6"/>`
      : `<rect x="12" y="20" width="8" height="4" rx="0.5" fill="${color}" stroke="white" stroke-width="0.3" opacity="0.7"/>`
    }
    <line x1="14" y1="29" x2="12" y2="32" stroke="${color}" stroke-width="0.8" opacity="0.4"/>
    <line x1="18" y1="29" x2="20" y2="32" stroke="${color}" stroke-width="0.8" opacity="0.4"/>
  </svg>`;
}

// ── Marker element builder ────────────────────────────────────────────────────
// Returns the marker root element and a reference to the ship SVG div
// (only the SVG rotates; the label always stays horizontal)
function makeShipEl(
  name: string, flag: string, color: string, type: string,
): { el: HTMLDivElement; rotateEl: HTMLDivElement } {
  injectPingStyle();

  const isNaval = type === "naval" || type === "patrol";
  const ringSize = isNaval ? 28 : 32;

  const outer = document.createElement("div");
  outer.style.cssText = "will-change:transform;display:flex;flex-direction:column;align-items:center;cursor:pointer;pointer-events:auto;";

  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:relative;width:48px;height:64px;display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0;";

  // Ping ring
  const ring = document.createElement("div");
  ring.className = "ship-ping";
  ring.style.cssText += `width:${ringSize}px;height:${ringSize}px;margin:-${ringSize/2}px 0 0 -${ringSize/2}px;border:1.5px solid ${color};top:24px;`;
  wrapper.appendChild(ring);

  // Ship SVG — only this element rotates (bearing applied via CSS transform)
  const shipDiv = document.createElement("div");
  shipDiv.innerHTML = shipSVG(color, type);
  shipDiv.style.cssText = `width:48px;height:48px;filter:drop-shadow(0 0 4px ${color}99);position:relative;z-index:1;transform-origin:center center;`;
  wrapper.appendChild(shipDiv);

  // Name label — always horizontal, never rotated
  const label = document.createElement("div");
  label.textContent = `${name} ${flag}`;
  label.style.cssText = `
    font-size:8px;
    font-family:ui-monospace,monospace;
    font-weight:600;
    white-space:nowrap;
    background:rgba(0,0,0,0.82);
    color:white;
    padding:1px 4px;
    border-radius:3px;
    border:1px solid ${color}66;
    text-align:center;
    line-height:1.4;
    pointer-events:none;
    position:relative;z-index:1;
  `;
  wrapper.appendChild(label);

  outer.appendChild(wrapper);
  return { el: outer, rotateEl: shipDiv };
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ShipLayer({ terrain = false }: { terrain?: boolean }) {
  const { current: mapRef } = useMap();
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const mapMaybe = mapRef?.getMap();
    if (!mapMaybe) return;
    const map: maplibregl.Map = mapMaybe;

    type AnimShip = {
      spec: typeof SHIP_SPECS[0];
      marker: maplibregl.Marker;
      rotateEl: HTMLDivElement;
      pts: [number, number][];
      arc: number[];
      loopMs: number;
      startOffset: number;
    };

    const animShips: AnimShip[] = [];
    const all: maplibregl.Marker[] = [];
    const layerIds: string[] = [];
    const sourceIds: string[] = [];

    function safeRemoveLayer(id: string) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    function safeRemoveSource(id: string) {
      if (map.getSource(id)) map.removeSource(id);
    }

    for (const spec of SHIP_SPECS) {
      const pts = buildSpline(spec.route, N_SAMPLES);
      const arc = buildArc(pts);

      // ── Ghost route + wake trail — flat mode only (terrain draping looks off) ─
      const isNaval = spec.type === "naval" || spec.type === "patrol";
      if (!terrain) {
        const routeSrcId = `route-ship-${spec.id}`;
        const routeLyrId = `layer-route-ship-${spec.id}`;
        map.addSource(routeSrcId, {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: { type: "LineString", coordinates: pts },
            properties: {},
          },
        });
        map.addLayer({
          id: routeLyrId,
          type: "line",
          source: routeSrcId,
          paint: {
            "line-color": spec.color + "20",
            "line-width": 1,
            "line-dasharray": [3, 6],
          },
        });
        sourceIds.push(routeSrcId);
        layerIds.push(routeLyrId);

        const trailSrcId = `trail-ship-${spec.id}`;
        const trailLyrId = `layer-trail-ship-${spec.id}`;
        map.addSource(trailSrcId, {
          type: "geojson",
          lineMetrics: true,
          data: {
            type: "Feature",
            geometry: { type: "LineString", coordinates: [pts[0], pts[0]] },
            properties: {},
          },
        });
        map.addLayer({
          id: trailLyrId,
          type: "line",
          source: trailSrcId,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-width": isNaval ? 3 : 2.5,
            "line-gradient": [
              "interpolate", ["linear"], ["line-progress"],
              0, "rgba(0,0,0,0)",
              1, spec.color + "bb",
            ],
          },
        });
        sourceIds.push(trailSrcId);
        layerIds.push(trailLyrId);
      }

      // ── Marker ───────────────────────────────────────────────────────────────
      // rotationAlignment: "viewport" keeps the whole element upright — we
      // manually rotate only the ship SVG so labels are always readable.
      const { el, rotateEl } = makeShipEl(spec.name, spec.flag, spec.color, spec.type);
      const marker = new maplibregl.Marker({
        element: el,
        anchor: "center",
        rotationAlignment: "viewport",
        pitchAlignment: "viewport",
      });
      marker.setLngLat(spec.route[0]);
      marker.addTo(map);
      all.push(marker);

      animShips.push({ spec, marker, rotateEl, pts, arc, loopMs: spec.loopMs, startOffset: spec.startOffset });
    }

    // Trail fraction: 8% of spline points behind current position
    const TRAIL_FRAC = 0.08;

    function onRender() {
      const ts = performance.now();
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;

      for (const s of animShips) {
        const t = ((elapsed + s.startOffset) % s.loopMs) / s.loopMs;
        const { pos, bearing, idx } = getState(s.pts, s.arc, t, LOOK_AHEAD);
        s.marker.setLngLat(pos);
        // Rotate only the SVG; label stays horizontal in viewport space
        s.rotateEl.style.transform = `rotate(${bearing - map.getBearing()}deg) scaleY(0.62)`;

        // Update wake trail (flat mode only)
        const trailSrc = !terrain
          ? map.getSource(`trail-ship-${s.spec.id}`) as maplibregl.GeoJSONSource | undefined
          : undefined;
        if (trailSrc) {
          const trailLen = Math.max(2, Math.floor(s.pts.length * TRAIL_FRAC));
          const start = Math.max(0, idx - trailLen);
          const trailCoords = s.pts.slice(start, idx + 1);
          if (trailCoords.length < 2) trailCoords.push(trailCoords[0]);
          trailSrc.setData({
            type: "Feature",
            geometry: { type: "LineString", coordinates: trailCoords },
            properties: {},
          });
        }
      }
    }

    map.on("render", onRender);
    return () => {
      map.off("render", onRender);
      all.forEach(m => m.remove());
      layerIds.forEach(safeRemoveLayer);
      sourceIds.forEach(safeRemoveSource);
    };
  }, [mapRef, terrain]);

  return null;
}
