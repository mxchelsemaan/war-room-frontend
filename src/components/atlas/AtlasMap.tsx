import maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import { Map, Marker, Popup, AttributionControl } from "react-map-gl/maplibre";
import { DrawingLayers } from "./DrawingLayers";
import { FloatAnnotationOverlay } from "./FloatAnnotationOverlay";
import type { MapEvent } from "@/data/index";
import type { LayerVisibility } from "./MapLayerControls";
import type { Annotation, AnnotationType, ArrowStyle } from "@/hooks/useDrawing";
import type { PlacedUnit, UnitPath, NATOUnitType } from "@/types/units";
import { UnitLayer } from "./UnitLayer";
import { FlightLayer } from "./FlightLayer";
import { ShipLayer } from "./ShipLayer";
import { frontLines, territoryZones, LEBANON_RIVERS } from "@/data/overlays";
import { staticMarkers, STATIC_MARKER_COLORS } from "@/data/staticMarkers";
import type { StaticMarker, StaticMarkerType } from "@/data/staticMarkers";
import { GOVERNORATES, GOVERNORATE_GEOJSON } from "@/data/governorates";
import { GEO_LABELS_GEOJSON } from "@/data/geoLabels";

try {
  maplibregl.setRTLTextPlugin(
    "https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js",
    true
  );
} catch { /* already set (HMR) */ }

export const DEFAULT_VIEW = { longitude: 35.5018, latitude: 33.8938, zoom: 9, pitch: 0, bearing: 0 } as const;
// No maxBounds — let the map show surrounding countries

// ── Event cluster layer IDs ──────────────────────────────────────────────────
const EVENT_CLUSTER_LAYERS = [
  "event-cluster-shadow", "event-clusters", "event-cluster-count",
  "event-unclustered-bg", "event-unclustered", "event-unclustered-badge",
] as const;

/** Render each unique emoji to a canvas and register as a MapLibre image */
function registerEmojiImages(map: maplibregl.Map, emojis: string[]) {
  for (const emoji of emojis) {
    const key = `emoji-${emoji}`;
    if (map.hasImage(key)) continue;
    const size = 40;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.font = `${size * 0.65}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, size / 2, size / 2);
    map.addImage(key, { width: size, height: size, data: ctx.getImageData(0, 0, size, size).data });
  }
}

// River shimmer — animated dasharray sequence
const DASH_SEQ = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5],
  [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
  [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5],
  [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5],
];

// MapLibre match expression: faction → color
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FACTION_COLOR: any = ["match", ["get", "faction"], "idf", "#dc2626", "hezbollah", "#f59e0b", "#808080"];

interface AtlasMapProps {
  events: MapEvent[];
  layers: LayerVisibility;
  selectedInfraTypes: Set<StaticMarkerType>;
  annotations: Annotation[];
  drawingMode: AnnotationType | null;
  drawingColor?: string;
  tempDrawingCoords: [number, number][];
  onMapClick: (lngLat: [number, number]) => void;
  onMapDblClick: (lngLat: [number, number]) => void;
  onDeleteAnnotation: (id: string) => void;
  externalMapRef?: React.RefObject<MapRef | null>;
  previewWidth?: number;
  previewArrowStyle?: ArrowStyle;
  dark?: boolean;
  placedUnits?: PlacedUnit[];
  unitPaths?: UnitPath[];
  placementMode?: NATOUnitType | null;
  pathDrawingUnitId?: string | null;
  onPlaceUnit?: (lngLat: [number, number]) => void;
  onAddPathWaypoint?: (lngLat: [number, number]) => void;
  onFinishPath?: () => void;
  onSelectAnnotation?: (id: string) => void;
}

/** Helper: add source + layers if not present, otherwise toggle visibility */
function ensureLayers(
  map: maplibregl.Map,
  sourceId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sourceSpec: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layerSpecs: any[],
  visible: boolean,
) {
  const vis = visible ? "visible" : "none";
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, sourceSpec);
  }
  if (!map.getLayer(layerSpecs[0].id)) {
    for (const spec of layerSpecs) {
      map.addLayer({ ...spec, layout: { ...spec.layout, visibility: vis } });
    }
  } else {
    for (const spec of layerSpecs) {
      map.setLayoutProperty(spec.id, "visibility", vis);
    }
  }
}

export function AtlasMap({
  events, layers, selectedInfraTypes,
  annotations, drawingMode, drawingColor, tempDrawingCoords,
  onMapClick, onMapDblClick, onDeleteAnnotation, onSelectAnnotation,
  externalMapRef,
  previewWidth = 2, previewArrowStyle = "simple",
  dark = true,
  placedUnits, unitPaths, placementMode, pathDrawingUnitId,
  onPlaceUnit, onAddPathWaypoint, onFinishPath,
}: AtlasMapProps) {
  const internalMapRef = useRef<MapRef>(null);
  const mapRef = (externalMapRef ?? internalMapRef) as React.RefObject<MapRef>;
  const animRef   = useRef<number | null>(null);
  const riverStep = useRef(0);
  const lastRiver = useRef(0);
  const lastGlow  = useRef(0);
  const lastSky   = useRef(0);

  const layersRef = useRef(layers);
  const eventsRef = useRef(events);
  layersRef.current = layers;
  eventsRef.current = events;

  const [mapLoaded, setMapLoaded] = useState(false);
  const [popupEvent, setPopupEvent] = useState<MapEvent | null>(null);
  const [popupInfra, setPopupInfra] = useState<StaticMarker | null>(null);
  const [popupAnnotation, setPopupAnnotation] = useState<{ annotation: Annotation; lngLat: [number, number] } | null>(null);

  const drawingModeRef = useRef(drawingMode);
  drawingModeRef.current = drawingMode;
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const onMapDblClickRef = useRef(onMapDblClick);
  onMapDblClickRef.current = onMapDblClick;
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;

  const placementModeRef = useRef(placementMode ?? null);
  placementModeRef.current = placementMode ?? null;
  const pathDrawingUnitIdRef = useRef(pathDrawingUnitId ?? null);
  pathDrawingUnitIdRef.current = pathDrawingUnitId ?? null;
  const onPlaceUnitRef = useRef(onPlaceUnit);
  onPlaceUnitRef.current = onPlaceUnit;
  const onAddWaypointRef = useRef(onAddPathWaypoint);
  onAddWaypointRef.current = onAddPathWaypoint;
  const onFinishPathRef = useRef(onFinishPath);
  onFinishPathRef.current = onFinishPath;

  // ── Animation loop (river dash + glow pulse) ────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;

    function frame(ts: number) {
      const m = mapRef.current?.getMap();
      if (!m) { animRef.current = requestAnimationFrame(frame); return; }

      // River dash animation
      if (layersRef.current.rivers && ts - lastRiver.current > 80) {
        riverStep.current = (riverStep.current + 1) % DASH_SEQ.length;
        const dash = DASH_SEQ[riverStep.current];
        if (m.getLayer("river-flow"))     m.setPaintProperty("river-flow",     "line-dasharray", dash);
        if (m.getLayer("river-geo-flow")) m.setPaintProperty("river-geo-flow", "line-dasharray", dash);
        lastRiver.current = ts;
      }

      // Glow pulse animation (~30fps)
      if (ts - lastGlow.current > 33) {
        const glowT = Math.sin((ts / 1250) * Math.PI) * 0.5 + 0.5;
        if (layersRef.current.territory) {
          if (m.getLayer("tz-glow-outer")) m.setPaintProperty("tz-glow-outer", "line-opacity", 0.016 + glowT * 0.078);
          if (m.getLayer("tz-glow-inner")) m.setPaintProperty("tz-glow-inner", "line-opacity", 0.078 + glowT * 0.138);
        }
        if (layersRef.current.frontLines) {
          if (m.getLayer("fl-glow-outer")) m.setPaintProperty("fl-glow-outer", "line-opacity", 0.020 + glowT * 0.086);
          if (m.getLayer("fl-glow-inner")) m.setPaintProperty("fl-glow-inner", "line-opacity", 0.149 + glowT * 0.204);
        }
        lastGlow.current = ts;
      }

      // Sky cloud shimmer — very slow drift of atmosphere-blend + horizon brightness (~6fps)
      if (layersRef.current.terrain && ts - lastSky.current > 160) {
        // Two independent sine waves at different periods give irregular cloud-light variation
        const s1 = Math.sin((ts / 18000) * Math.PI * 2);       // ~18 s cycle
        const s2 = Math.sin((ts /  7300) * Math.PI * 2 + 1.4); //  ~7 s offset cycle
        const drift = (s1 * 0.6 + s2 * 0.4) * 0.5 + 0.5;       // 0..1, weighted mix
        // atmosphere-blend: 0.62 (light cloud) → 0.82 (thick overcast)
        const atmo = 0.62 + drift * 0.20;
        // horizon brightens slightly as light diffuses through cloud cover
        const hBright = Math.round(200 + drift * 20);
        const hColor = `rgb(${hBright},${Math.round(hBright * 0.97)},${Math.round(hBright * 0.94)})`;
        m.setSky({
          "sky-color":        "#8fa4b5",
          "horizon-color":    hColor,
          "fog-color":        "#c4ae88",
          "fog-ground-blend": 0.38,
          "horizon-fog-blend":0.55,
          "sky-horizon-blend":0.42,
          "atmosphere-blend": atmo,
        });
        lastSky.current = ts;
      }

      animRef.current = requestAnimationFrame(frame);
    }

    animRef.current = requestAnimationFrame(frame);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [mapLoaded]);

  // ── Terrain ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (!map.getSource("terrain-dem")) {
      map.addSource("terrain-dem", {
        type: "raster-dem",
        tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
        tileSize: 256, encoding: "terrarium",
      });
    }
    if (layers.terrain) {
      map.setTerrain({ source: "terrain-dem", exaggeration: 5.0 });
      map.easeTo({ pitch: 65, duration: 600 });
      // Initial sky — animation loop drifts atmosphere-blend for a cloudy shimmer
      map.setSky({
        "sky-color":        "#8fa4b5",
        "horizon-color":    "#cad6de",
        "fog-color":        "#c4ae88",
        "fog-ground-blend": 0.38,
        "horizon-fog-blend":0.55,
        "sky-horizon-blend":0.42,
        "atmosphere-blend": 0.72,
      });
    } else {
      map.setTerrain(null);
      map.easeTo({ pitch: 0, duration: 600 });
      map.setSky(null as unknown as maplibregl.SkySpecification);
    }
  }, [layers.terrain, mapLoaded]);

  // ── Terrain camera collision prevention ───────────────────────────────────
  // With 5× exaggeration Lebanon peaks look ~15 000 m tall visually.
  // At high pitch the camera must be further out (lower zoom) to stay above terrain.
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    function maxZoomForPitch(pitch: number): number {
      if (pitch < 30) return 14;
      if (pitch < 45) return 13;
      if (pitch < 60) return 12;
      if (pitch < 75) return 11;
      return 10;
    }

    function applyZoomLimit() {
      const maxZ = maxZoomForPitch(map!.getPitch());
      map!.setMaxZoom(maxZ);
      if (map!.getZoom() > maxZ) map!.easeTo({ zoom: maxZ, duration: 200 });
    }

    if (layers.terrain) {
      applyZoomLimit();
      map.on("pitch", applyZoomLimit);
      return () => { map.off("pitch", applyZoomLimit); };
    } else {
      map.setMaxZoom(14);
    }
  }, [layers.terrain, mapLoaded]);

  // ── Hillshade ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (!map.getSource("hillshade-dem")) {
      map.addSource("hillshade-dem", {
        type: "raster-dem",
        tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
        tileSize: 256, encoding: "terrarium",
      });
    }
    if (!map.getLayer("hillshade-layer")) {
      const firstLayerId = map.getStyle().layers?.[0]?.id;
      map.addLayer({
        id: "hillshade-layer", type: "hillshade", source: "hillshade-dem",
        paint: {
          "hillshade-exaggeration": 0.8,
          "hillshade-illumination-direction": 315,
          "hillshade-shadow-color": "#0a0a1a",
          "hillshade-highlight-color": "#d4c8a0",
          "hillshade-accent-color": "#2a1f0a",
        },
        layout: { visibility: layers.hillshade ? "visible" : "none" },
      }, firstLayerId);
    } else {
      map.setLayoutProperty("hillshade-layer", "visibility", layers.hillshade ? "visible" : "none");
    }
  }, [layers.hillshade, mapLoaded]);

  // ── Governorate polygons ────────────────────────────────────────────────
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
  }, [layers.governorates, mapLoaded]);

  // ── Territory zones ─────────────────────────────────────────────────────
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
  }, [layers.territory, mapLoaded]);

  // ── Front lines ─────────────────────────────────────────────────────────
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
  }, [layers.frontLines, mapLoaded]);

  // ── GeoJSON rivers (fallback at all zoom levels) ─────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    // GeoJSON rivers: zoom-8 fallback only (VT rivers take over at zoom 9)
    ensureLayers(map, "river-geojson", { type: "geojson", data: LEBANON_RIVERS }, [
      { id: "river-geo-glow", type: "line", source: "river-geojson", maxzoom: 9,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#0c3d6b", "line-width": 6, "line-opacity": 0.5, "line-blur": 3 } },
      { id: "river-geo-main", type: "line", source: "river-geojson", maxzoom: 9,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#38bdf8", "line-width": 2, "line-opacity": 0.75 } },
      { id: "river-geo-flow", type: "line", source: "river-geojson", maxzoom: 9,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#bae6fd", "line-width": 1, "line-opacity": 0.55, "line-dasharray": DASH_SEQ[0] } },
      { id: "river-geo-label", type: "symbol", source: "river-geojson", maxzoom: 9,
        layout: {
          "symbol-placement": "line",
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 10,
          "text-max-angle": 30,
          "text-letter-spacing": 0.08,
          "text-offset": [0, -1],
          "symbol-spacing": 300,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: { "text-color": "#7dd3fc", "text-halo-color": "#060e1a", "text-halo-width": 1.5, "text-opacity": 0.9 } },
    ], layers.rivers);
  }, [layers.rivers, mapLoaded]);

  // ── Vector-tile rivers (zoom 9+, accurate OSM data) ───────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    const vtSrcId = Object.entries(map.getStyle().sources ?? {}).find(([, s]) => s.type === "vector")?.[0];
    if (!vtSrcId || map.getLayer("river-glow")) return;
    const rv = layers.rivers ? "visible" : "none";
    map.addLayer({ id: "river-glow", type: "line", source: vtSrcId, "source-layer": "waterway", minzoom: 9,
      layout: { visibility: rv, "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#0c3d6b", "line-width": ["interpolate", ["linear"], ["zoom"], 9, 6, 12, 12], "line-opacity": 0.6, "line-blur": 3 } });
    map.addLayer({ id: "river-main", type: "line", source: vtSrcId, "source-layer": "waterway", minzoom: 9,
      layout: { visibility: rv, "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#38bdf8", "line-width": ["interpolate", ["linear"], ["zoom"], 9, 2, 12, 5], "line-opacity": 0.85 } });
    map.addLayer({ id: "river-flow", type: "line", source: vtSrcId, "source-layer": "waterway", minzoom: 9,
      layout: { visibility: rv, "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#bae6fd", "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1, 12, 3], "line-opacity": 0.6, "line-dasharray": DASH_SEQ[0] } });
    map.addLayer({ id: "river-vt-label", type: "symbol", source: vtSrcId, "source-layer": "waterway", minzoom: 9,
      layout: {
        visibility: rv,
        "symbol-placement": "line",
        "text-field": ["coalesce", ["get", "name_en"], ["get", "name"]],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 9, 10, 12, 13],
        "text-max-angle": 30,
        "text-letter-spacing": 0.06,
        "text-offset": [0, -1],
        "symbol-spacing": 200,
      },
      paint: { "text-color": "#7dd3fc", "text-halo-color": "#060e1a", "text-halo-width": 1.5, "text-opacity": 0.9 } });
  }, [mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── VT river visibility ───────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    const vis = layers.rivers ? "visible" : "none";
    if (map.getLayer("river-glow"))     map.setLayoutProperty("river-glow",     "visibility", vis);
    if (map.getLayer("river-main"))     map.setLayoutProperty("river-main",     "visibility", vis);
    if (map.getLayer("river-flow"))     map.setLayoutProperty("river-flow",     "visibility", vis);
    if (map.getLayer("river-vt-label")) map.setLayoutProperty("river-vt-label", "visibility", vis);
  }, [layers.rivers, mapLoaded]);

  // ── Heatmap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: events.map((e) => ({
        type: "Feature" as const,
        properties: { weight: e.event_count },
        geometry: { type: "Point" as const, coordinates: [e.event_location.lng, e.event_location.lat] },
      })),
    };
    if (!map.getSource("heatmap-src")) {
      map.addSource("heatmap-src", { type: "geojson", data: geojson });
      map.addLayer({ id: "heatmap-layer", type: "heatmap", source: "heatmap-src",
        paint: { "heatmap-weight": ["get", "weight"], "heatmap-intensity": 1, "heatmap-radius": 60, "heatmap-opacity": 1 },
        layout: { visibility: layers.heatmap ? "visible" : "none" } });
    } else {
      (map.getSource("heatmap-src") as maplibregl.GeoJSONSource).setData(geojson);
      map.setLayoutProperty("heatmap-layer", "visibility", layers.heatmap ? "visible" : "none");
    }
  }, [events, layers.heatmap, mapLoaded]);

  // ── Clustered event markers ────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: events.map((e) => ({
        type: "Feature" as const,
        properties: {
          id: e.id,
          event_type: e.event_type,
          event_icon: e.event_icon,
          event_label: e.event_label,
          event_location_name: e.event_location.name,
          event_location_lat: e.event_location.lat,
          event_location_lng: e.event_location.lng,
          event_count: e.event_count,
          date: e.date,
        },
        geometry: { type: "Point" as const, coordinates: [e.event_location.lng, e.event_location.lat] },
      })),
    };

    // Register emoji images for all unique icons
    const uniqueEmojis = [...new Set(events.map((e) => e.event_icon))];
    registerEmojiImages(map, uniqueEmojis);

    const vis = layers.markers ? "visible" : "none";

    if (!map.getSource("events-clustered")) {
      map.addSource("events-clustered", {
        type: "geojson",
        data: geojson,
        cluster: true,
        clusterMaxZoom: 13,
        clusterRadius: 50,
        clusterProperties: { totalCount: ["+", ["get", "event_count"]] },
      });

      // Cluster shadow
      map.addLayer({
        id: "event-cluster-shadow", type: "circle", source: "events-clustered",
        filter: ["has", "point_count"],
        layout: { visibility: vis },
        paint: {
          "circle-color": "#000000",
          "circle-radius": ["step", ["get", "point_count"], 24, 10, 30, 50, 36],
          "circle-blur": 0.7,
          "circle-opacity": 0.4,
          "circle-translate": [2, 2],
        },
      });

      // Main cluster circle
      map.addLayer({
        id: "event-clusters", type: "circle", source: "events-clustered",
        filter: ["has", "point_count"],
        layout: { visibility: vis },
        paint: {
          "circle-color": ["step", ["get", "point_count"], "#334155", 10, "#475569", 50, "#ef4444"],
          "circle-radius": ["step", ["get", "point_count"], 20, 10, 26, 50, 32],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#1e1e2e",
        },
      });

      // Cluster count label
      map.addLayer({
        id: "event-cluster-count", type: "symbol", source: "events-clustered",
        filter: ["has", "point_count"],
        layout: {
          visibility: vis,
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Noto Sans Bold"],
          "text-size": 13,
          "text-allow-overlap": true,
        },
        paint: { "text-color": "#e2e8f0" },
      });

      // Unclustered: dark circle background
      map.addLayer({
        id: "event-unclustered-bg", type: "circle", source: "events-clustered",
        filter: ["!", ["has", "point_count"]],
        layout: { visibility: vis },
        paint: {
          "circle-color": "#1e1e2e",
          "circle-radius": 18,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#334155",
        },
      });

      // Unclustered: emoji icon
      map.addLayer({
        id: "event-unclustered", type: "symbol", source: "events-clustered",
        filter: ["!", ["has", "point_count"]],
        layout: {
          visibility: vis,
          "icon-image": ["concat", "emoji-", ["get", "event_icon"]],
          "icon-size": 0.55,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });

      // Unclustered: red count badge
      map.addLayer({
        id: "event-unclustered-badge", type: "symbol", source: "events-clustered",
        filter: ["!", ["has", "point_count"]],
        layout: {
          visibility: vis,
          "text-field": ["get", "event_count"],
          "text-font": ["Noto Sans Bold"],
          "text-size": 9,
          "text-offset": [1.2, -1.2],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "#ef4444",
          "text-halo-width": 5,
        },
      });
    } else {
      // Update data — MapLibre re-clusters automatically
      (map.getSource("events-clustered") as maplibregl.GeoJSONSource).setData(geojson);
      // Toggle visibility
      for (const layerId of EVENT_CLUSTER_LAYERS) {
        if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", vis);
      }
    }
  }, [events, layers.markers, mapLoaded]);

  // ── Cluster click handlers ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    function onClusterClick(e: maplibregl.MapMouseEvent) {
      const features = map!.queryRenderedFeatures(e.point, { layers: ["event-clusters"] });
      if (!features.length) return;
      const clusterId = features[0].properties?.cluster_id;
      if (clusterId == null) return;
      const src = map!.getSource("events-clustered") as maplibregl.GeoJSONSource;
      src.getClusterExpansionZoom(clusterId).then((zoom) => {
        const geom = features[0].geometry as GeoJSON.Point;
        map!.flyTo({ center: geom.coordinates as [number, number], zoom, duration: 500 });
      });
    }

    function onUnclusteredClick(e: maplibregl.MapMouseEvent) {
      if (drawingModeRef.current || placementModeRef.current || pathDrawingUnitIdRef.current) return;
      const features = map!.queryRenderedFeatures(e.point, { layers: ["event-unclustered-bg"] });
      if (!features.length) return;
      const p = features[0].properties!;
      const evt: MapEvent = {
        id: p.id,
        event_type: p.event_type,
        event_icon: p.event_icon,
        event_label: p.event_label,
        event_location: { name: p.event_location_name, lat: p.event_location_lat, lng: p.event_location_lng },
        event_count: p.event_count,
        date: p.date,
      };
      setPopupInfra(null);
      setPopupEvent(evt);
    }

    function onMouseEnter() {
      if (!drawingModeRef.current && !placementModeRef.current && !pathDrawingUnitIdRef.current) {
        map!.getCanvas().style.cursor = "pointer";
      }
    }
    function onMouseLeave() {
      if (!drawingModeRef.current && !placementModeRef.current && !pathDrawingUnitIdRef.current) {
        map!.getCanvas().style.cursor = "";
      }
    }

    map.on("click", "event-clusters", onClusterClick);
    map.on("click", "event-unclustered-bg", onUnclusteredClick);
    map.on("mouseenter", "event-clusters", onMouseEnter);
    map.on("mouseleave", "event-clusters", onMouseLeave);
    map.on("mouseenter", "event-unclustered-bg", onMouseEnter);
    map.on("mouseleave", "event-unclustered-bg", onMouseLeave);

    return () => {
      map.off("click", "event-clusters", onClusterClick);
      map.off("click", "event-unclustered-bg", onUnclusteredClick);
      map.off("mouseenter", "event-clusters", onMouseEnter);
      map.off("mouseleave", "event-clusters", onMouseLeave);
      map.off("mouseenter", "event-unclustered-bg", onMouseEnter);
      map.off("mouseleave", "event-unclustered-bg", onMouseLeave);
    };
  }, [mapLoaded]);

  // ── Geographic labels (mountains, forests, lakes, etc.) ────────────────────
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
  }, [layers.geoLabels, mapLoaded]);

  // ── Disable doubleClickZoom while drawing or path drawing ────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const m = mapRef.current?.getMap();
    if (!m) return;
    if (drawingMode || pathDrawingUnitId) {
      m.doubleClickZoom.disable();
    } else {
      m.doubleClickZoom.enable();
    }
  }, [drawingMode, pathDrawingUnitId, mapLoaded]);

  // ── Keyboard camera controls ─────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const map = mapRef.current?.getMap();
      if (!map) return;

      if (e.key === "n" || e.key === "N") {
        map.easeTo({ bearing: 0, pitch: layersRef.current.terrain ? 65 : 0, duration: 500 });
        return;
      }

      const fine = e.shiftKey;
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          map.easeTo({ bearing: map.getBearing() - (fine ? 5 : 15), duration: 200 });
          break;
        case "ArrowRight":
          e.preventDefault();
          map.easeTo({ bearing: map.getBearing() + (fine ? 5 : 15), duration: 200 });
          break;
        case "ArrowUp":
          e.preventDefault();
          map.easeTo({ pitch: Math.min(85, map.getPitch() + (fine ? 5 : 10)), duration: 200 });
          break;
        case "ArrowDown":
          e.preventDefault();
          map.easeTo({ pitch: Math.max(0, map.getPitch() - (fine ? 5 : 10)), duration: 200 });
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);


  return (
    <div className="absolute inset-0">
      <Map
        ref={mapRef}
        initialViewState={DEFAULT_VIEW}
        minZoom={5}
        maxZoom={14}
        maxPitch={85}
        style={{ width: "100%", height: "100%", cursor: (drawingMode || placementMode || pathDrawingUnitId) ? "crosshair" : undefined }}
        mapStyle={dark ? "https://tiles.openfreemap.org/styles/dark" : "https://tiles.openfreemap.org/styles/bright"}
        dragRotate={true}
        touchZoomRotate={true}
        attributionControl={false}
        onLoad={() => setMapLoaded(true)}
        onClick={(e) => {
          if (drawingModeRef.current) {
            onMapClickRef.current([e.lngLat.lng, e.lngLat.lat]);
            return;
          }
          if (placementModeRef.current) {
            onPlaceUnitRef.current?.([e.lngLat.lng, e.lngLat.lat]);
            return;
          }
          if (pathDrawingUnitIdRef.current) {
            onAddWaypointRef.current?.([e.lngLat.lng, e.lngLat.lat]);
            return;
          }
          // Check for click on annotation feature
          const m = mapRef.current?.getMap();
          if (m) {
            const allAnnotationLayers = [
              "draw-line-main", "draw-line-dashed",
              "draw-arrow-main", "draw-arrow-dashed",
              "draw-arrow-head-fill", "draw-arrow-jagged-fill",
              "draw-area-fill", "draw-area-edge", "draw-area-edge-dashed",
            ].filter(id => m.getLayer(id));
            if (allAnnotationLayers.length > 0) {
              const features = m.queryRenderedFeatures(e.point, {
                layers: allAnnotationLayers,
              });
              if (features.length > 0) {
                const id = features[0].properties?.id as string | undefined;
                const ann = annotationsRef.current.find(a => a.id === id);
                if (ann) {
                  if (onSelectAnnotation) {
                    onSelectAnnotation(ann.id);
                  } else {
                    setPopupAnnotation({ annotation: ann, lngLat: [e.lngLat.lng, e.lngLat.lat] });
                    setPopupEvent(null);
                    setPopupInfra(null);
                  }
                }
              }
            }
          }
        }}
        onDblClick={(e) => {
          if (drawingModeRef.current) {
            e.preventDefault(); // prevent default double-click zoom while drawing
            onMapDblClickRef.current([e.lngLat.lng, e.lngLat.lat]);
            return;
          }
          if (pathDrawingUnitIdRef.current) {
            e.preventDefault();
            onFinishPathRef.current?.();
          }
        }}
      >
        <AttributionControl compact={true} position="bottom-right" />

        {/* ── Drawing layers ── */}
        {mapLoaded && (
          <DrawingLayers
            annotations={annotations}
            previewMode={drawingMode}
            previewColor={drawingColor}
            tempCoords={tempDrawingCoords}
            previewWidth={previewWidth}
            previewArrowStyle={previewArrowStyle}
            terrainActive={layers.terrain}
            onPinClick={(ann, lngLat) => {
              setPopupAnnotation({ annotation: ann, lngLat });
              setPopupEvent(null);
              setPopupInfra(null);
            }}
          />
        )}

        {/* ── Animated units ── */}
        {mapLoaded && layers.units && (
          <UnitLayer
            terrain={layers.terrain}
            units={placedUnits ?? []}
            paths={unitPaths ?? []}
          />
        )}

        {/* ── Animated flights ── */}
        {mapLoaded && layers.flights && <FlightLayer terrain={layers.terrain} />}
        {/* ── Animated ships ── */}
        {mapLoaded && layers.ships && <ShipLayer terrain={layers.terrain} />}

        {/* ── Event markers rendered via native clustered layers (see useEffect above) ── */}

        {/* ── Governorate labels ── */}
        {layers.governorates && GOVERNORATES.map((gov) => (
          <Marker key={gov.id} longitude={gov.lng} latitude={gov.lat} anchor="center"
            pitchAlignment="viewport" rotationAlignment="viewport">
            <div style={{
              pointerEvents: "none",
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              color: "#e2e8f0",
              opacity: 1,
              textShadow: "0 0 8px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,0.9), 0 1px 4px rgba(0,0,0,0.9)",
              whiteSpace: "nowrap",
              userSelect: "none",
            }}>
              {gov.nameEn}
            </div>
          </Marker>
        ))}

        {/* ── Infrastructure markers ── */}
        {layers.infrastructure && staticMarkers.filter(m => selectedInfraTypes.has(m.type)).map((marker) => (
          <Marker key={marker.id} longitude={marker.lng} latitude={marker.lat}
            anchor={layers.terrain ? "bottom" : "center"}
            pitchAlignment="viewport" rotationAlignment="viewport"
            onClick={(e) => { e.originalEvent.stopPropagation(); setPopupEvent(null); setPopupInfra(marker); }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}>
              <div style={{ width: 28, height: 28, background: "#0f172a", border: `2px solid ${STATIC_MARKER_COLORS[marker.type]}`,
                borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
                boxShadow: `0 0 8px ${STATIC_MARKER_COLORS[marker.type]}66` }}>
                {marker.icon}
              </div>
              {layers.terrain && (
                <div style={{ width: 3, height: 70, background: `linear-gradient(to bottom, ${STATIC_MARKER_COLORS[marker.type]}cc, transparent)` }} />
              )}
            </div>
          </Marker>
        ))}

        {/* ── Event popup ── */}
        {popupEvent && (
          <Popup longitude={popupEvent.event_location.lng} latitude={popupEvent.event_location.lat}
            anchor="bottom" offset={22} onClose={() => setPopupEvent(null)} closeOnClick={true}>
            <div className="flex flex-col gap-1 pr-3">
              <div className="text-xl text-center">{popupEvent.event_icon}</div>
              <div className="font-semibold text-sm text-foreground">{popupEvent.event_label}</div>
              <div className="text-muted-foreground text-xs">📍 {popupEvent.event_location.name}</div>
              <div className="text-xs text-foreground">Count: <span className="font-semibold">{popupEvent.event_count}</span></div>
              <div className="text-[11px] text-muted-foreground">{popupEvent.date}</div>
            </div>
          </Popup>
        )}

        {/* ── Infrastructure popup ── */}
        {popupInfra && (
          <Popup longitude={popupInfra.lng} latitude={popupInfra.lat}
            anchor="bottom" offset={18} onClose={() => setPopupInfra(null)} closeOnClick={true}>
            <div className="flex flex-col gap-1 pr-3">
              <div className="text-xl text-center">{popupInfra.icon}</div>
              <div className="font-semibold text-sm text-foreground">{popupInfra.label}</div>
              {popupInfra.sublabel && <div className="text-muted-foreground text-xs">{popupInfra.sublabel}</div>}
              <span className="mt-1 self-start rounded px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide"
                style={{ background: STATIC_MARKER_COLORS[popupInfra.type] + "22", color: STATIC_MARKER_COLORS[popupInfra.type] }}>
                {popupInfra.type}
              </span>
            </div>
          </Popup>
        )}

        {/* ── Annotation popup ── */}
        {popupAnnotation && (
          <Popup
            longitude={popupAnnotation.lngLat[0]}
            latitude={popupAnnotation.lngLat[1]}
            anchor="bottom" offset={14}
            onClose={() => setPopupAnnotation(null)}
            closeOnClick={true}
          >
            <div className="flex flex-col gap-1.5 pr-3">
              <div className="flex items-center gap-2">
                <div className="size-2.5 rounded-full shrink-0" style={{ background: popupAnnotation.annotation.color }} />
                <span className="font-semibold text-sm text-foreground">{popupAnnotation.annotation.label}</span>
              </div>
              <button
                onClick={() => {
                  onDeleteAnnotation(popupAnnotation.annotation.id);
                  setPopupAnnotation(null);
                }}
                className="self-start rounded px-2 py-0.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-950/40 transition-colors"
              >
                Delete
              </button>
            </div>
          </Popup>
        )}
      </Map>

      {/* ── Strategy-game vignette — dims distant areas, focuses on center ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 55% 65% at 50% 50%, transparent 0%, rgba(0,0,0,0.18) 55%, rgba(0,0,0,0.52) 80%, rgba(0,0,0,0.72) 100%)" }}
      />

      {/* ── Float annotation overlay (SVG, screen-space) — renders per-annotation floated ones ── */}
      {mapLoaded && (
        <FloatAnnotationOverlay annotations={annotations} mapRef={mapRef} terrainActive={layers.terrain} />
      )}
    </div>
  );
}
