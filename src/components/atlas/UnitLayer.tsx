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
  @keyframes unit-hover-bob {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-6px); }
  }
`;

// ── Marker element builder ────────────────────────────────────────────────────
interface UnitElRefs {
  wrapper: HTMLDivElement;
  sym: HTMLDivElement;
  label: HTMLDivElement;
  rings: HTMLDivElement[];
  targetEl: HTMLDivElement | null;
}

function makeUnitEl(unit: PlacedUnit): { outer: HTMLDivElement; refs: UnitElRefs } {
  const outer = document.createElement("div");
  outer.style.cssText = "will-change:transform;";

  const wrapper = document.createElement("div");
  wrapper.style.cssText = `position:relative;width:36px;height:50px;${
    unit.effect === "hover" ? "animation:unit-hover-bob 1.8s ease-in-out infinite;" : ""
  }`;

  // Pulsing radar rings for glow
  const rings: HTMLDivElement[] = [];
  if (unit.effect === "glow") {
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
      rings.push(ring);
    }
  }

  // Target indicator — red inverted triangle above unit
  let targetEl: HTMLDivElement | null = null;
  if (unit.target) {
    targetEl = document.createElement("div");
    targetEl.style.cssText = `
      position:absolute;top:-10px;left:50%;transform:translateX(-50%);
      width:0;height:0;
      border-left:5px solid transparent;
      border-right:5px solid transparent;
      border-top:8px solid #ef4444;
      pointer-events:none;
    `;
    wrapper.appendChild(targetEl);
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

  outer.appendChild(wrapper);
  return { outer, refs: { wrapper, sym, label, rings, targetEl } };
}

/** Update an existing marker's DOM to reflect new unit properties */
function updateUnitEl(refs: UnitElRefs, unit: PlacedUnit) {
  // Update NATO symbol color
  refs.sym.innerHTML = natoSVG(unit.unitType, unit.color);
  refs.sym.style.filter = `drop-shadow(0 0 5px ${unit.color}88)`;

  // Update label
  refs.label.textContent = unit.label;
  refs.label.style.color = unit.color;
  refs.label.style.borderColor = `${unit.color}55`;

  // Update glow ring colors
  for (const ring of refs.rings) {
    ring.style.borderColor = unit.color;
  }

  // Update hover animation
  const hasHover = unit.effect === "hover";
  refs.wrapper.style.animation = hasHover ? "unit-hover-bob 1.8s ease-in-out infinite" : "";
}

// ── Tracked marker data ──────────────────────────────────────────────────────
interface TrackedMarker {
  marker: maplibregl.Marker;
  elRefs: UnitElRefs;
  unitSnapshot: string; // JSON key for diffing
}

interface TrackedAnimUnit {
  marker: maplibregl.Marker;
  pts: [number, number][];
  arc: number[];
  loopMs: number;
  unit: PlacedUnit;
}

function unitKey(u: PlacedUnit): string {
  return JSON.stringify([u.id, u.color, u.label, u.unitType, u.effect, u.bearing, u.target, u.groundCircle, u.animating, u.loopMs, u.pathId]);
}

// ── Component ─────────────────────────────────────────────────────────────────
export function UnitLayer({ terrain = false, units, paths }: {
  terrain?: boolean;
  units: PlacedUnit[];
  paths: UnitPath[];
}) {
  const { current: mapRef } = useMap();
  const startRef = useRef<number | null>(null);
  const markersRef = useRef<Map<string, TrackedMarker>>(new Map());
  const layerIdsRef = useRef<string[]>([]);
  const sourceIdsRef = useRef<string[]>([]);
  const animRef = useRef<TrackedAnimUnit[]>([]);
  const unitsRef = useRef(units);
  unitsRef.current = units;

  // Main structural effect — handles creation/removal of markers & layers
  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;

    injectStyleOnce("unit-layer-css", UNIT_LAYER_CSS);

    const prevMarkers = markersRef.current;
    const nextMarkers = new Map<string, TrackedMarker>();
    const currentUnitIds = new Set(units.map(u => u.id));

    // Remove markers for units that no longer exist
    for (const [id, tracked] of prevMarkers) {
      if (!currentUnitIds.has(id)) {
        tracked.marker.remove();
        prevMarkers.delete(id);
      }
    }

    // Remove old path layers/sources
    for (const id of layerIdsRef.current) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    for (const id of sourceIdsRef.current) {
      if (map.getSource(id)) map.removeSource(id);
    }
    const newLayerIds: string[] = [];
    const newSourceIds: string[] = [];

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
      }
      if (!map.getLayer(lyrId)) {
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
      newSourceIds.push(srcId);
      newLayerIds.push(lyrId);
    }

    const newAnimUnits: TrackedAnimUnit[] = [];

    for (const unit of units) {
      const existing = prevMarkers.get(unit.id);
      const key = unitKey(unit);

      if (existing && existing.unitSnapshot === key) {
        // No change — reuse existing marker
        nextMarkers.set(unit.id, existing);
      } else if (existing) {
        // Unit changed — update DOM in place
        updateUnitEl(existing.elRefs, unit);
        existing.unitSnapshot = key;

        // Update bearing for non-animating units
        const path = unit.pathId ? pathMap.get(unit.pathId) : null;
        if (!(path && path.coordinates.length >= 2 && unit.animating)) {
          if (unit.bearing !== 0) existing.marker.setRotation(unit.bearing);
          else existing.marker.setRotation(0);
        }

        nextMarkers.set(unit.id, existing);
      } else {
        // New unit — create marker
        const { outer, refs } = makeUnitEl(unit);
        const marker = new maplibregl.Marker({
          element: outer,
          anchor: "center",
          offset: terrain ? [0, 0] : [0, 3],
          rotationAlignment: "map",
          pitchAlignment: "map",
        });

        const path = unit.pathId ? pathMap.get(unit.pathId) : null;
        if (path && path.coordinates.length >= 2 && unit.animating) {
          marker.setLngLat(path.coordinates[0]);
        } else {
          marker.setLngLat(unit.position);
          if (unit.bearing !== 0) marker.setRotation(unit.bearing);
        }
        marker.addTo(map);
        nextMarkers.set(unit.id, { marker, elRefs: refs, unitSnapshot: key });
      }

      // Build animation data
      const path = unit.pathId ? pathMap.get(unit.pathId) : null;
      if (path && path.coordinates.length >= 2 && unit.animating) {
        const tracked = nextMarkers.get(unit.id)!;
        const pts = buildSpline(path.coordinates, N_SAMPLES);
        const arc = buildArc(pts);
        newAnimUnits.push({ marker: tracked.marker, pts, arc, loopMs: unit.loopMs, unit });
      }
    }

    markersRef.current = nextMarkers;
    layerIdsRef.current = newLayerIds;
    sourceIdsRef.current = newSourceIds;
    animRef.current = newAnimUnits;

    // Ground circle layer
    const gcSrcId = "unit-ground-circles-src";
    const gcLyrId = "unit-ground-circles-lyr";

    const hasGroundCircles = units.some(u => u.groundCircle);

    // Always clean up old ground circle layer
    if (map.getLayer(gcLyrId)) map.removeLayer(gcLyrId);
    if (map.getSource(gcSrcId)) map.removeSource(gcSrcId);

    if (hasGroundCircles) {
      const features: GeoJSON.Feature[] = [];
      for (const unit of units) {
        if (!unit.groundCircle) continue;
        const coords = unit.animating && unit.pathId
          ? pathMap.get(unit.pathId)?.coordinates[0] ?? unit.position
          : unit.position;
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: coords },
          properties: { color: unit.color, id: unit.id },
        });
      }
      map.addSource(gcSrcId, { type: "geojson", data: { type: "FeatureCollection", features } });
      map.addLayer({
        id: gcLyrId,
        type: "circle",
        source: gcSrcId,
        paint: {
          "circle-radius": 20,
          "circle-color": ["get", "color"],
          "circle-opacity": 0.15,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": ["get", "color"],
          "circle-stroke-opacity": 0.5,
        },
      });
      newSourceIds.push(gcSrcId);
      newLayerIds.push(gcLyrId);
    }

    return () => {
      // Full cleanup only on unmount
      for (const [, tracked] of markersRef.current) {
        tracked.marker.remove();
      }
      markersRef.current = new Map();
      for (const id of layerIdsRef.current) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      for (const id of sourceIdsRef.current) {
        if (map.getSource(id)) map.removeSource(id);
      }
      // Clean up ground circles
      if (map.getLayer(gcLyrId)) map.removeLayer(gcLyrId);
      if (map.getSource(gcSrcId)) map.removeSource(gcSrcId);
      layerIdsRef.current = [];
      sourceIdsRef.current = [];
      animRef.current = [];
    };
  }, [mapRef, terrain, units, paths]);

  // Animation loop — separate from structural effect
  useEffect(() => {
    const m = mapRef?.getMap();
    if (!m) return;
    const mapInst: maplibregl.Map = m;

    const gcSrcId = "unit-ground-circles-src";

    function onRender() {
      const ts = performance.now();
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const anims = animRef.current;
      for (const u of anims) {
        const t = (elapsed % u.loopMs) / u.loopMs;
        const { pos, bearing } = getState(u.pts, u.arc, t, LOOK_AHEAD);
        u.marker.setLngLat(pos);
        u.marker.setRotation(bearing);
      }
      // Update ground circle positions for animating units
      const curUnits = unitsRef.current;
      const hasGC = curUnits.some(u => u.groundCircle);
      if (hasGC && anims.some(a => a.unit.groundCircle)) {
        const src = mapInst.getSource(gcSrcId) as maplibregl.GeoJSONSource | undefined;
        if (src) {
          const features: GeoJSON.Feature[] = [];
          for (const unit of curUnits) {
            if (!unit.groundCircle) continue;
            const animUnit = anims.find(a => a.unit.id === unit.id);
            const coords = animUnit
              ? [animUnit.marker.getLngLat().lng, animUnit.marker.getLngLat().lat] as [number, number]
              : unit.position;
            features.push({
              type: "Feature",
              geometry: { type: "Point", coordinates: coords },
              properties: { color: unit.color, id: unit.id },
            });
          }
          src.setData({ type: "FeatureCollection", features });
        }
      }
    }

    mapInst.on("render", onRender);
    return () => { mapInst.off("render", onRender); };
  }, [mapRef]);

  return null;
}
