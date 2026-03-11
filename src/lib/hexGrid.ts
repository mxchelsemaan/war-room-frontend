/**
 * Hex grid generation for floating 3D heatmap mode.
 * Flat-top hexagons covering Lebanon, aggregating event weights into cells.
 */

import type { MapEvent } from "@/data/index";
import type { HeatmapSettings } from "@/config/map";
import { HEATMAP_COLOR_SCHEMES, HEATMAP_PRESETS, HEATMAP_GRID } from "@/config/map";

const DEG_PER_KM_LNG = (lat: number) => 1 / (111.32 * Math.cos((lat * Math.PI) / 180));
const DEG_PER_KM_LAT = 1 / 110.574;

interface HexCenter {
  lng: number;
  lat: number;
}

/** Generate flat-top hex centers covering the configured bounding box */
function generateHexGrid(): HexCenter[] {
  const { bounds, cellSizeKm } = HEATMAP_GRID;
  const midLat = (bounds.south + bounds.north) / 2;
  const dLng = cellSizeKm * DEG_PER_KM_LNG(midLat);
  const dLat = cellSizeKm * DEG_PER_KM_LAT;

  const colStep = dLng * 1.5;       // flat-top horizontal spacing
  const rowStep = dLat * Math.sqrt(3); // vertical spacing

  const centers: HexCenter[] = [];
  let col = 0;
  for (let lng = bounds.west; lng <= bounds.east; lng += colStep, col++) {
    const rowOffset = col % 2 === 0 ? 0 : rowStep / 2;
    for (let lat = bounds.south + rowOffset; lat <= bounds.north; lat += rowStep) {
      centers.push({ lng, lat });
    }
  }
  return centers;
}

/** Build a 6-vertex flat-top hex polygon */
function hexPolygon(cLng: number, cLat: number, radiusKm: number): [number, number][] {
  const rLng = radiusKm * DEG_PER_KM_LNG(cLat);
  const rLat = radiusKm * DEG_PER_KM_LAT;
  const coords: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    coords.push([cLng + rLng * Math.cos(angle), cLat + rLat * Math.sin(angle)]);
  }
  coords.push(coords[0]); // close ring
  return coords;
}

/** Assign each event to nearest hex, summing weights. O(N*M) but N~200 events, M~1200 hexes. */
function assignPointsToHexes(
  events: MapEvent[],
  hexCenters: HexCenter[],
  weightFn: (e: MapEvent) => number,
): Map<number, number> {
  const weights = new Map<number, number>();
  for (const event of events) {
    const { lng, lat } = event.event_location;
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < hexCenters.length; i++) {
      const dx = lng - hexCenters[i].lng;
      const dy = lat - hexCenters[i].lat;
      const d = dx * dx + dy * dy;
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    weights.set(bestIdx, (weights.get(bestIdx) ?? 0) + weightFn(event));
  }
  return weights;
}

/** Interpolate a color from scheme stops at normalized value t ∈ [0,1] */
function interpolateColor(stops: [number, string][], t: number): string {
  const solid = stops.filter(([, c]) => !c.includes("rgba"));
  if (solid.length === 0) return "#000000";
  if (t <= solid[0][0]) return solid[0][1];
  if (t >= solid[solid.length - 1][0]) return solid[solid.length - 1][1];

  for (let i = 0; i < solid.length - 1; i++) {
    const [d0, c0] = solid[i];
    const [d1, c1] = solid[i + 1];
    if (t >= d0 && t <= d1) {
      const frac = (t - d0) / (d1 - d0);
      return lerpHex(c0, c1, frac);
    }
  }
  return solid[solid.length - 1][1];
}

function lerpHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = parseHex(a);
  const [r2, g2, b2] = parseHex(b);
  return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

/** Build weight function matching the preset's strategy */
function makeWeightFn(strategy: "severity" | "casualties" | "density"): (e: MapEvent) => number {
  switch (strategy) {
    case "severity":
      return (e) => {
        let sev: number;
        switch (e.severity) {
          case "critical": sev = 1.0; break;
          case "major":    sev = 0.7; break;
          case "moderate": sev = 0.4; break;
          case "minor":    sev = 0.15; break;
          default:         sev = 0.3;
        }
        const count = Math.min(Math.max(e.event_count ?? 1, 1), 10) / 10;
        return Math.max(0.25, sev * count);
      };
    case "casualties":
      return (e) => {
        if (!e.casualties) return 0.25;
        const total = (e.casualties.killed ?? 0) + (e.casualties.injured ?? 0);
        return Math.max(0.25, Math.min(total / 50, 1.0));
      };
    case "density":
      return () => 1.0;
  }
}

/** Build complete hex grid GeoJSON for the floating fill-extrusion heatmap */
export function buildHexGeoJSON(
  events: MapEvent[],
  settings: HeatmapSettings,
  dark: boolean,
): GeoJSON.FeatureCollection {
  const preset = HEATMAP_PRESETS[settings.preset] ?? HEATMAP_PRESETS.all_events;
  const schemeObj = HEATMAP_COLOR_SCHEMES[settings.colorScheme] ?? HEATMAP_COLOR_SCHEMES.fire;
  const stops = dark ? schemeObj.stops : schemeObj.lightStops;

  const filtered = preset.eventTypeFilter
    ? events.filter((e) => preset.eventTypeFilter!.includes(e.event_type))
    : events;

  const weightFn = makeWeightFn(preset.weightStrategy);
  const hexCenters = generateHexGrid();
  const weights = assignPointsToHexes(filtered, hexCenters, weightFn);

  if (weights.size === 0) {
    return { type: "FeatureCollection", features: [] };
  }

  let maxWeight = 0;
  for (const w of weights.values()) if (w > maxWeight) maxWeight = w;
  if (maxWeight === 0) maxWeight = 1;

  const features: GeoJSON.Feature[] = [];
  for (const [idx, weight] of weights) {
    const center = hexCenters[idx];
    const normalized = Math.min(weight / maxWeight, 1);
    const color = interpolateColor(stops, normalized);
    const coords = hexPolygon(center.lng, center.lat, HEATMAP_GRID.cellSizeKm * 0.95);
    features.push({
      type: "Feature",
      properties: { color, weight: normalized },
      geometry: { type: "Polygon", coordinates: [coords] },
    });
  }

  return { type: "FeatureCollection", features };
}
