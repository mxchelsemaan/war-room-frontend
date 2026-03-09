import { useEffect, useMemo, useRef } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type maplibregl from "maplibre-gl";
import type { MapEvent } from "@/data/index";
import type { AnnotationType } from "@/hooks/useDrawing";
import type { NATOUnitType } from "@/types/units";
import { registerEmojiImages } from "@/lib/mapUtils";
import { EVENT_TYPE_COLORS, EVENT_COLOR_DEFAULT } from "@/config/colors";

// ── Event cluster layer IDs ──────────────────────────────────────────────────
const EVENT_CLUSTER_LAYERS = [
  "event-cluster-shadow", "event-cluster-glow", "event-clusters", "event-cluster-count",
  "event-unclustered-glow", "event-unclustered-bg", "event-unclustered",
  "event-unclustered-badge-bg", "event-unclustered-badge",
] as const;

/** Build a MapLibre `match` expression that maps event_type → color */
function eventTypeColorExpr(): maplibregl.ExpressionSpecification {
  const entries: (string)[] = [];
  for (const [type, color] of Object.entries(EVENT_TYPE_COLORS)) {
    entries.push(type, color);
  }
  return ["match", ["get", "event_type"], ...entries, EVENT_COLOR_DEFAULT] as unknown as maplibregl.ExpressionSpecification;
}

const CLUSTER_ACCENT = "#06b6d4"; // cyan-500
const DARK_FILL = "#0f172a";      // slate-900

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
) {
  // ── Memoize GeoJSON data ──────────────────────────────────────────────
  const clusterGeoJson = useMemo<GeoJSON.FeatureCollection>(() => ({
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
  }), [events]);

  const uniqueEmojis = useMemo(() => [...new Set(events.map((e) => e.event_icon))], [events]);

  // Keep refs so visibility-only effects don't depend on data
  const clusterGeoJsonRef = useRef(clusterGeoJson);
  clusterGeoJsonRef.current = clusterGeoJson;

  // ── Clustered event markers: data update ──────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    registerEmojiImages(map, uniqueEmojis);

    const vis = markersEnabled ? "visible" : "none";

    if (!map.getSource("events-clustered")) {
      map.addSource("events-clustered", {
        type: "geojson",
        data: clusterGeoJson,
        cluster: true,
        clusterMaxZoom: 13,
        clusterRadius: 50,
        clusterProperties: { totalCount: ["+", ["get", "event_count"]] },
      });

      // ── Cluster shadow ──
      map.addLayer({
        id: "event-cluster-shadow", type: "circle", source: "events-clustered",
        filter: ["has", "point_count"],
        layout: { visibility: vis },
        paint: {
          "circle-color": "#000000",
          "circle-radius": ["step", ["get", "point_count"], 24, 10, 30, 50, 36],
          "circle-blur": 0.7, "circle-opacity": 0.4, "circle-translate": [2, 2],
        },
      });

      // ── Cluster glow (cyan) ──
      map.addLayer({
        id: "event-cluster-glow", type: "circle", source: "events-clustered",
        filter: ["has", "point_count"],
        layout: { visibility: vis },
        paint: {
          "circle-color": CLUSTER_ACCENT,
          "circle-radius": ["step", ["get", "point_count"], 28, 10, 34, 50, 40],
          "circle-blur": 0.5, "circle-opacity": 0.35,
        },
      });

      // ── Cluster main circle ──
      map.addLayer({
        id: "event-clusters", type: "circle", source: "events-clustered",
        filter: ["has", "point_count"],
        layout: { visibility: vis },
        paint: {
          "circle-color": DARK_FILL,
          "circle-radius": ["step", ["get", "point_count"], 20, 10, 26, 50, 32],
          "circle-stroke-width": 2,
          "circle-stroke-color": CLUSTER_ACCENT,
        },
      });

      // ── Cluster count text ──
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
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": DARK_FILL,
          "text-halo-width": 1,
        },
      });

      // ── Unclustered glow (per-type color) ──
      map.addLayer({
        id: "event-unclustered-glow", type: "circle", source: "events-clustered",
        filter: ["!", ["has", "point_count"]],
        layout: { visibility: vis },
        paint: {
          "circle-color": eventTypeColorExpr(),
          "circle-radius": 24,
          "circle-blur": 0.5, "circle-opacity": 0.35,
        },
      });

      // ── Unclustered main circle ──
      map.addLayer({
        id: "event-unclustered-bg", type: "circle", source: "events-clustered",
        filter: ["!", ["has", "point_count"]],
        layout: { visibility: vis },
        paint: {
          "circle-color": DARK_FILL,
          "circle-radius": 18,
          "circle-stroke-width": 2,
          "circle-stroke-color": eventTypeColorExpr(),
        },
      });

      // ── Unclustered emoji ──
      map.addLayer({
        id: "event-unclustered", type: "symbol", source: "events-clustered",
        filter: ["!", ["has", "point_count"]],
        layout: {
          visibility: vis,
          "icon-image": ["concat", "emoji-", ["get", "event_icon"]],
          "icon-size": 0.55,
          "icon-allow-overlap": true, "icon-ignore-placement": true,
        },
      });

      // ── Unclustered badge background (red pill, count > 1 only) ──
      map.addLayer({
        id: "event-unclustered-badge-bg", type: "circle", source: "events-clustered",
        filter: ["all", ["!", ["has", "point_count"]], [">", ["get", "event_count"], 1]],
        layout: { visibility: vis },
        paint: {
          "circle-color": "#ef4444",
          "circle-radius": 8,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": DARK_FILL,
          "circle-translate": [12, -12],
        },
      });

      // ── Unclustered badge text (count > 1 only) ──
      map.addLayer({
        id: "event-unclustered-badge", type: "symbol", source: "events-clustered",
        filter: ["all", ["!", ["has", "point_count"]], [">", ["get", "event_count"], 1]],
        layout: {
          visibility: vis,
          "text-field": ["get", "event_count"],
          "text-font": ["Noto Sans Bold"],
          "text-size": 9,
          "text-offset": [1.2, -1.2],
          "text-allow-overlap": true, "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#ffffff",
        },
      });
    } else {
      (map.getSource("events-clustered") as maplibregl.GeoJSONSource).setData(clusterGeoJson);
    }
  }, [clusterGeoJson, uniqueEmojis, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Clustered event markers: visibility toggle ────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    const vis = markersEnabled ? "visible" : "none";
    for (const layerId of EVENT_CLUSTER_LAYERS) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", vis);
    }
  }, [markersEnabled, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cluster click handlers ────────────────────────────────────────────
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
  }, [mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps
}
