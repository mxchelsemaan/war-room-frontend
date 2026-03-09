import { useEffect, useMemo, useRef } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type maplibregl from "maplibre-gl";
import type { MapEvent } from "@/data/index";

const HEATMAP_SOURCE = "events-heatmap";
const HEATMAP_LAYER = "events-heatmap-layer";

/** Map severity string → heatmap weight (0–1). */
export function severityToWeight(severity?: string): number {
  switch (severity) {
    case "critical": return 1.0;
    case "major":    return 0.7;
    case "moderate": return 0.4;
    case "minor":    return 0.15;
    default:         return 0.3;
  }
}

export function useHeatmapLayer(
  mapRef: React.RefObject<MapRef | null>,
  events: MapEvent[],
  heatmapEnabled: boolean,
  mapLoaded: boolean,
) {
  const geoJson = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: "FeatureCollection",
    features: events.map((e) => ({
      type: "Feature" as const,
      properties: { weight: severityToWeight(e.severity) },
      geometry: { type: "Point" as const, coordinates: [e.event_location.lng, e.event_location.lat] },
    })),
  }), [events]);

  const geoJsonRef = useRef(geoJson);
  geoJsonRef.current = geoJson;

  // ── Create / update source + layer ────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    const vis = heatmapEnabled ? "visible" : "none";

    if (!map.getSource(HEATMAP_SOURCE)) {
      map.addSource(HEATMAP_SOURCE, {
        type: "geojson",
        data: geoJson,
      });

      // Insert below event-cluster-shadow so markers render on top
      const beforeLayer = map.getLayer("event-cluster-shadow") ? "event-cluster-shadow" : undefined;

      map.addLayer({
        id: HEATMAP_LAYER,
        type: "heatmap",
        source: HEATMAP_SOURCE,
        layout: { visibility: vis },
        paint: {
          "heatmap-weight": ["get", "weight"] as unknown as maplibregl.ExpressionSpecification,
          "heatmap-intensity": [
            "interpolate", ["linear"], ["zoom"],
            7, 0.8,
            12, 2,
          ] as unknown as maplibregl.ExpressionSpecification,
          "heatmap-radius": [
            "interpolate", ["linear"], ["zoom"],
            7, 15,
            12, 30,
          ] as unknown as maplibregl.ExpressionSpecification,
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0,   "rgba(0,0,0,0)",
            0.15, "#1e3a5f",
            0.35, "#7b2d8e",
            0.55, "#dc2626",
            0.75, "#f97316",
            1,    "#fef9c3",
          ] as unknown as maplibregl.ExpressionSpecification,
          "heatmap-opacity": [
            "interpolate", ["linear"], ["zoom"],
            7, 0.6,
            14, 0.3,
          ] as unknown as maplibregl.ExpressionSpecification,
        },
      } as maplibregl.LayerSpecification, beforeLayer);
    } else {
      (map.getSource(HEATMAP_SOURCE) as maplibregl.GeoJSONSource).setData(geoJson);
    }
  }, [geoJson, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Visibility toggle ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (map.getLayer(HEATMAP_LAYER)) {
      map.setLayoutProperty(HEATMAP_LAYER, "visibility", heatmapEnabled ? "visible" : "none");
    }
  }, [heatmapEnabled, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps
}
