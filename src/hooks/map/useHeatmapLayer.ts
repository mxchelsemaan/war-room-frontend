import { useEffect, useMemo, useRef } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type maplibregl from "maplibre-gl";
import type { MapEvent } from "@/data/index";
import type { HeatmapSettings } from "@/config/map";
import { HEATMAP_COLOR_SCHEMES, HEATMAP_PRESETS, CROSSFADE } from "@/config/map";

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

/** Combine severity weight with event_count for better heatmap weighting */
function computeWeight(severity?: string, eventCount?: number): number {
  const sev = severityToWeight(severity);
  const count = Math.min(Math.max(eventCount ?? 1, 1), 10) / 10;
  return sev * count;
}

/** Compute weight from casualties (killed + injured), clamped to [0.05, 1.0] */
function computeCasualtyWeight(casualties?: { killed: number | null; injured: number | null; displaced: number | null }): number {
  if (!casualties) return 0.05;
  const total = (casualties.killed ?? 0) + (casualties.injured ?? 0);
  return Math.max(0.05, Math.min(total / 50, 1.0));
}

/** Dispatch weight computation based on strategy */
function computeWeightForStrategy(
  strategy: "severity" | "casualties" | "density",
  event: MapEvent,
): number {
  switch (strategy) {
    case "severity":   return computeWeight(event.severity, event.event_count);
    case "casualties": return computeCasualtyWeight(event.casualties);
    case "density":    return 1.0;
  }
}

export function useHeatmapLayer(
  mapRef: React.RefObject<MapRef | null>,
  events: MapEvent[],
  heatmapEnabled: boolean,
  mapLoaded: number | boolean,
  settings?: HeatmapSettings,
  terrainEnabled?: boolean,
  crossfadeEnabled: boolean = false,
  dark: boolean = true,
) {
  const preset = HEATMAP_PRESETS[settings?.preset ?? "all_events"] ?? HEATMAP_PRESETS.all_events;

  const geoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    // Filter events by preset's event type filter
    const filtered = preset.eventTypeFilter
      ? events.filter((e) => preset.eventTypeFilter!.includes(e.event_type))
      : events;

    return {
      type: "FeatureCollection",
      features: filtered.map((e) => ({
        type: "Feature" as const,
        properties: { weight: computeWeightForStrategy(preset.weightStrategy, e) },
        geometry: { type: "Point" as const, coordinates: [e.event_location.lng, e.event_location.lat] },
      })),
    };
  }, [events, preset]);

  const geoJsonRef = useRef(geoJson);
  geoJsonRef.current = geoJson;

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // ── Create / update source + layer ────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    const vis = heatmapEnabled ? "visible" : "none";
    const s = settingsRef.current;
    const schemeObj = HEATMAP_COLOR_SCHEMES[s?.colorScheme ?? "fire"] ?? HEATMAP_COLOR_SCHEMES.fire;
    const stops = dark ? schemeObj.stops : schemeObj.lightStops;
    const drape = s?.drapeOnTerrain ?? false;
    const radius = (s?.radius ?? 25) * (drape ? 1.5 : 1);
    const intensity = (s?.intensity ?? 1.5) * (drape ? 0.8 : 1);
    const opacity = (s?.opacity ?? 0.6) * (drape ? 0.6 : 1);

    if (!map.getSource(HEATMAP_SOURCE)) {
      map.addSource(HEATMAP_SOURCE, {
        type: "geojson",
        data: geoJson,
      });

      // Insert below event pins so markers render on top
      const beforeLayer = map.getLayer("event-pulse") ? "event-pulse" : map.getLayer("event-pins") ? "event-pins" : undefined;

      const opacityExpr = crossfadeEnabled
        ? ["interpolate", ["linear"], ["zoom"], CROSSFADE.HEATMAP_FULL, opacity, CROSSFADE.FADE_END, 0] as unknown as maplibregl.ExpressionSpecification
        : ["interpolate", ["linear"], ["zoom"], 7, opacity, 14, opacity * 0.5] as unknown as maplibregl.ExpressionSpecification;

      map.addLayer({
        id: HEATMAP_LAYER,
        type: "heatmap",
        source: HEATMAP_SOURCE,
        layout: { visibility: vis },
        paint: {
          "heatmap-weight": ["get", "weight"] as unknown as maplibregl.ExpressionSpecification,
          "heatmap-intensity": [
            "interpolate", ["linear"], ["zoom"],
            7, intensity * 0.53,
            12, intensity * 1.33,
          ] as unknown as maplibregl.ExpressionSpecification,
          "heatmap-radius": [
            "interpolate", ["linear"], ["zoom"],
            7, radius * 0.6,
            12, radius * 1.2,
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

  // ── Update paint properties when settings change ───────────────────────
  useEffect(() => {
    if (!mapLoaded || !settings) return;
    const map = mapRef.current?.getMap();
    if (!map || !map.getLayer(HEATMAP_LAYER)) return;

    const schemeObj2 = HEATMAP_COLOR_SCHEMES[settings.colorScheme] ?? HEATMAP_COLOR_SCHEMES.fire;
    const activeStops = dark ? schemeObj2.stops : schemeObj2.lightStops;
    const drape = settings.drapeOnTerrain ?? false;
    const radius = settings.radius * (drape ? 1.5 : 1);
    const opacity = settings.opacity * (drape ? 0.6 : 1);

    // Also update the source data when preset changes (filtering/weighting)
    const src = map.getSource(HEATMAP_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(geoJsonRef.current);

    const intensity = settings.intensity * (drape ? 0.8 : 1);
    map.setPaintProperty(HEATMAP_LAYER, "heatmap-intensity", [
      "interpolate", ["linear"], ["zoom"],
      7, intensity * 0.53,
      12, intensity * 1.33,
    ]);
    map.setPaintProperty(HEATMAP_LAYER, "heatmap-radius", [
      "interpolate", ["linear"], ["zoom"],
      7, radius * 0.6,
      12, radius * 1.2,
    ]);
    const opacityExpr = crossfadeEnabled
      ? ["interpolate", ["linear"], ["zoom"], CROSSFADE.HEATMAP_FULL, opacity, CROSSFADE.FADE_END, 0]
      : ["interpolate", ["linear"], ["zoom"], 7, opacity, 14, opacity * 0.5];
    map.setPaintProperty(HEATMAP_LAYER, "heatmap-opacity", opacityExpr);
    map.setPaintProperty(HEATMAP_LAYER, "heatmap-color", [
      "interpolate", ["linear"], ["heatmap-density"],
      ...activeStops.flat(),
    ]);
  }, [settings, terrainEnabled, crossfadeEnabled, dark, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

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
