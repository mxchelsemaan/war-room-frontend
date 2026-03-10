import { useEffect, useMemo, useRef } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type maplibregl from "maplibre-gl";
import type { MapEvent } from "@/data/index";
import type { AnnotationType } from "@/hooks/useDrawing";
import type { NATOUnitType } from "@/types/units";
import type { ClusterPopupData } from "@/components/atlas/ClusterPopup";
import { registerClusterBadgeImage } from "@/lib/mapUtils";
import { CROSSFADE } from "@/config/map";

const CLUSTER_SOURCE = "events-clusters";
const CLUSTER_LAYER = "cluster-count";

export function useClusterLayer(
  mapRef: React.RefObject<MapRef | null>,
  events: MapEvent[],
  heatmapEnabled: boolean,
  mapLoaded: number | boolean,
  setClusterPopup: (data: ClusterPopupData | null) => void,
  drawingModeRef: React.RefObject<AnnotationType | null>,
  placementModeRef: React.RefObject<NATOUnitType | null>,
  pathDrawingUnitIdRef: React.RefObject<string | null>,
  crossfadeEnabled: boolean = false,
) {
  const geoJson = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: "FeatureCollection",
    features: events.map((e) => ({
      type: "Feature" as const,
      properties: {
        eventId: e.id,
        event_type: e.event_type,
        event_icon: e.event_icon,
        event_label: e.event_label,
        event_count: e.event_count,
        date: e.date,
        severity: e.severity ?? "",
        summary: e.summary ?? "",
        sourceChannel: e.sourceChannel ?? "",
        verificationStatus: e.verificationStatus ?? "",
        locationName: e.event_location.name,
        locationLat: e.event_location.lat,
        locationLng: e.event_location.lng,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [e.event_location.lng, e.event_location.lat],
      },
    })),
  }), [events]);

  const eventsRef = useRef(events);
  eventsRef.current = events;

  // ── Create / update source + layer ────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    registerClusterBadgeImage(map);

    const vis = heatmapEnabled ? "visible" : "none";

    if (!map.getSource(CLUSTER_SOURCE)) {
      map.addSource(CLUSTER_SOURCE, {
        type: "geojson",
        data: geoJson,
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 14,
      });

      // Insert above heatmap, below event-pulse
      const beforeLayer = map.getLayer("event-pulse") ? "event-pulse" : map.getLayer("event-pins") ? "event-pins" : undefined;

      const opacityExpr = crossfadeEnabled
        ? ["interpolate", ["linear"], ["zoom"], CROSSFADE.HEATMAP_FULL, 1, CROSSFADE.FADE_END, 0] as unknown as maplibregl.ExpressionSpecification
        : 1;

      map.addLayer({
        id: CLUSTER_LAYER,
        type: "symbol",
        source: CLUSTER_SOURCE,
        filter: ["has", "point_count"],
        layout: {
          visibility: vis,
          "icon-image": "cluster-badge",
          "icon-size": 0.65,
          "icon-allow-overlap": true,
          "text-field": ["get", "point_count_abbreviated"] as unknown as maplibregl.ExpressionSpecification,
          "text-font": ["Noto Sans Regular"],
          "text-size": 14,
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(0,0,0,0.7)",
          "text-halo-width": 1.5,
          "icon-opacity": opacityExpr as unknown as maplibregl.ExpressionSpecification,
          "text-opacity": opacityExpr as unknown as maplibregl.ExpressionSpecification,
        },
      } as maplibregl.LayerSpecification, beforeLayer);
    } else {
      (map.getSource(CLUSTER_SOURCE) as maplibregl.GeoJSONSource).setData(geoJson);
    }
  }, [geoJson, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Visibility toggle ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map || !map.getLayer(CLUSTER_LAYER)) return;
    map.setLayoutProperty(CLUSTER_LAYER, "visibility", heatmapEnabled ? "visible" : "none");
  }, [heatmapEnabled, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Click handler ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    function onClick(e: maplibregl.MapMouseEvent) {
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
            event_location: {
              name: p.locationName,
              lat: p.locationLat,
              lng: p.locationLng,
            },
            event_count: p.event_count,
            date: p.date,
            severity: p.severity || undefined,
            summary: p.summary || undefined,
            sourceChannel: p.sourceChannel || undefined,
            verificationStatus: p.verificationStatus || undefined,
          };
        });

        const coords = (features[0].geometry as GeoJSON.Point).coordinates;
        setClusterPopup({
          lngLat: [coords[0], coords[1]],
          events: clusterEvents,
        });
      });
    }

    function onMouseEnter() {
      map!.getCanvas().style.cursor = "pointer";
    }
    function onMouseLeave() {
      map!.getCanvas().style.cursor = "";
    }

    map.on("click", CLUSTER_LAYER, onClick);
    map.on("mouseenter", CLUSTER_LAYER, onMouseEnter);
    map.on("mouseleave", CLUSTER_LAYER, onMouseLeave);

    return () => {
      map.off("click", CLUSTER_LAYER, onClick);
      map.off("mouseenter", CLUSTER_LAYER, onMouseEnter);
      map.off("mouseleave", CLUSTER_LAYER, onMouseLeave);
    };
  }, [mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps
}
