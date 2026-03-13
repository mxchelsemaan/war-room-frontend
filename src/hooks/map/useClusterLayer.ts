import { useEffect, useMemo, useRef } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type maplibregl from "maplibre-gl";
import type { MapEvent } from "@/data/index";
import type { AnnotationType } from "@/hooks/useDrawing";
import type { NATOUnitType } from "@/types/units";
import type { ClusterPopupData } from "@/components/atlas/ClusterPopup";
import { registerClusterBadgeImage, registerPinImages, PIN_BG_DARK, PIN_BG_LIGHT } from "@/lib/mapUtils";
import { getEventTypeColor } from "@/config/eventTypes";
import { CROSSFADE } from "@/config/map";

/** Shared clustered source — drives both cluster badges and individual event pins */
export const CLUSTER_SOURCE = "events-clusters";
const CLUSTER_LAYER = "cluster-count";
const PIN_LAYER = "event-pins";

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
  onEventSelectRef?: React.RefObject<((id: string | null) => void) | undefined>,
) {
  const bgFill = dark ? PIN_BG_DARK : PIN_BG_LIGHT;
  const pinPrefix = terrain ? "stem-circle-" : "pin-circle-";
  const pinAnchor = terrain ? "bottom" : "center";

  const uniqueEmojis = useMemo(() => [...new Set(events.map(e => e.event_icon))], [events]);
  const pinColors = useMemo(() => [...new Set(events.map(e => getEventTypeColor(e.event_type)))], [events]);

  const geoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    const now = crossfadeEnabled ? Date.now() : 0;
    return {
      type: "FeatureCollection",
      features: events.map((e) => {
        const props: Record<string, unknown> = {
          id: e.id,
          event_type: e.event_type,
          event_icon: e.event_icon,
          event_label: e.event_label,
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
        };
        if (crossfadeEnabled) {
          props.isRecent = now - Date.parse(e.date) < 259200000;
        }
        return {
          type: "Feature" as const,
          properties: props,
          geometry: {
            type: "Point" as const,
            coordinates: [e.event_location.lng, e.event_location.lat],
          },
        };
      }),
    };
  }, [events, crossfadeEnabled]);

  const eventsRef = useRef(events);
  eventsRef.current = events;

  // ── Create clustered source + all layers (once, or on config change) ──
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    registerClusterBadgeImage(map);
    registerPinImages(map, uniqueEmojis, pinColors, bgFill, "circle");

    // Clean up stale layers + source for full re-create
    for (const id of [PIN_LAYER, CLUSTER_LAYER]) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    // Also remove legacy layers
    if (map.getLayer("event-dots")) map.removeLayer("event-dots");
    if (map.getSource("events-points")) map.removeSource("events-points");
    if (map.getSource(CLUSTER_SOURCE)) map.removeSource(CLUSTER_SOURCE);

    map.addSource(CLUSTER_SOURCE, {
      type: "geojson",
      data: geoJson,
      cluster: true,
      clusterRadius: 40,
      clusterMaxZoom: 14,
    });

    const iconOpacity: maplibregl.ExpressionSpecification | number = crossfadeEnabled
      ? ["interpolate", ["linear"], ["zoom"],
          CROSSFADE.FADE_START, ["case", ["get", "isRecent"], 1, 0.35],
          CROSSFADE.FADE_END, 1,
        ] as unknown as maplibregl.ExpressionSpecification
      : 1;

    // ── Event pins (unclustered) ──
    map.addLayer({
      id: PIN_LAYER,
      type: "symbol",
      source: CLUSTER_SOURCE,
      minzoom: 7,
      filter: ["!", ["has", "point_count"]],
      layout: {
        visibility: "visible",
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

    // Text size must scale proportionally with icon-size so em-based
    // offsets stay correct at every zoom level.
    const clusterTextSize = terrain
      ? ["interpolate", ["linear"], ["zoom"],
          7, 14.6,   // 13 × 0.45/0.4
          12, 12.4,  // 13 × 0.38/0.4
          16, 9.8,   // 13 × 0.3/0.4
        ]
      : 13;

    // Text offset moves the label up to the badge head center.
    // icon-anchor is "bottom", so text must move up by (totalH - HEAD/2) image px.
    // In ems: -(totalH - HEAD/2) × iconSize / textSize
    // HEAD=80, ratio iconSize/textSize ≈ 0.0308 (constant across zoom)
    const R = 0.45 / 14.6; // iconSize/textSize ratio at reference zoom
    const clusterTextOffset = terrain
      ? ["step", cid5,
          ["literal", [0, -(156 - 40) * R]],   // stem-0
          1, ["literal", [0, -(172 - 40) * R]], // stem-1
          2, ["literal", [0, -(188 - 40) * R]], // stem-2
          3, ["literal", [0, -(204 - 40) * R]], // stem-3
          4, ["literal", [0, -(180 - 40) * R]], // stem-4
        ]
      : [0, 0];

    map.addLayer({
      id: CLUSTER_LAYER,
      type: "symbol",
      source: CLUSTER_SOURCE,
      filter: ["has", "point_count"],
      layout: {
        visibility: "visible",
        "icon-image": clusterIcon as unknown as maplibregl.ExpressionSpecification,
        "icon-size": clusterIconSize as unknown as number,
        "icon-anchor": terrain ? "bottom" : "center",
        "icon-overlap": "always",
        "icon-pitch-alignment": "viewport",
        "icon-rotation-alignment": "viewport",
        "text-field": ["get", "point_count_abbreviated"] as unknown as maplibregl.ExpressionSpecification,
        "text-font": ["Noto Sans Regular"],
        "text-size": clusterTextSize as unknown as number,
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
  }, [uniqueEmojis, pinColors, mapLoaded, bgFill, terrain, crossfadeEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update data without recreating layers ──────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    const source = map.getSource(CLUSTER_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(geoJson);
    }
  }, [geoJson, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toggle layer visibility without recreating layers ───────────────
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const vis = markersEnabled ? "visible" : "none";
    for (const id of [PIN_LAYER, CLUSTER_LAYER]) {
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
            id: p.id,
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
        event_location: { name: p.locationName, lat: p.locationLat, lng: p.locationLng },
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
      onEventSelectRef?.current?.(evt.id);
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
        event_location: { name: p.locationName, lat: p.locationLat, lng: p.locationLng },
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
