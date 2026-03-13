import { useEffect, useMemo, useRef, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type maplibregl from "maplibre-gl";
import type { MapEvent } from "@/data/index";
import type { AnnotationType } from "@/hooks/useDrawing";
import type { NATOUnitType } from "@/types/units";
import { registerPingImages, registerPinImages, PIN_BG_DARK, PIN_BG_LIGHT } from "@/lib/mapUtils";
import { getEventTypeColor } from "@/config/eventTypes";
import { CROSSFADE } from "@/config/map";

const EVENT_LAYERS = ["event-ping-a", "event-ping-b", "event-pins"] as const;

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
  const pinPrefix = terrain ? "stem-circle-" : "pin-circle-";
  const pinAnchor = terrain ? "bottom" : "center";

  // ── Unique emojis and colors for pin image registration ───────────────
  const uniqueEmojis = useMemo(() => [...new Set(events.map(e => e.event_icon))], [events]);
  const pinColors = useMemo(() => [...new Set(events.map(e => getEventTypeColor(e.event_type)))], [events]);

  // ── Memoize GeoJSON data ──────────────────────────────────────────────
  const [mountTime] = useState(() => Date.now());
  const geoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    const now = mountTime;
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
          color: getEventTypeColor(e.event_type),
          isRecent: now - Date.parse(e.date) < 86400000,
        },
        geometry: { type: "Point" as const, coordinates: [e.event_location.lng, e.event_location.lat] },
      })),
    };
  }, [events, mountTime]);

  const geoJsonRef = useRef(geoJson);
  geoJsonRef.current = geoJson;

  // ── Event pin layers: data update ──────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    registerPingImages(map, pinColors);
    registerPinImages(map, uniqueEmojis, pinColors, bgFill, "circle");

    const vis = markersEnabled ? "visible" : "none";

    // zoom expressions must be the top-level input to interpolate/step —
    // nest the per-feature "case" inside the output stops, not the other way around.
    const iconOpacity: maplibregl.ExpressionSpecification | number = crossfadeEnabled
      ? ["interpolate", ["linear"], ["zoom"],
          CROSSFADE.FADE_START, ["case", ["get", "isRecent"], 1, 0.35],
          CROSSFADE.FADE_END, 1,
        ] as unknown as maplibregl.ExpressionSpecification
      : 1;

    // Remove stale source+layers and re-create with fresh data every time.
    // This avoids a MapLibre bug where setData on an initially-empty GeoJSON
    // source does not fully re-run symbol layout, leaving most symbols invisible.
    for (const id of EVENT_LAYERS) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    // Also remove legacy "event-dots" layer if present (replaced by pin icons)
    if (map.getLayer("event-dots")) map.removeLayer("event-dots");
    if (map.getSource("events-points")) map.removeSource("events-points");

    if (geoJson.features.length === 0) return; // nothing to render

    map.addSource("events-points", {
      type: "geojson",
      data: geoJson,
    });

    // ── Radar ping symbol layers (below pins) — two staggered expanding discs ──
    const pingLayout: maplibregl.SymbolLayerSpecification["layout"] = {
      visibility: vis,
      "icon-image": ["concat", "ping-", ["get", "color"]] as unknown as maplibregl.ExpressionSpecification,
      "icon-size": 0.05,                           // animated in useMapAnimation
      "icon-anchor": "center",
      "icon-pitch-alignment": "viewport",
      "icon-rotation-alignment": "viewport",
      "icon-overlap": "always",
    };
    map.addLayer({
      id: "event-ping-a",
      type: "symbol",
      source: "events-points",
      minzoom: 7,
      filter: ["==", ["get", "isRecent"], true],
      layout: { ...pingLayout },
      paint: { "icon-opacity": 0 },
    });
    map.addLayer({
      id: "event-ping-b",
      type: "symbol",
      source: "events-points",
      minzoom: 7,
      filter: ["==", ["get", "isRecent"], true],
      layout: { ...pingLayout },
      paint: { "icon-opacity": 0 },
    });

    // ── Pin icon layer (matching infra pin style) ──
    map.addLayer({
      id: "event-pins",
      type: "symbol",
      source: "events-points",
      minzoom: 7,
      layout: {
        visibility: vis,
        "icon-image": ["concat", pinPrefix, bgFill, "-", ["get", "color"], "-", ["get", "event_icon"]] as unknown as maplibregl.ExpressionSpecification,
        "icon-size": 0.4,
        "icon-anchor": pinAnchor,
        "icon-pitch-alignment": "viewport",
        "icon-rotation-alignment": "viewport",
        "icon-overlap": "always",
      },
      paint: {
        "icon-opacity": iconOpacity as unknown as number,
      },
    });
  }, [geoJson, uniqueEmojis, pinColors, mapLoaded, bgFill, terrain]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update crossfade opacity when mode changes ─────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    const opacity: maplibregl.ExpressionSpecification | number = crossfadeEnabled
      ? ["interpolate", ["linear"], ["zoom"],
          CROSSFADE.FADE_START, ["case", ["get", "isRecent"], 1, 0.35],
          CROSSFADE.FADE_END, 1,
        ] as unknown as maplibregl.ExpressionSpecification
      : 1;

    if (map.getLayer("event-pins")) map.setPaintProperty("event-pins", "icon-opacity", opacity);
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
      const features = map!.queryRenderedFeatures(e.point, { layers: ["event-pins"].filter(id => !!map!.getLayer(id)) });
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
      const features = map!.queryRenderedFeatures(e.point, { layers: ["event-pins"].filter(id => !!map!.getLayer(id)) });
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
