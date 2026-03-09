import { useEffect, useMemo, useRef } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type maplibregl from "maplibre-gl";
import type { MapEvent } from "@/data/index";
import type { AnnotationType } from "@/hooks/useDrawing";
import type { NATOUnitType } from "@/types/units";
import { registerEmojiImages } from "@/lib/mapUtils";

// ── Event cluster layer IDs ──────────────────────────────────────────────────
const EVENT_CLUSTER_LAYERS = [
  "event-cluster-shadow", "event-clusters", "event-cluster-count",
  "event-unclustered-bg", "event-unclustered", "event-unclustered-badge",
] as const;

export function useEventLayers(
  mapRef: React.RefObject<MapRef | null>,
  events: MapEvent[],
  markersEnabled: boolean,
  heatmapEnabled: boolean,
  mapLoaded: boolean,
  drawingModeRef: React.RefObject<AnnotationType | null>,
  placementModeRef: React.RefObject<NATOUnitType | null>,
  pathDrawingUnitIdRef: React.RefObject<string | null>,
  setPopupEvent: (evt: MapEvent | null) => void,
  setPopupInfra: (infra: null) => void,
) {
  // ── Memoize GeoJSON data ──────────────────────────────────────────────
  const heatmapGeoJson = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: "FeatureCollection",
    features: events.map((e) => ({
      type: "Feature" as const,
      properties: { weight: e.event_count },
      geometry: { type: "Point" as const, coordinates: [e.event_location.lng, e.event_location.lat] },
    })),
  }), [events]);

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
  const heatmapGeoJsonRef = useRef(heatmapGeoJson);
  heatmapGeoJsonRef.current = heatmapGeoJson;
  const clusterGeoJsonRef = useRef(clusterGeoJson);
  clusterGeoJsonRef.current = clusterGeoJson;

  // ── Heatmap: data update ──────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (!map.getSource("heatmap-src")) {
      map.addSource("heatmap-src", { type: "geojson", data: heatmapGeoJson });
      map.addLayer({ id: "heatmap-layer", type: "heatmap", source: "heatmap-src",
        paint: { "heatmap-weight": ["get", "weight"], "heatmap-intensity": 1, "heatmap-radius": 60, "heatmap-opacity": 1 },
        layout: { visibility: heatmapEnabled ? "visible" : "none" } });
    } else {
      (map.getSource("heatmap-src") as maplibregl.GeoJSONSource).setData(heatmapGeoJson);
    }
  }, [heatmapGeoJson, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Heatmap: visibility toggle ────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map || !map.getLayer("heatmap-layer")) return;
    map.setLayoutProperty("heatmap-layer", "visibility", heatmapEnabled ? "visible" : "none");
  }, [heatmapEnabled, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

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

      map.addLayer({
        id: "event-clusters", type: "circle", source: "events-clustered",
        filter: ["has", "point_count"],
        layout: { visibility: vis },
        paint: {
          "circle-color": ["step", ["get", "point_count"], "#334155", 10, "#475569", 50, "#ef4444"],
          "circle-radius": ["step", ["get", "point_count"], 20, 10, 26, 50, 32],
          "circle-stroke-width": 2, "circle-stroke-color": "#1e1e2e",
        },
      });

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

      map.addLayer({
        id: "event-unclustered-bg", type: "circle", source: "events-clustered",
        filter: ["!", ["has", "point_count"]],
        layout: { visibility: vis },
        paint: {
          "circle-color": "#1e1e2e", "circle-radius": 18,
          "circle-stroke-width": 2, "circle-stroke-color": "#334155",
        },
      });

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

      map.addLayer({
        id: "event-unclustered-badge", type: "symbol", source: "events-clustered",
        filter: ["!", ["has", "point_count"]],
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
          "text-halo-color": "#ef4444",
          "text-halo-width": 5,
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
