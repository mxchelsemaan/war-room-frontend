import { useEffect, useMemo, useRef } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type maplibregl from "maplibre-gl";
import type { MapEvent } from "@/data/index";
import type { AnnotationType } from "@/hooks/useDrawing";
import type { NATOUnitType } from "@/types/units";
import { registerPinImages, PIN_BG_DARK, PIN_BG_LIGHT } from "@/lib/mapUtils";
import { getEventTypeColor } from "@/config/eventTypes";
import { CROSSFADE } from "@/config/map";

const EVENT_COLOR_DEFAULT = "#64748b";

const EVENT_LAYERS = ["event-pulse", "event-pins"] as const;

/** Build a MapLibre `match` expression that maps event_type → color dynamically */
function eventTypeColorExpr(events: MapEvent[]): maplibregl.ExpressionSpecification {
  const seen = new Set<string>();
  const entries: string[] = [];
  for (const e of events) {
    if (!seen.has(e.event_type)) {
      seen.add(e.event_type);
      entries.push(e.event_type, getEventTypeColor(e.event_type));
    }
  }
  if (entries.length === 0) {
    return EVENT_COLOR_DEFAULT as unknown as maplibregl.ExpressionSpecification;
  }
  return ["match", ["get", "event_type"], ...entries, EVENT_COLOR_DEFAULT] as unknown as maplibregl.ExpressionSpecification;
}

export function useEventLayers(
  mapRef: React.RefObject<MapRef | null>,
  events: MapEvent[],
  markersEnabled: boolean,
  mapLoaded: boolean,
  drawingModeRef: React.RefObject<AnnotationType | null>,
  placementModeRef: React.RefObject<NATOUnitType | null>,
  pathDrawingUnitIdRef: React.RefObject<string | null>,
  setPopupEvent: (evt: MapEvent | null) => void,
  setPopupInfra: (infra: null) => void,
  dark: boolean = true,
  terrain: boolean = false,
  crossfadeEnabled: boolean = false,
) {
  const bgFill = dark ? PIN_BG_DARK : PIN_BG_LIGHT;
  const textColor = dark ? "#ffffff" : "#1e293b";
  const pinPrefix = terrain ? "stem-circle-" : "pin-circle-";
  const pinAnchor = terrain ? "bottom" : "center";

  // ── Memoize GeoJSON data ──────────────────────────────────────────────
  const geoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    const now = Date.now();
    return {
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
          summary: e.summary ?? "",
          severity: e.severity ?? "",
          sourceChannel: e.sourceChannel ?? "",
          verificationStatus: e.verificationStatus ?? "",
          isRecent: now - Date.parse(e.date) < 86400000,
        },
        geometry: { type: "Point" as const, coordinates: [e.event_location.lng, e.event_location.lat] },
      })),
    };
  }, [events]);

  const uniqueEmojis = useMemo(() => [...new Set(events.map((e) => e.event_icon))], [events]);
  const pinColors = useMemo(() => {
    const colors = new Set<string>();
    events.forEach((e) => colors.add(getEventTypeColor(e.event_type)));
    colors.add(EVENT_COLOR_DEFAULT);
    return [...colors];
  }, [events]);

  const colorExpr = useMemo(() => eventTypeColorExpr(events), [events]);

  const geoJsonRef = useRef(geoJson);
  geoJsonRef.current = geoJson;

  // ── Event pin layers: data update ──────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    registerPinImages(map, uniqueEmojis, pinColors, bgFill);

    const vis = markersEnabled ? "visible" : "none";

    const iconOpacity: maplibregl.ExpressionSpecification | number = crossfadeEnabled
      ? ["interpolate", ["linear"], ["zoom"], CROSSFADE.FADE_START, 0, CROSSFADE.FADE_END, 1] as unknown as maplibregl.ExpressionSpecification
      : 1;

    if (!map.getSource("events-points")) {
      map.addSource("events-points", {
        type: "geojson",
        data: geoJson,
      });

      // ── Pulse circle layer (below pins) — only for recent events ──
      map.addLayer({
        id: "event-pulse",
        type: "circle",
        source: "events-points",
        filter: ["==", ["get", "isRecent"], true],
        layout: { visibility: vis },
        paint: {
          "circle-color": "#ef4444",
          "circle-radius": 8,
          "circle-opacity": 0.15,
          "circle-blur": 0.8,
        },
      });

      // ── Pin symbol layer ──
      map.addLayer({
        id: "event-pins",
        type: "symbol",
        source: "events-points",
        layout: {
          visibility: vis,
          "icon-image": ["concat", pinPrefix, bgFill, "-", colorExpr, "-", ["get", "event_icon"]] as unknown as maplibregl.ExpressionSpecification,
          "icon-size": 0.85,
          "icon-anchor": pinAnchor,
          "icon-pitch-alignment": "viewport",
          "icon-rotation-alignment": "viewport",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: {
          "icon-opacity": iconOpacity,
        },
      });
    } else {
      (map.getSource("events-points") as maplibregl.GeoJSONSource).setData(geoJson);
      // Update icon-image expression so new event types / terrain toggle get correct images
      if (map.getLayer("event-pins")) {
        map.setLayoutProperty("event-pins", "icon-image",
          ["concat", pinPrefix, bgFill, "-", colorExpr, "-", ["get", "event_icon"]]);
        map.setLayoutProperty("event-pins", "icon-anchor", pinAnchor);
      }
    }
  }, [geoJson, uniqueEmojis, colorExpr, mapLoaded, bgFill, terrain]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update crossfade opacity when mode changes ─────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map || !map.getLayer("event-pins")) return;

    const iconOpacity: maplibregl.ExpressionSpecification | number = crossfadeEnabled
      ? ["interpolate", ["linear"], ["zoom"], CROSSFADE.FADE_START, 0, CROSSFADE.FADE_END, 1] as unknown as maplibregl.ExpressionSpecification
      : 1;

    map.setPaintProperty("event-pins", "icon-opacity", iconOpacity);
  }, [crossfadeEnabled, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Visibility toggle ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    const vis = markersEnabled ? "visible" : "none";
    for (const layerId of EVENT_LAYERS) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", vis);
    }
  }, [markersEnabled, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Click handlers ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    function onPinClick(e: maplibregl.MapMouseEvent) {
      if (drawingModeRef.current || placementModeRef.current || pathDrawingUnitIdRef.current) return;
      const features = map!.queryRenderedFeatures(e.point, { layers: ["event-pins"] });
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
        summary: p.summary,
        severity: p.severity,
        sourceChannel: p.sourceChannel,
        verificationStatus: p.verificationStatus,
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

    map.on("click", "event-pins", onPinClick);
    map.on("mouseenter", "event-pins", onMouseEnter);
    map.on("mouseleave", "event-pins", onMouseLeave);

    return () => {
      map.off("click", "event-pins", onPinClick);
      map.off("mouseenter", "event-pins", onMouseEnter);
      map.off("mouseleave", "event-pins", onMouseLeave);
    };
  }, [mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps
}
