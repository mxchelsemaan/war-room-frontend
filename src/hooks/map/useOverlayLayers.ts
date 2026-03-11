import { useEffect } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type { LayerVisibility } from "@/components/atlas/MapLayerControls";
import { frontLines, territoryZones } from "@/data/overlays";
import { GOVERNORATE_GEOJSON, SUBGOVERNORATE_GEOJSON, GOV_LABELS_GEOJSON, SUBGOV_LABELS_GEOJSON } from "@/data/governorates";
import { GEO_LABELS_GEOJSON } from "@/data/geoLabels";
import { FACTION_COLORS } from "@/config/map";
import { ensureLayers } from "@/lib/mapUtils";

// MapLibre match expression: faction → color
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FACTION_COLOR: any = ["match", ["get", "faction"], "idf", FACTION_COLORS.idf, "hezbollah", FACTION_COLORS.hezbollah, FACTION_COLORS.unknown];

export function useOverlayLayers(
  mapRef: React.RefObject<MapRef | null>,
  layers: LayerVisibility,
  mapLoaded: number | boolean,
) {
  // ── Governorate polygons ──────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    ensureLayers(map, "gov-src", { type: "geojson", data: GOVERNORATE_GEOJSON }, [
      { id: "gov-fill", type: "fill", source: "gov-src",
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0.35 } },
      { id: "gov-border", type: "line", source: "gov-src",
        paint: { "line-color": "#1a1a2e", "line-width": 2.5, "line-opacity": 0.9 } },
    ], layers.governorates);
    // Governorate labels (native symbol layer)
    ensureLayers(map, "gov-labels-src", { type: "geojson", data: GOV_LABELS_GEOJSON }, [
      {
        id: "gov-labels", type: "symbol", source: "gov-labels-src",
        layout: {
          "text-field": ["upcase", ["get", "nameEn"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": 14,
          "text-letter-spacing": 0.05,
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "rgb(101,101,101)",
          "text-halo-color": "rgba(0,0,0,0.7)",
          "text-halo-width": 1.5,
        },
      },
    ], layers.governorates);
  }, [layers.governorates, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sub-governorate (district) polygons ──────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    ensureLayers(map, "subgov-src", { type: "geojson", data: SUBGOVERNORATE_GEOJSON }, [
      { id: "subgov-fill", type: "fill", source: "subgov-src",
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0.18 } },
      { id: "subgov-border", type: "line", source: "subgov-src",
        paint: { "line-color": "#1a1a2e", "line-width": 1.2, "line-opacity": 0.5, "line-dasharray": [4, 2] } },
    ], layers.subgovernorates);
    // Subgovernorate labels (native symbol layer)
    ensureLayers(map, "subgov-labels-src", { type: "geojson", data: SUBGOV_LABELS_GEOJSON }, [
      {
        id: "subgov-labels", type: "symbol", source: "subgov-labels-src",
        layout: {
          "text-field": ["upcase", ["get", "nameEn"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": 10,
          "text-letter-spacing": 0.05,
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "rgb(101,101,101)",
          "text-halo-color": "rgba(0,0,0,0.7)",
          "text-halo-width": 1.2,
        },
      },
    ], layers.subgovernorates);
  }, [layers.subgovernorates, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Territory zones ───────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    ensureLayers(map, "tz-src", { type: "geojson", data: territoryZones }, [
      { id: "tz-fill", type: "fill", source: "tz-src",
        paint: { "fill-color": FACTION_COLOR, "fill-opacity": ["match", ["get", "faction"], "idf", 0.125, "hezbollah", 0.078, 0.06] } },
      { id: "tz-glow-outer", type: "line", source: "tz-src",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": FACTION_COLOR, "line-width": 14, "line-opacity": 0.04, "line-blur": 6 } },
      { id: "tz-glow-inner", type: "line", source: "tz-src",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": FACTION_COLOR, "line-width": 5, "line-opacity": 0.12, "line-blur": 2 } },
      { id: "tz-edge", type: "line", source: "tz-src",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": FACTION_COLOR, "line-width": 1.5, "line-opacity": 0.627 } },
    ], layers.territory);
  }, [layers.territory, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Front lines ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    ensureLayers(map, "fl-src", { type: "geojson", data: frontLines }, [
      { id: "fl-glow-outer", type: "line", source: "fl-src",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ef4444", "line-width": 12, "line-opacity": 0.04, "line-blur": 5 } },
      { id: "fl-glow-inner", type: "line", source: "fl-src",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ef4444", "line-width": 5, "line-opacity": 0.2, "line-blur": 2 } },
      { id: "fl-main", type: "line", source: "fl-src",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ff5858", "line-width": 2, "line-opacity": 0.784 } },
    ], layers.frontLines);
  }, [layers.frontLines, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Geographic labels ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    ensureLayers(map, "geo-labels", { type: "geojson", data: GEO_LABELS_GEOJSON }, [
      {
        id: "geo-labels-symbols",
        type: "symbol",
        source: "geo-labels",
        layout: {
          "text-field": [
            "case", ["has", "elevation"],
            ["concat", ["get", "name"], "\n", ["get", "elevation"], "m"],
            ["get", "name"],
          ],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 7, 10, 10, 13, 14, 15],
          "text-letter-spacing": 0.05,
          "text-allow-overlap": false,
          "text-optional": true,
          "text-padding": 8,
        },
        paint: {
          "text-color": [
            "match", ["get", "type"],
            "mountain", "#a3a3a3",
            "forest",   "#4ade80",
            "lake",     "#38bdf8",
            "valley",   "#d4d4a8",
            "plain",    "#d4d4a8",
            "cape",     "#93c5fd",
            "river_source", "#7dd3fc",
            "#a3a3a3",
          ],
          "text-halo-color": "#060e1a",
          "text-halo-width": 1.5,
          "text-opacity": ["interpolate", ["linear"], ["zoom"], 7, 0.6, 10, 0.9],
        },
      },
    ], layers.geoLabels);
  }, [layers.geoLabels, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps
}
