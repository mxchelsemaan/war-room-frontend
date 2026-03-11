import { useEffect, useMemo, useRef } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type maplibregl from "maplibre-gl";
import type { MapEvent } from "@/data/index";
import type { HeatmapSettings } from "@/config/map";
import { HEATMAP_COLOR_SCHEMES, HEATMAP_PRESETS, HEATMAP_GRID, CROSSFADE } from "@/config/map";
import { buildHexGeoJSON } from "@/lib/hexGrid";

const HEATMAP_SOURCE = "events-heatmap";
const HEATMAP_LAYER = "events-heatmap-layer";
const HEX_SOURCE = "events-hex-heatmap";
const HEX_LAYER = "events-hex-heatmap-layer";

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
  return Math.max(0.25, sev * count);
}

/** Compute weight from casualties (killed + injured), clamped to [0.25, 1.0] */
function computeCasualtyWeight(casualties?: { killed: number | null; injured: number | null; displaced: number | null }): number {
  if (!casualties) return 0.25;
  const total = (casualties.killed ?? 0) + (casualties.injured ?? 0);
  return Math.max(0.25, Math.min(total / 50, 1.0));
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

  // Standard heatmap GeoJSON (Surface mode)
  const geoJson = useMemo<GeoJSON.FeatureCollection>(() => {
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

  // Hex GeoJSON (Float mode)
  const hexGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    const s = settings ?? { preset: "all_events", radius: 40, intensity: 3.0, opacity: 0.85, colorScheme: "fire", drapeOnTerrain: false };
    return buildHexGeoJSON(events, s, dark);
  }, [events, settings, dark]);

  const geoJsonRef = useRef(geoJson);
  geoJsonRef.current = geoJson;

  const hexGeoJsonRef = useRef(hexGeoJson);
  hexGeoJsonRef.current = hexGeoJson;

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const isFloatMode = !(settings?.drapeOnTerrain ?? false);

  // ── Create / update source + layers ──────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    const vis = heatmapEnabled ? "visible" : "none";
    const s = settingsRef.current;
    const schemeObj = HEATMAP_COLOR_SCHEMES[s?.colorScheme ?? "fire"] ?? HEATMAP_COLOR_SCHEMES.fire;
    const stops = dark ? schemeObj.stops : schemeObj.lightStops;
    const drape = s?.drapeOnTerrain ?? false;
    const radius = (s?.radius ?? 40) * (drape ? 1.5 : 1);
    const intensity = (s?.intensity ?? 3.0) * (drape ? 0.8 : 1);
    const opacity = (s?.opacity ?? 0.85) * (drape ? 0.6 : 1);

    // ── Standard heatmap layer (Surface mode) ──
    if (!map.getSource(HEATMAP_SOURCE)) {
      map.addSource(HEATMAP_SOURCE, { type: "geojson", data: geoJson });

      const beforeLayer = map.getLayer("event-pulse") ? "event-pulse" : map.getLayer("event-pins") ? "event-pins" : undefined;

      const opacityExpr = crossfadeEnabled
        ? ["interpolate", ["linear"], ["zoom"], CROSSFADE.HEATMAP_FULL, opacity, CROSSFADE.FADE_END, 0] as unknown as maplibregl.ExpressionSpecification
        : ["interpolate", ["linear"], ["zoom"], 7, opacity, 14, opacity * 0.5] as unknown as maplibregl.ExpressionSpecification;

      map.addLayer({
        id: HEATMAP_LAYER,
        type: "heatmap",
        source: HEATMAP_SOURCE,
        layout: { visibility: drape ? vis : "none" },
        paint: {
          "heatmap-weight": ["get", "weight"] as unknown as maplibregl.ExpressionSpecification,
          "heatmap-intensity": [
            "interpolate", ["linear"], ["zoom"],
            7, intensity * 0.8,
            12, intensity * 1.5,
          ] as unknown as maplibregl.ExpressionSpecification,
          "heatmap-radius": [
            "interpolate", ["linear"], ["zoom"],
            7, radius * 1.4,
            12, radius * 1.6,
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

    // ── Hex fill-extrusion layer (Float mode) ──
    if (!map.getSource(HEX_SOURCE)) {
      map.addSource(HEX_SOURCE, { type: "geojson", data: hexGeoJson });

      map.addLayer({
        id: HEX_LAYER,
        type: "fill-extrusion",
        source: HEX_SOURCE,
        layout: { visibility: !drape ? vis : "none" },
        paint: {
          "fill-extrusion-color": ["get", "color"] as unknown as maplibregl.ExpressionSpecification,
          "fill-extrusion-base": HEATMAP_GRID.floatAltitude,
          "fill-extrusion-height": HEATMAP_GRID.floatAltitude + HEATMAP_GRID.slabThickness,
          "fill-extrusion-opacity": s?.opacity ?? 0.85,
        },
      } as maplibregl.LayerSpecification);
    } else {
      (map.getSource(HEX_SOURCE) as maplibregl.GeoJSONSource).setData(hexGeoJson);
    }
  }, [geoJson, hexGeoJson, dark, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update paint properties when settings change ───────────────────────
  useEffect(() => {
    if (!mapLoaded || !settings) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    const drape = settings.drapeOnTerrain ?? false;
    const radius = settings.radius * (drape ? 1.5 : 1);
    const opacity = settings.opacity * (drape ? 0.6 : 1);
    const intensity = settings.intensity * (drape ? 0.8 : 1);

    // Update source data for both modes
    const heatSrc = map.getSource(HEATMAP_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (heatSrc) heatSrc.setData(geoJsonRef.current);

    const hexSrc = map.getSource(HEX_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (hexSrc) hexSrc.setData(hexGeoJsonRef.current);

    // ── Surface mode paint updates ──
    if (map.getLayer(HEATMAP_LAYER)) {
      const schemeObj2 = HEATMAP_COLOR_SCHEMES[settings.colorScheme] ?? HEATMAP_COLOR_SCHEMES.fire;
      const activeStops = dark ? schemeObj2.stops : schemeObj2.lightStops;

      map.setPaintProperty(HEATMAP_LAYER, "heatmap-intensity", [
        "interpolate", ["linear"], ["zoom"],
        7, intensity * 0.8,
        12, intensity * 1.5,
      ]);
      map.setPaintProperty(HEATMAP_LAYER, "heatmap-radius", [
        "interpolate", ["linear"], ["zoom"],
        7, radius * 1.4,
        12, radius * 1.6,
      ]);
      const opacityExpr = crossfadeEnabled
        ? ["interpolate", ["linear"], ["zoom"], CROSSFADE.HEATMAP_FULL, opacity, CROSSFADE.FADE_END, 0]
        : ["interpolate", ["linear"], ["zoom"], 7, opacity, 14, opacity * 0.5];
      map.setPaintProperty(HEATMAP_LAYER, "heatmap-opacity", opacityExpr);
      map.setPaintProperty(HEATMAP_LAYER, "heatmap-color", [
        "interpolate", ["linear"], ["heatmap-density"],
        ...activeStops.flat(),
      ]);
    }

    // ── Float mode paint updates ──
    if (map.getLayer(HEX_LAYER)) {
      map.setPaintProperty(HEX_LAYER, "fill-extrusion-opacity", settings.opacity);
    }
  }, [settings, terrainEnabled, crossfadeEnabled, dark, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Visibility toggle ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    const drape = settings?.drapeOnTerrain ?? false;

    if (map.getLayer(HEATMAP_LAYER)) {
      map.setLayoutProperty(HEATMAP_LAYER, "visibility", heatmapEnabled && drape ? "visible" : "none");
    }
    if (map.getLayer(HEX_LAYER)) {
      map.setLayoutProperty(HEX_LAYER, "visibility", heatmapEnabled && !drape ? "visible" : "none");
    }
  }, [heatmapEnabled, isFloatMode, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps
}
