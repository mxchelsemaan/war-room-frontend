import { useEffect, useMemo, useRef } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type maplibregl from "maplibre-gl";
import type { MapEvent } from "@/data/index";
import type { AnnotationType } from "@/hooks/useDrawing";
import type { NATOUnitType } from "@/types/units";
import type { ClusterPopupData } from "@/components/atlas/ClusterPopup";
import { registerClusterBadgeImage, registerPulseRingImage, registerPinImages, PIN_BG_DARK, PIN_BG_LIGHT } from "@/lib/mapUtils";
import { getEventTypeColor } from "@/config/eventTypes";
import { CROSSFADE } from "@/config/map";

/** Shared clustered source — drives both cluster badges and individual event pins */
export const CLUSTER_SOURCE = "events-clusters";
const CLUSTER_LAYER = "cluster-count";
const PIN_LAYER = "event-pins";
const PULSE_LAYER = "event-pulse";

export function useClusterLayer(
  mapRef: React.RefObject<MapRef | null>,
  events: MapEvent[],
  markersEnabled: boolean,
  mapLoaded: number | boolean,
  setClusterPopup: (data: ClusterPopupData | null) => void,
  setPopupEvent: (evt: MapEvent | null) => void,
  setPopupInfra: (infra: null) => void,
  drawingModeRef: React.RefObject<AnnotationType | null>,
  placementModeRef: React.RefObject<NATOUnitType | null>,
  pathDrawingUnitIdRef: React.RefObject<string | null>,
  dark: boolean = true,
  terrain: boolean = false,
  crossfadeEnabled: boolean = false,
  clickedEventRef?: React.RefObject<boolean>,
) {
  const bgFill = dark ? PIN_BG_DARK : PIN_BG_LIGHT;
  const pinPrefix = terrain ? "stem-circle-" : "pin-circle-";
  const pinAnchor = terrain ? "bottom" : "center";

  const uniqueEmojis = useMemo(() => [...new Set(events.map(e => e.event_icon))], [events]);
  const pinColors = useMemo(() => [...new Set(events.map(e => getEventTypeColor(e.event_type)))], [events]);

  const geoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    const now = Date.now();
    return {
      type: "FeatureCollection",
      features: events.map((e) => ({
        type: "Feature" as const,
        properties: {
          id: e.id,
          eventId: e.id,
          event_type: e.event_type,
          event_icon: e.event_icon,
          event_label: e.event_label,
          event_location_name: e.event_location.name,
          event_location_lat: e.event_location.lat,
          event_location_lng: e.event_location.lng,
          locationName: e.event_location.name,
          locationLat: e.event_location.lat,
          locationLng: e.event_location.lng,
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
        geometry: {
          type: "Point" as const,
          coordinates: [e.event_location.lng, e.event_location.lat],
        },
      })),
    };
  }, [events]);

  const eventsRef = useRef(events);
  eventsRef.current = events;

  // ── Create clustered source + all layers ─────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    registerClusterBadgeImage(map);
    registerPulseRingImage(map);
    registerPinImages(map, uniqueEmojis, pinColors, bgFill, "circle");

    const vis = markersEnabled ? "visible" : "none";

    // Clean up stale layers + source for full re-create
    for (const id of [PULSE_LAYER, PIN_LAYER, CLUSTER_LAYER]) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    // Also remove legacy layers
    if (map.getLayer("event-dots")) map.removeLayer("event-dots");
    if (map.getSource("events-points")) map.removeSource("events-points");
    if (map.getSource(CLUSTER_SOURCE)) map.removeSource(CLUSTER_SOURCE);

    if (geoJson.features.length === 0) return;

    map.addSource(CLUSTER_SOURCE, {
      type: "geojson",
      data: geoJson,
      cluster: true,
      clusterRadius: 40,
      clusterMaxZoom: 18,
    });

    const iconOpacity: maplibregl.ExpressionSpecification | number = crossfadeEnabled
      ? ["interpolate", ["linear"], ["zoom"],
          CROSSFADE.FADE_START, ["case", ["get", "isRecent"], 1, 0.35],
          CROSSFADE.FADE_END, 1,
        ] as unknown as maplibregl.ExpressionSpecification
      : 1;

    // ── Pulse ring (unclustered, recent only) ──
    map.addLayer({
      id: PULSE_LAYER,
      type: "symbol",
      source: CLUSTER_SOURCE,
      minzoom: 7,
      filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "isRecent"], true]],
      layout: {
        visibility: vis,
        "icon-image": "pulse-ring",
        "icon-size": 0.1,
        "icon-anchor": "center",
        "icon-pitch-alignment": "viewport",
        "icon-rotation-alignment": "viewport",
        "icon-overlap": "always",
      },
      paint: { "icon-opacity": 0.8 },
    });

    // ── Event pins (unclustered) ──
    map.addLayer({
      id: PIN_LAYER,
      type: "symbol",
      source: CLUSTER_SOURCE,
      minzoom: 7,
      filter: ["!", ["has", "point_count"]],
      layout: {
        visibility: vis,
        "icon-image": ["concat", pinPrefix, bgFill, "-", ["get", "color"], "-", ["get", "event_icon"]] as unknown as maplibregl.ExpressionSpecification,
        "icon-size": 0.4,
        "icon-anchor": pinAnchor,
        "icon-pitch-alignment": "viewport",
        "icon-rotation-alignment": "viewport",
        "icon-overlap": "always",
      },
      paint: { "icon-opacity": iconOpacity as unknown as number },
    });

    // ── Cluster count badges ──
    // Pseudo-random stem height via cluster_id % 5 → natural variation
    const cid5 = ["%", ["get", "cluster_id"], 5];
    const clusterIcon = terrain
      ? ["step", cid5,
          "cluster-badge-stem-0",   // 38px
          1, "cluster-badge-stem-1", // 46px
          2, "cluster-badge-stem-2", // 54px
          3, "cluster-badge-stem-3", // 62px
          4, "cluster-badge-stem-4", // 50px
        ]
      : "cluster-badge";

    const clusterIconSize = terrain
      ? ["interpolate", ["linear"], ["zoom"],
          7, 0.45,
          12, 0.38,
          16, 0.3,
        ]
      : 0.4;

    // Text offset matches each stem height so label stays on badge head
    const clusterTextOffset = terrain
      ? ["step", cid5,
          ["literal", [0, -1.45]],   // stem-0 (38)
          1, ["literal", [0, -1.65]], // stem-1 (46)
          2, ["literal", [0, -1.85]], // stem-2 (54)
          3, ["literal", [0, -2.05]], // stem-3 (62)
          4, ["literal", [0, -1.75]], // stem-4 (50)
        ]
      : [0, 0];

    map.addLayer({
      id: CLUSTER_LAYER,
      type: "symbol",
      source: CLUSTER_SOURCE,
      filter: ["has", "point_count"],
      layout: {
        visibility: vis,
        "icon-image": clusterIcon as unknown as maplibregl.ExpressionSpecification,
        "icon-size": clusterIconSize as unknown as number,
        "icon-anchor": terrain ? "bottom" : "center",
        "icon-overlap": "always",
        "icon-pitch-alignment": "viewport",
        "icon-rotation-alignment": "viewport",
        "text-field": ["get", "point_count_abbreviated"] as unknown as maplibregl.ExpressionSpecification,
        "text-font": ["Noto Sans Regular"],
        "text-size": 13,
        "text-anchor": "center",
        "text-offset": clusterTextOffset as unknown as [number, number],
        "text-overlap": "always",
      },
      paint: {
        "text-color": "#1e293b",
        "text-halo-color": "rgba(255,255,255,0.6)",
        "text-halo-width": 1,
      },
    } as maplibregl.LayerSpecification);
  }, [geoJson, uniqueEmojis, pinColors, mapLoaded, bgFill, terrain]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update crossfade opacity ───────────────────────────────────────────
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

    if (map.getLayer(PIN_LAYER)) map.setPaintProperty(PIN_LAYER, "icon-opacity", opacity);
  }, [crossfadeEnabled, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Visibility toggle ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    const vis = markersEnabled ? "visible" : "none";
    for (const id of [PULSE_LAYER, PIN_LAYER, CLUSTER_LAYER]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis);
    }
  }, [markersEnabled, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Click handlers ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    // Cluster click → popup with list
    function onClusterClick(e: maplibregl.MapMouseEvent) {
      if (drawingModeRef.current || placementModeRef.current || pathDrawingUnitIdRef.current) return;
      if (!map!.getLayer(CLUSTER_LAYER)) return;

      const features = map!.queryRenderedFeatures(e.point, { layers: [CLUSTER_LAYER] });
      if (features.length === 0) return;

      const clusterId = features[0].properties?.cluster_id as number;
      const source = map!.getSource(CLUSTER_SOURCE) as maplibregl.GeoJSONSource;

      source.getClusterLeaves(clusterId, 100, 0).then((leaves) => {
        const clusterEvents: MapEvent[] = leaves.map((leaf) => {
          const p = leaf.properties!;
          return {
            id: p.eventId,
            event_type: p.event_type,
            event_icon: p.event_icon,
            event_label: p.event_label,
            event_location: { name: p.locationName, lat: p.locationLat, lng: p.locationLng },
            event_count: p.event_count,
            date: p.date,
            severity: p.severity || undefined,
            summary: p.summary || undefined,
            sourceChannel: p.sourceChannel || undefined,
            verificationStatus: p.verificationStatus || undefined,
          };
        });
        const coords = (features[0].geometry as GeoJSON.Point).coordinates;
        setClusterPopup({ lngLat: [coords[0], coords[1]], events: clusterEvents });
      });
    }

    // Pin click → single event popup
    function onPinClick(e: maplibregl.MapMouseEvent) {
      if (drawingModeRef.current || placementModeRef.current || pathDrawingUnitIdRef.current) return;
      const features = map!.queryRenderedFeatures(e.point, { layers: [PIN_LAYER].filter(id => !!map!.getLayer(id)) });
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

    function onPinEnter(e: maplibregl.MapMouseEvent) {
      if (drawingModeRef.current || placementModeRef.current || pathDrawingUnitIdRef.current) return;
      map!.getCanvas().style.cursor = "pointer";
      if (clickedEventRef?.current) return;
      const features = map!.queryRenderedFeatures(e.point, { layers: [PIN_LAYER].filter(id => !!map!.getLayer(id)) });
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

    function onPinLeave() {
      if (drawingModeRef.current || placementModeRef.current || pathDrawingUnitIdRef.current) return;
      map!.getCanvas().style.cursor = "";
      if (clickedEventRef?.current) return;
      setPopupEvent(null);
    }

    function onClusterEnter() { map!.getCanvas().style.cursor = "pointer"; }
    function onClusterLeave() { map!.getCanvas().style.cursor = ""; }

    map.on("click", CLUSTER_LAYER, onClusterClick);
    map.on("mouseenter", CLUSTER_LAYER, onClusterEnter);
    map.on("mouseleave", CLUSTER_LAYER, onClusterLeave);
    map.on("click", PIN_LAYER, onPinClick);
    map.on("mouseenter", PIN_LAYER, onPinEnter);
    map.on("mouseleave", PIN_LAYER, onPinLeave);

    return () => {
      map.off("click", CLUSTER_LAYER, onClusterClick);
      map.off("mouseenter", CLUSTER_LAYER, onClusterEnter);
      map.off("mouseleave", CLUSTER_LAYER, onClusterLeave);
      map.off("click", PIN_LAYER, onPinClick);
      map.off("mouseenter", PIN_LAYER, onPinEnter);
      map.off("mouseleave", PIN_LAYER, onPinLeave);
    };
  }, [mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps
}
