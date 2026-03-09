import { useEffect, useRef } from "react";
import { useMap } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import { natoSVG } from "@/lib/natoSymbols";
import { buildSpline, buildArc, getState } from "@/lib/spline";
import { injectStyleOnce } from "@/lib/injectCSS";
import type { PlacedUnit, UnitPath } from "@/types/units";

const N_SAMPLES  = 800;
const LOOK_AHEAD = 14;

const UNIT_LAYER_CSS = `
  @keyframes unit-ring0 {
    0%   { transform:translate(-50%,-50%) scale(0.45); opacity:0.75; }
    100% { transform:translate(-50%,-50%) scale(1.65); opacity:0;    }
  }
  @keyframes unit-ring1 {
    0%   { transform:translate(-50%,-50%) scale(0.45); opacity:0.40; }
    100% { transform:translate(-50%,-50%) scale(1.65); opacity:0;    }
  }
`;

// ── Marker element builder ────────────────────────────────────────────────────
function makeUnitEl(unit: PlacedUnit, terrain: boolean): HTMLDivElement {
  const outer = document.createElement("div");
  outer.style.cssText = "will-change:transform;";

  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:relative;width:36px;height:50px;";

  // Pulsing radar rings for glow
  if (unit.glow) {
    for (let i = 0; i < 2; i++) {
      const ring = document.createElement("div");
      ring.style.cssText = `
        position:absolute;width:52px;height:52px;
        top:50%;left:50%;
        border:1.5px solid ${unit.color};border-radius:50%;
        animation:unit-ring${i} 2.4s ease-out ${i*1.2}s infinite;
        pointer-events:none;
      `;
      wrapper.appendChild(ring);
    }
  }

  // NATO SVG symbol
  const sym = document.createElement("div");
  sym.innerHTML = natoSVG(unit.unitType, unit.color);
  sym.style.cssText = `position:absolute;inset:0;filter:drop-shadow(0 0 5px ${unit.color}88);`;
  wrapper.appendChild(sym);

  // Label below
  const label = document.createElement("div");
  label.textContent = unit.label;
  label.style.cssText = `
    position:absolute;
    bottom:-2px;
    left:50%;
    transform:translateX(-50%);
    white-space:nowrap;
    font-size:9px;
    font-family:ui-monospace,monospace;
    font-weight:600;
    background:rgba(0,0,0,0.82);
    color:${unit.color};
    padding:1px 4px;
    border-radius:3px;
    border:1px solid ${unit.color}55;
    pointer-events:none;
  `;
  wrapper.appendChild(label);

  // Suppress unused param warning — terrain flag is used by caller for anchor/pitch
  void terrain;

  outer.appendChild(wrapper);
  return outer;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function UnitLayer({ terrain = false, units, paths }: {
  terrain?: boolean;
  units: PlacedUnit[];
  paths: UnitPath[];
}) {
  const { current: mapRef } = useMap();
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;

    injectStyleOnce("unit-layer-css", UNIT_LAYER_CSS);

    const allMarkers: maplibregl.Marker[] = [];
    const layerIds: string[] = [];
    const sourceIds: string[] = [];

    // Build path lookup
    const pathMap = new Map(paths.map(p => [p.id, p]));

    // Add path lines
    for (const path of paths) {
      const srcId = `unit-path-src-${path.id}`;
      const lyrId = `unit-path-lyr-${path.id}`;
      if (!map.getSource(srcId)) {
        map.addSource(srcId, {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: { type: "LineString", coordinates: path.coordinates },
            properties: {},
          },
        });
        map.addLayer({
          id: lyrId,
          type: "line",
          source: srcId,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": path.color,
            "line-width": 2,
            "line-dasharray": [5, 4],
            "line-opacity": 0.75,
          },
        });
      }
      sourceIds.push(srcId);
      layerIds.push(lyrId);
    }

    // Build animation data for moving units
    type AnimUnit = {
      marker: maplibregl.Marker;
      pts: [number, number][];
      arc: number[];
      loopMs: number;
    };
    const animatingUnits: AnimUnit[] = [];

    for (const unit of units) {
      const el = makeUnitEl(unit, terrain);
      const marker = new maplibregl.Marker({
        element: el,
        anchor: "center",
        offset: terrain ? [0, 0] : [0, 3],
        rotationAlignment: "map",
        pitchAlignment: terrain ? "map" : "viewport",
      });

      const path = unit.pathId ? pathMap.get(unit.pathId) : null;
      if (path && path.coordinates.length >= 2 && unit.animating) {
        const pts = buildSpline(path.coordinates, N_SAMPLES);
        const arc = buildArc(pts);
        marker.setLngLat(path.coordinates[0]);
        marker.addTo(map);
        animatingUnits.push({ marker, pts, arc, loopMs: unit.loopMs });
      } else {
        marker.setLngLat(unit.position);
        marker.addTo(map);
      }
      allMarkers.push(marker);
    }

    function onRender() {
      const ts = performance.now();
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      for (const u of animatingUnits) {
        const t = (elapsed % u.loopMs) / u.loopMs;
        const { pos, bearing } = getState(u.pts, u.arc, t, LOOK_AHEAD);
        u.marker.setLngLat(pos);
        u.marker.setRotation(bearing);
      }
    }

    map.on("render", onRender);
    return () => {
      map.off("render", onRender);
      allMarkers.forEach(m => m.remove());
      layerIds.forEach(id => { if (map.getLayer(id)) map.removeLayer(id); });
      sourceIds.forEach(id => { if (map.getSource(id)) map.removeSource(id); });
    };
  }, [mapRef, terrain, units, paths]);

  return null;
}
