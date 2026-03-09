import { useEffect, useRef } from "react";
import { useMap } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import { FLIGHT_SPECS } from "@/data/flights";
import { buildSpline, buildArc, getState } from "@/lib/spline";

// ── Spline constants ──────────────────────────────────────────────────────────
const N_SAMPLES  = 600;
const LOOK_AHEAD = 12;

// ── CSS ping animation (injected once) ───────────────────────────────────────
let pingStyleInjected = false;
function injectPingStyle() {
  if (pingStyleInjected) return;
  pingStyleInjected = true;
  const s = document.createElement("style");
  s.textContent = `
    @keyframes flightPing {
      0%   { transform: scale(1);   opacity: 0.6; }
      100% { transform: scale(3);   opacity: 0; }
    }
    .flight-ping {
      position: absolute;
      top: 50%; left: 50%;
      width: 24px; height: 24px;
      margin: -12px 0 0 -12px;
      border-radius: 50%;
      animation: flightPing 2s ease-out infinite;
      pointer-events: none;
    }
    .flight-ping-2 {
      animation-delay: 1s;
    }
  `;
  document.head.appendChild(s);
}

// ── Plane SVG (top-down silhouette) ──────────────────────────────────────────
function planeSVG(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 28 28">
    <defs>
      <filter id="glow-${color.replace('#','')}" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <ellipse cx="14" cy="14" rx="2.2" ry="8" fill="${color}" filter="url(#glow-${color.replace('#','')})"/>
    <ellipse cx="14" cy="6.5" rx="2.2" ry="3" fill="${color}"/>
    <path d="M14,11 L3,19 L5,20 L14,15 L23,20 L25,19 Z" fill="${color}" opacity="0.92"/>
    <path d="M14,19 L9,24 L10.5,24.5 L14,21.5 L17.5,24.5 L19,24 Z" fill="${color}" opacity="0.85"/>
    <ellipse cx="14" cy="7.5" rx="1" ry="1.5" fill="white" opacity="0.55"/>
  </svg>`;
}

// ── Marker element builder ────────────────────────────────────────────────────
// Returns the marker root element and a reference to the plane SVG div
// (only the SVG rotates; the label always stays horizontal)
function makeFlightEl(
  callsign: string, country: string, color: string,
): { el: HTMLDivElement; rotateEl: HTMLDivElement } {
  injectPingStyle();

  const outer = document.createElement("div");
  outer.style.cssText = "will-change:transform;display:flex;flex-direction:column;align-items:center;cursor:pointer;pointer-events:auto;z-index:5;position:relative;";

  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:relative;width:36px;height:52px;display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0;";

  // Ping rings (behind the icon)
  const ring1 = document.createElement("div");
  ring1.className = "flight-ping";
  ring1.style.cssText += `border: 1.5px solid ${color}; top:18px;`;
  wrapper.appendChild(ring1);

  const ring2 = document.createElement("div");
  ring2.className = "flight-ping flight-ping-2";
  ring2.style.cssText += `border: 1.5px solid ${color}; top:18px;`;
  wrapper.appendChild(ring2);

  // Plane SVG — only this element rotates (bearing applied via CSS transform)
  const planeDiv = document.createElement("div");
  planeDiv.innerHTML = planeSVG(color);
  planeDiv.style.cssText = `width:36px;height:36px;filter:drop-shadow(0 0 4px ${color}bb);position:relative;z-index:1;transform-origin:center center;`;
  wrapper.appendChild(planeDiv);

  // Callsign label — always horizontal, never rotated
  const label = document.createElement("div");
  label.textContent = `${callsign} ${country}`;
  label.style.cssText = `
    font-size:9px;
    font-family:ui-monospace,monospace;
    font-weight:600;
    white-space:nowrap;
    background:rgba(0,0,0,0.78);
    color:white;
    padding:1px 5px;
    border-radius:4px;
    border:1px solid ${color}66;
    text-align:center;
    line-height:1.4;
    pointer-events:none;
    position:relative;z-index:1;
  `;
  wrapper.appendChild(label);

  outer.appendChild(wrapper);

  return { el: outer, rotateEl: planeDiv };
}

// ── Component ─────────────────────────────────────────────────────────────────
export function FlightLayer({ terrain = false }: { terrain?: boolean }) {
  const { current: mapRef } = useMap();
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const mapMaybe = mapRef?.getMap();
    if (!mapMaybe) return;
    const map: maplibregl.Map = mapMaybe;

    type AnimFlight = {
      spec: typeof FLIGHT_SPECS[0];
      marker: maplibregl.Marker;
      rotateEl: HTMLDivElement;
      pts: [number, number][];
      arc: number[];
      loopMs: number;
      startOffset: number;
    };

    const animFlights: AnimFlight[] = [];
    const all: maplibregl.Marker[] = [];
    const layerIds: string[] = [];
    const sourceIds: string[] = [];

    // Altitude in metres used to project plane markers above all terrain in 3D mode
    const ALTITUDE_M = 24000;

    // Helper: safe remove layer/source
    function safeRemoveLayer(id: string) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    function safeRemoveSource(id: string) {
      if (map.getSource(id)) map.removeSource(id);
    }

    for (const spec of FLIGHT_SPECS) {
      const pts = buildSpline(spec.route, N_SAMPLES);
      const arc = buildArc(pts);

      // ── Marker ───────────────────────────────────────────────────────────────
      // rotationAlignment: "viewport" keeps the whole element upright — we
      // manually rotate only the plane SVG so labels are always readable.
      const { el, rotateEl } = makeFlightEl(spec.callsign, spec.country, spec.color);
      const marker = new maplibregl.Marker({
        element: el,
        anchor: "center",
        rotationAlignment: "viewport",
        pitchAlignment: "viewport",
      });
      marker.setLngLat([spec.route[0][0], spec.route[0][1]]);
      marker.addTo(map);
      all.push(marker);

      animFlights.push({ spec, marker, rotateEl, pts, arc, loopMs: spec.loopMs, startOffset: spec.startOffset });
    }

    function onRender() {
      const ts = performance.now();
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;

      for (const f of animFlights) {
        const t = ((elapsed + f.startOffset) % f.loopMs) / f.loopMs;
        const { pos, bearing } = getState(f.pts, f.arc, t, LOOK_AHEAD);

        f.marker.setLngLat(pos);

        if (terrain) {
          // Project [lng, lat, altitude] to screen space so the marker floats
          // at a fixed elevation above all terrain (terrain-unaware map.project()
          // would embed markers into mountainsides).
          const coord = maplibregl.MercatorCoordinate.fromLngLat(
            new maplibregl.LngLat(pos[0], pos[1]),
            ALTITUDE_M,
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pt = (map.transform as any).coordinatePoint(coord) as { x: number; y: number } | undefined;
          if (pt) {
            f.marker.getElement().style.transform =
              `translate(-50%, -50%) translate(${pt.x}px, ${pt.y}px)`;
          }
        }

        // Rotate only the SVG; label stays horizontal in viewport space
        f.rotateEl.style.transform = `rotate(${bearing - map.getBearing()}deg) scaleY(0.6)`;
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
