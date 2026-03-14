import { useEffect, useMemo, useRef } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type maplibregl from "maplibre-gl";
import type { AnnotationType } from "@/hooks/useDrawing";
import type { NATOUnitType } from "@/types/units";
import type { InfraPin } from "@/hooks/useInfraMarkers";
import { registerPinImages, PIN_BG_DARK, PIN_BG_LIGHT } from "@/lib/mapUtils";

const INFRA_LAYERS = ["infra-pin"] as const;

export interface InfraMarker {
  id: string;
  type: string;
  label: string;
  sublabel?: string;
  icon: string;
  lat: number;
  lng: number;
}

export function useInfraLayers(
  mapRef: React.RefObject<MapRef | null>,
  visible: boolean,
  selectedTypes: Set<string>,
  mapLoaded: number | boolean,
  drawingModeRef: React.RefObject<AnnotationType | null>,
  placementModeRef: React.RefObject<NATOUnitType | null>,
  pathDrawingUnitIdRef: React.RefObject<string | null>,
  setPopupInfra: (infra: InfraMarker | null) => void,
  setPopupEvent: (evt: null) => void,
  dark: boolean = true,
  terrain: boolean = false,
  infraMarkers: InfraPin[] = [],
  infraColors: Record<string, string> = {},
) {
  const bgFill = dark ? PIN_BG_DARK : PIN_BG_LIGHT;
  const pinPrefix = terrain ? "stem-square-" : "pin-square-";
  const pinAnchor = terrain ? "bottom" : "center";

  const filtered = useMemo(
    () => visible ? infraMarkers.filter(m => selectedTypes.has(m.type)) : [],
    [visible, selectedTypes, infraMarkers],
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
        icon: m.emoji,
        lat: m.lat,
        lng: m.lng,
        color: infraColors[m.type] ?? m.color,
      },
      geometry: { type: "Point" as const, coordinates: [m.lng, m.lat] },
    })),
  }), [filtered]);

  // Unique emojis and colors for pin registration
  const uniqueEmojis = useMemo(() => [...new Set(filtered.map(m => m.emoji))], [filtered]);
  const pinColors = useMemo(() => [...new Set(filtered.map(m => infraColors[m.type] ?? m.color))], [filtered, infraColors]);

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
          "icon-overlap": "always",
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
      const infra: InfraMarker = {
        id: p.id,
        type: p.type,
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
