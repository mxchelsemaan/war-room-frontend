import { useEffect, useMemo, useRef } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type maplibregl from "maplibre-gl";
import type { MapEvent } from "@/data/index";
import { CROSSFADE } from "@/config/map";

const HEATMAP_SOURCE = "events-heatmap";
const HEATMAP_LAYER = "events-heatmap-layer";

// Hardcoded "fire" color stops (dark / light)
const FIRE_STOPS_DARK: [number, string][] = [
  [0, "rgba(0,0,0,0)"], [0.15, "#1e3a5f"], [0.35, "#7b2d8e"],
  [0.55, "#dc2626"], [0.75, "#f97316"], [1, "#fef9c3"],
];
const FIRE_STOPS_LIGHT: [number, string][] = [
  [0, "rgba(0,0,0,0)"], [0.15, "#fecaca"], [0.35, "#f87171"],
  [0.55, "#dc2626"], [0.75, "#b91c1c"], [1, "#7f1d1d"],
];

const RADIUS = 40;
const INTENSITY = 2.5;
const OPACITY = 0.85;

/** Map severity string to heatmap weight (0-1). */
export function severityToWeight(severity?: string): number {
  switch (severity) {
    case "critical": return 1.0;
    case "major":    return 0.7;
    case "moderate": return 0.4;
    case "minor":    return 0.15;
    default:         return 0.3;
  }
}

function computeWeight(severity?: string, eventCount?: number): number {
  const sev = severityToWeight(severity);
  const count = Math.min(Math.max(eventCount ?? 1, 1), 10) / 10;
  return sev * count;
}

export function useHeatmapLayer(
  mapRef: React.RefObject<MapRef | null>,
  events: MapEvent[],
  heatmapEnabled: boolean,
  mapLoaded: number | boolean,
  terrainEnabled?: boolean,
  crossfadeEnabled: boolean = false,
  dark: boolean = true,
) {
  const geoJson = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: "FeatureCollection",
    features: events.map((e) => ({
      type: "Feature" as const,
      properties: { weight: computeWeight(e.severity, e.event_count) },
      geometry: { type: "Point" as const, coordinates: [e.event_location.lng, e.event_location.lat] },
    })),
  }), [events]);

  const geoJsonRef = useRef(geoJson);
  geoJsonRef.current = geoJson;

  const stops = dark ? FIRE_STOPS_DARK : FIRE_STOPS_LIGHT;

  // ── Create / update source + layer ──────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    const vis = heatmapEnabled ? "visible" : "none";

    const opacityExpr = crossfadeEnabled
      ? ["interpolate", ["linear"], ["zoom"], CROSSFADE.HEATMAP_FULL, OPACITY, CROSSFADE.FADE_END, 0] as unknown as maplibregl.ExpressionSpecification
      : ["interpolate", ["linear"], ["zoom"], 7, OPACITY, 14, OPACITY * 0.5] as unknown as maplibregl.ExpressionSpecification;

    if (!map.getSource(HEATMAP_SOURCE)) {
      map.addSource(HEATMAP_SOURCE, { type: "geojson", data: geoJson });

      const beforeLayer = map.getLayer("event-pulse") ? "event-pulse" : map.getLayer("event-pins") ? "event-pins" : undefined;

      map.addLayer({
        id: HEATMAP_LAYER,
        type: "heatmap",
        source: HEATMAP_SOURCE,
        layout: { visibility: vis },
        paint: {
          "heatmap-weight": ["get", "weight"] as unknown as maplibregl.ExpressionSpecification,
          "heatmap-intensity": [
            "interpolate", ["linear"], ["zoom"],
            7, INTENSITY * 0.53,
            12, INTENSITY * 1.33,
          ] as unknown as maplibregl.ExpressionSpecification,
          "heatmap-radius": [
            "interpolate", ["linear"], ["zoom"],
            7, RADIUS * 0.6,
            12, RADIUS * 1.2,
          ] as unknown as maplibregl.ExpressionSpecification,
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            ...stops.flat(),
          ] as unknown as maplibregl.ExpressionSpecification,
          "heatmap-opacity": opacityExpr,
        },
      } as maplibregl.LayerSpecification, beforeLayer);
    } else {
      (map.getSource(HEATMAP_SOURCE) as maplibregl.GeoJSONSource).setData(geoJson);
    }
  }, [geoJson, dark, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update paint when theme or crossfade changes ───────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map || !map.getLayer(HEATMAP_LAYER)) return;

    const activeStops = dark ? FIRE_STOPS_DARK : FIRE_STOPS_LIGHT;
    map.setPaintProperty(HEATMAP_LAYER, "heatmap-color", [
      "interpolate", ["linear"], ["heatmap-density"],
      ...activeStops.flat(),
    ]);

    const opacityExpr = crossfadeEnabled
      ? ["interpolate", ["linear"], ["zoom"], CROSSFADE.HEATMAP_FULL, OPACITY, CROSSFADE.FADE_END, 0]
      : ["interpolate", ["linear"], ["zoom"], 7, OPACITY, 14, OPACITY * 0.5];
    map.setPaintProperty(HEATMAP_LAYER, "heatmap-opacity", opacityExpr);
  }, [dark, crossfadeEnabled, terrainEnabled, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Visibility toggle ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map || !map.getLayer(HEATMAP_LAYER)) return;

    map.setLayoutProperty(HEATMAP_LAYER, "visibility", heatmapEnabled ? "visible" : "none");
  }, [heatmapEnabled, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps
}
