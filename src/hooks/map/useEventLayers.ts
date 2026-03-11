import { useEffect, useMemo, useRef } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type maplibregl from "maplibre-gl";
import type { MapEvent } from "@/data/index";
import type { AnnotationType } from "@/hooks/useDrawing";
import type { NATOUnitType } from "@/types/units";
import { registerPulseRingImage, PIN_BG_DARK, PIN_BG_LIGHT } from "@/lib/mapUtils";
import { getEventTypeColor } from "@/config/eventTypes";
import { CROSSFADE } from "@/config/map";

const EVENT_COLOR_DEFAULT = "#64748b";

const EVENT_LAYERS = ["event-pulse", "event-dots", "event-pins"] as const;

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
  mapLoaded: number | boolean,
  drawingModeRef: React.RefObject<AnnotationType | null>,
  placementModeRef: React.RefObject<NATOUnitType | null>,
  pathDrawingUnitIdRef: React.RefObject<string | null>,
  setPopupEvent: (evt: MapEvent | null) => void,
  setPopupInfra: (infra: null) => void,
  dark: boolean = true,
  terrain: boolean = false,
  crossfadeEnabled: boolean = false,
  clickedEventRef?: React.RefObject<boolean>,
) {
  const bgFill = dark ? PIN_BG_DARK : PIN_BG_LIGHT;

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
          sourceType: e.sourceType ?? "",
          sourceChannel: e.sourceChannel ?? "",
          sourceId: e.sourceId ?? "",
          verificationStatus: e.verificationStatus ?? "",
          isRecent: now - Date.parse(e.date) < 86400000,
        },
        geometry: { type: "Point" as const, coordinates: [e.event_location.lng, e.event_location.lat] },
      })),
    };
  }, [events]);

  const colorExpr = useMemo(() => eventTypeColorExpr(events), [events]);

  const geoJsonRef = useRef(geoJson);
  geoJsonRef.current = geoJson;

  // ── Event pin layers: data update ──────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    registerPulseRingImage(map);

    const vis = markersEnabled ? "visible" : "none";

    const iconOpacity: maplibregl.ExpressionSpecification | number = crossfadeEnabled
      ? ["case", ["get", "isRecent"], 1, ["interpolate", ["linear"], ["zoom"], CROSSFADE.FADE_START, 0.35, CROSSFADE.FADE_END, 1]] as unknown as maplibregl.ExpressionSpecification
      : 1;

    // Remove stale source+layers and re-create with fresh data every time.
    // This avoids a MapLibre bug where setData on an initially-empty GeoJSON
    // source does not fully re-run symbol layout, leaving most symbols invisible.
    for (const id of EVENT_LAYERS) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    if (map.getSource("events-points")) map.removeSource("events-points");

    if (geoJson.features.length === 0) return; // nothing to render

    map.addSource("events-points", {
      type: "geojson",
      data: geoJson,
    });

    // ── Pulse ring symbol layer (below pins) — only for recent events ──
    map.addLayer({
      id: "event-pulse",
      type: "symbol",
      source: "events-points",
      minzoom: 7,
      filter: ["==", ["get", "isRecent"], true],
      layout: {
        visibility: vis,
        "icon-image": "pulse-ring",
        "icon-size": 0.1,                         // animated in useMapAnimation
        "icon-anchor": "center",
        "icon-pitch-alignment": "viewport",
        "icon-rotation-alignment": "viewport",
        "icon-overlap": "always",
      },
      paint: {
        "icon-opacity": 0.8,                      // animated in useMapAnimation
      },
    });

    // ── Circle fallback layer (always visible, beneath symbols) ──
    map.addLayer({
      id: "event-dots",
      type: "circle",
      source: "events-points",
      minzoom: 7,
      layout: { visibility: vis },
      paint: {
        "circle-radius": 6,
        "circle-color": colorExpr,
        "circle-opacity": iconOpacity as unknown as number,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": bgFill,
      },
    });

    // ── Pin symbol layer (emoji on top of dots) ──
    map.addLayer({
      id: "event-pins",
      type: "symbol",
      source: "events-points",
      minzoom: 7,
      layout: {
        visibility: vis,
        "text-field": ["get", "event_icon"] as unknown as maplibregl.ExpressionSpecification,
        "text-size": 16,
        "text-anchor": "center",
        "text-pitch-alignment": "viewport",
        "text-rotation-alignment": "viewport",
        "text-allow-overlap": true,
        "text-ignore-placement": true,
        "text-overlap": "always",
      },
      paint: {
        "text-opacity": iconOpacity,
      },
    });
  }, [geoJson, colorExpr, mapLoaded, bgFill, terrain]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update crossfade opacity when mode changes ─────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    const opacity: maplibregl.ExpressionSpecification | number = crossfadeEnabled
      ? ["case", ["get", "isRecent"], 1, ["interpolate", ["linear"], ["zoom"], CROSSFADE.FADE_START, 0.35, CROSSFADE.FADE_END, 1]] as unknown as maplibregl.ExpressionSpecification
      : 1;

    if (map.getLayer("event-dots")) map.setPaintProperty("event-dots", "circle-opacity", opacity);
    if (map.getLayer("event-pins")) map.setPaintProperty("event-pins", "text-opacity", opacity);
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
      const features = map!.queryRenderedFeatures(e.point, { layers: ["event-pins", "event-dots"].filter(id => !!map!.getLayer(id)) });
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
        sourceType: p.sourceType || undefined,
        sourceChannel: p.sourceChannel,
        sourceId: p.sourceId || undefined,
        verificationStatus: p.verificationStatus,
      };
      setPopupInfra(null);
      if (clickedEventRef) clickedEventRef.current = true;
      setPopupEvent(evt);
    }

    function onMouseEnter(e: maplibregl.MapMouseEvent) {
      if (drawingModeRef.current || placementModeRef.current || pathDrawingUnitIdRef.current) return;
      map!.getCanvas().style.cursor = "pointer";
      // Don't overwrite a click-opened popup with hover
      if (clickedEventRef?.current) return;
      // Show popup on hover (desktop)
      const features = map!.queryRenderedFeatures(e.point, { layers: ["event-pins", "event-dots"].filter(id => !!map!.getLayer(id)) });
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
        sourceType: p.sourceType || undefined,
        sourceChannel: p.sourceChannel,
        sourceId: p.sourceId || undefined,
        verificationStatus: p.verificationStatus,
      };
      setPopupInfra(null);
      setPopupEvent(evt);
    }
    function onMouseLeave() {
      if (drawingModeRef.current || placementModeRef.current || pathDrawingUnitIdRef.current) return;
      map!.getCanvas().style.cursor = "";
      // Don't dismiss click-opened popups on mouse leave
      if (clickedEventRef?.current) return;
      setPopupEvent(null);
    }

    for (const layerId of ["event-pins", "event-dots"] as const) {
      map.on("click", layerId, onPinClick);
      map.on("mouseenter", layerId, onMouseEnter);
      map.on("mouseleave", layerId, onMouseLeave);
    }

    return () => {
      for (const layerId of ["event-pins", "event-dots"] as const) {
        map.off("click", layerId, onPinClick);
        map.off("mouseenter", layerId, onMouseEnter);
        map.off("mouseleave", layerId, onMouseLeave);
      }
    };
  }, [mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps
}
