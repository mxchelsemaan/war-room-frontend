import { useEffect, useMemo, useRef } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type maplibregl from "maplibre-gl";
import type { AnnotationType } from "@/hooks/useDrawing";
import type { NATOUnitType } from "@/types/units";
import { staticMarkers, STATIC_MARKER_COLORS } from "@/data/staticMarkers";
import type { StaticMarker, StaticMarkerType } from "@/data/staticMarkers";
import { registerPinImages, PIN_BG_DARK, PIN_BG_LIGHT } from "@/lib/mapUtils";

const INFRA_LAYERS = ["infra-pin"] as const;

export function useInfraLayers(
  mapRef: React.RefObject<MapRef | null>,
  visible: boolean,
  selectedTypes: Set<StaticMarkerType>,
  mapLoaded: boolean,
  drawingModeRef: React.RefObject<AnnotationType | null>,
  placementModeRef: React.RefObject<NATOUnitType | null>,
  pathDrawingUnitIdRef: React.RefObject<string | null>,
  setPopupInfra: (infra: StaticMarker | null) => void,
  setPopupEvent: (evt: null) => void,
  dark: boolean = true,
  terrain: boolean = false,
) {
  const bgFill = dark ? PIN_BG_DARK : PIN_BG_LIGHT;
  const pinPrefix = terrain ? "stem-square-" : "pin-square-";
  const pinAnchor = terrain ? "bottom" : "center";

  const filtered = useMemo(
    () => visible ? staticMarkers.filter(m => selectedTypes.has(m.type)) : [],
    [visible, selectedTypes],
  );

  const geoJson = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: "FeatureCollection",
    features: filtered.map((m) => ({
      type: "Feature" as const,
      properties: {
        id: m.id,
        type: m.type,
        label: m.label,
        sublabel: m.sublabel ?? "",
        icon: m.icon,
        lat: m.lat,
        lng: m.lng,
        color: STATIC_MARKER_COLORS[m.type],
      },
      geometry: { type: "Point" as const, coordinates: [m.lng, m.lat] },
    })),
  }), [filtered]);

  // Unique emojis and colors for pin registration
  const uniqueEmojis = useMemo(() => [...new Set(filtered.map(m => m.icon))], [filtered]);
  const pinColors = useMemo(() => [...new Set(filtered.map(m => STATIC_MARKER_COLORS[m.type]))], [filtered]);

  const geoJsonRef = useRef(geoJson);
  geoJsonRef.current = geoJson;

  // ── Add/update source + layer ──────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    registerPinImages(map, uniqueEmojis, pinColors, bgFill, "square");

    const vis = visible ? "visible" : "none";

    if (!map.getSource("infra-markers")) {
      map.addSource("infra-markers", {
        type: "geojson",
        data: geoJson,
      });

      map.addLayer({
        id: "infra-pin",
        type: "symbol",
        source: "infra-markers",
        layout: {
          visibility: vis,
          "icon-image": ["concat", pinPrefix, bgFill, "-", ["get", "color"], "-", ["get", "icon"]] as unknown as maplibregl.ExpressionSpecification,
          "icon-size": 0.4,
          "icon-anchor": pinAnchor,
          "icon-pitch-alignment": "viewport",
          "icon-rotation-alignment": "viewport",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });
    } else {
      (map.getSource("infra-markers") as maplibregl.GeoJSONSource).setData(geoJson);
      if (map.getLayer("infra-pin")) {
        map.setLayoutProperty("infra-pin", "icon-image",
          ["concat", pinPrefix, bgFill, "-", ["get", "color"], "-", ["get", "icon"]]);
        map.setLayoutProperty("infra-pin", "icon-anchor", pinAnchor);
      }
    }
  }, [geoJson, uniqueEmojis, pinColors, mapLoaded, bgFill, terrain]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Visibility toggle ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    const vis = visible ? "visible" : "none";
    for (const layerId of INFRA_LAYERS) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", vis);
    }
  }, [visible, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Click handlers ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    function onClick(e: maplibregl.MapMouseEvent) {
      if (drawingModeRef.current || placementModeRef.current || pathDrawingUnitIdRef.current) return;
      const features = map!.queryRenderedFeatures(e.point, { layers: ["infra-pin"] });
      if (!features.length) return;
      const p = features[0].properties!;
      const infra: StaticMarker = {
        id: p.id,
        type: p.type as StaticMarkerType,
        label: p.label,
        sublabel: p.sublabel || undefined,
        icon: p.icon,
        lat: p.lat,
        lng: p.lng,
      };
      setPopupEvent(null);
      setPopupInfra(infra);
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

    map.on("click", "infra-pin", onClick);
    map.on("mouseenter", "infra-pin", onMouseEnter);
    map.on("mouseleave", "infra-pin", onMouseLeave);

    return () => {
      map.off("click", "infra-pin", onClick);
      map.off("mouseenter", "infra-pin", onMouseEnter);
      map.off("mouseleave", "infra-pin", onMouseLeave);
    };
  }, [mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps
}
