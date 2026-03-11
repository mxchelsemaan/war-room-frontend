import maplibregl from "maplibre-gl";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import { Map, Marker, Popup, AttributionControl } from "react-map-gl/maplibre";
import { DrawingLayers } from "./DrawingLayers";
import { FloatAnnotationOverlay } from "./FloatAnnotationOverlay";
import type { MapEvent } from "@/data/index";
import type { LayerVisibility } from "./MapLayerControls";
import type { Annotation, AnnotationType, ArrowStyle } from "@/hooks/useDrawing";
import type { PlacedUnit, UnitPath, NATOUnitType } from "@/types/units";
import { UnitLayer } from "./UnitLayer";
import { STATIC_MARKER_COLORS } from "@/data/staticMarkers";
import type { StaticMarker, StaticMarkerType } from "@/data/staticMarkers";
import { GOVERNORATES, SUBGOVERNORATES } from "@/data/governorates";
import { DEFAULT_VIEW as _DEFAULT_VIEW, MAX_BOUNDS as _MAX_BOUNDS } from "@/config/map";
import type { HeatmapSettings, MonitorMode } from "@/config/map";

import { useKeyboardCamera } from "@/hooks/map/useKeyboardCamera";
import { useTerrainLayer } from "@/hooks/map/useTerrainLayer";
import { useRiverLayers } from "@/hooks/map/useRiverLayers";
import { useOverlayLayers } from "@/hooks/map/useOverlayLayers";
import { useHeatmapLayer } from "@/hooks/map/useHeatmapLayer";
import { useEventLayers } from "@/hooks/map/useEventLayers";
import { useMapAnimation } from "@/hooks/map/useMapAnimation";
import { useClusterLayer } from "@/hooks/map/useClusterLayer";
import { useInfraLayers } from "@/hooks/map/useInfraLayers";
import { ClusterPopup } from "./ClusterPopup";
import type { ClusterPopupData } from "./ClusterPopup";

try {
  maplibregl.setRTLTextPlugin(
    "https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js",
    true
  );
} catch { /* already set (HMR) */ }

export const DEFAULT_VIEW = _DEFAULT_VIEW;
const MAX_BOUNDS = _MAX_BOUNDS;

// ── Governorate label style (static, module-level) ──────────────────────────
const GOV_LABEL_STYLE: React.CSSProperties = {
  pointerEvents: "none",
  textTransform: "uppercase",
  fontSize: 14,
  fontWeight: 400,
  fontFamily: "'Noto Sans', system-ui, sans-serif",
  color: "rgb(101,101,101)",
  textShadow:
    "-1px -1px 0 rgba(0,0,0,0.7), 1px -1px 0 rgba(0,0,0,0.7), -1px 1px 0 rgba(0,0,0,0.7), 1px 1px 0 rgba(0,0,0,0.7)",
  whiteSpace: "nowrap",
  userSelect: "none",
};

const GovernorateLabels = React.memo(function GovernorateLabels({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <>
      {GOVERNORATES.map((gov) => (
        <Marker key={gov.id} longitude={gov.lng} latitude={gov.lat} anchor="center"
          pitchAlignment="viewport" rotationAlignment="viewport">
          <div style={GOV_LABEL_STYLE}>{gov.nameEn}</div>
        </Marker>
      ))}
    </>
  );
});

// ── Subgovernorate (district) label style ────────────────────────────────────
const SUBGOV_LABEL_STYLE: React.CSSProperties = {
  pointerEvents: "none",
  textTransform: "uppercase",
  fontSize: 10,
  fontWeight: 400,
  fontFamily: "'Noto Sans', system-ui, sans-serif",
  color: "rgb(101,101,101)",
  textShadow:
    "-1px -1px 0 rgba(0,0,0,0.7), 1px -1px 0 rgba(0,0,0,0.7), -1px 1px 0 rgba(0,0,0,0.7), 1px 1px 0 rgba(0,0,0,0.7)",
  whiteSpace: "nowrap",
  userSelect: "none",
};

const SubgovernorateLabels = React.memo(function SubgovernorateLabels({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <>
      {SUBGOVERNORATES.map((sg) => (
        <Marker key={sg.id} longitude={sg.lng} latitude={sg.lat} anchor="center"
          pitchAlignment="viewport" rotationAlignment="viewport">
          <div style={SUBGOV_LABEL_STYLE}>{sg.nameEn}</div>
        </Marker>
      ))}
    </>
  );
});

interface AtlasMapProps {
  events: MapEvent[];
  layers: LayerVisibility;
  selectedInfraTypes: Set<StaticMarkerType>;
  annotations: Annotation[];
  drawingMode: AnnotationType | null;
  drawingColor?: string;
  tempDrawingCoords: [number, number][];
  onMapClick: (lngLat: [number, number]) => void;
  onMapDblClick: (lngLat: [number, number]) => void;
  onDeleteAnnotation: (id: string) => void;
  externalMapRef?: React.RefObject<MapRef | null>;
  previewWidth?: number;
  previewArrowStyle?: ArrowStyle;
  dark?: boolean;
  placedUnits?: PlacedUnit[];
  unitPaths?: UnitPath[];
  placementMode?: NATOUnitType | null;
  pathDrawingUnitId?: string | null;
  onPlaceUnit?: (lngLat: [number, number]) => void;
  onAddPathWaypoint?: (lngLat: [number, number]) => void;
  onFinishPath?: () => void;
  onSelectAnnotation?: (id: string) => void;
  heatmapSettings?: HeatmapSettings;
  monitorMode?: MonitorMode;
  rotatingUnitId?: string | null;
  onStartRotation?: (unitId: string) => void;
  onRotateUnitToward?: (lngLat: [number, number]) => void;
  onStopRotation?: () => void;
}

export const AtlasMap = React.memo(function AtlasMap({
  events, layers, selectedInfraTypes,
  annotations, drawingMode, drawingColor, tempDrawingCoords,
  onMapClick, onMapDblClick, onDeleteAnnotation, onSelectAnnotation,
  externalMapRef,
  previewWidth = 2, previewArrowStyle = "simple",
  dark = true,
  placedUnits, unitPaths, placementMode, pathDrawingUnitId,
  onPlaceUnit, onAddPathWaypoint, onFinishPath,
  heatmapSettings,
  monitorMode = "auto",
  rotatingUnitId, onStartRotation, onRotateUnitToward, onStopRotation,
}: AtlasMapProps) {
  const crossfadeEnabled = monitorMode === "auto";
  const internalMapRef = useRef<MapRef>(null);
  const mapRef = (externalMapRef ?? internalMapRef) as React.RefObject<MapRef>;

  const layersRef = useRef(layers);
  const eventsRef = useRef(events);
  layersRef.current = layers;
  eventsRef.current = events;

  // Counter that increments on each map style load, used as dependency
  // for hooks to re-initialize layers after style reloads (HMR, theme change).
  const [mapReadyKey, setMapReadyKey] = useState(0);
  const mapLoaded = mapReadyKey > 0;

  const [popupEvent, setPopupEvent] = useState<MapEvent | null>(null);
  const [popupInfra, setPopupInfra] = useState<StaticMarker | null>(null);
  const [popupAnnotation, setPopupAnnotation] = useState<{ annotation: Annotation; lngLat: [number, number] } | null>(null);
  const [clusterPopup, setClusterPopup] = useState<ClusterPopupData | null>(null);

  const drawingModeRef = useRef(drawingMode);
  drawingModeRef.current = drawingMode;
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const onMapDblClickRef = useRef(onMapDblClick);
  onMapDblClickRef.current = onMapDblClick;
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;

  const placementModeRef = useRef(placementMode ?? null);
  placementModeRef.current = placementMode ?? null;
  const pathDrawingUnitIdRef = useRef(pathDrawingUnitId ?? null);
  pathDrawingUnitIdRef.current = pathDrawingUnitId ?? null;
  const onPlaceUnitRef = useRef(onPlaceUnit);
  onPlaceUnitRef.current = onPlaceUnit;
  const onAddWaypointRef = useRef(onAddPathWaypoint);
  onAddWaypointRef.current = onAddPathWaypoint;
  const onFinishPathRef = useRef(onFinishPath);
  onFinishPathRef.current = onFinishPath;

  const rotatingUnitIdRef = useRef(rotatingUnitId ?? null);
  rotatingUnitIdRef.current = rotatingUnitId ?? null;
  const onRotateUnitTowardRef = useRef(onRotateUnitToward);
  onRotateUnitTowardRef.current = onRotateUnitToward;
  const onStopRotationRef = useRef(onStopRotation);
  onStopRotationRef.current = onStopRotation;

  // ── Memoized style for <Map> ─────────────────────────────────────────
  const mapStyle = useMemo<React.CSSProperties>(
    () => ({ width: "100%", height: "100%", cursor: rotatingUnitId ? "crosshair" : (drawingMode || placementMode || pathDrawingUnitId) ? "crosshair" : undefined }),
    [drawingMode, placementMode, pathDrawingUnitId, rotatingUnitId],
  );

  // ── Re-init layers on style reload (HMR, theme change) ──────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    const handleStyleLoad = () => {
      // style.load fires when setStyle() completes (theme change, HMR).
      // All custom layers/sources are destroyed — bump mapReadyKey so hooks re-create them.
      setMapReadyKey((k) => k + 1);
    };
    map.on("style.load", handleStyleLoad);
    return () => { map.off("style.load", handleStyleLoad); };
  }, [mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Extracted hooks ──────────────────────────────────────────────────
  // Pass mapReadyKey (not mapLoaded boolean) so hooks re-run on style reload
  useMapAnimation(mapRef, layersRef, mapReadyKey);
  useTerrainLayer(mapRef, layers.terrain, layers.hillshade, mapReadyKey);
  useRiverLayers(mapRef, layers.rivers, mapReadyKey);
  useOverlayLayers(mapRef, layers, mapReadyKey);
  useHeatmapLayer(mapRef, events, layers.heatmap, mapReadyKey, heatmapSettings, layers.terrain, crossfadeEnabled, dark);
  useClusterLayer(
    mapRef, events, layers.heatmap, mapReadyKey,
    setClusterPopup,
    drawingModeRef, placementModeRef, pathDrawingUnitIdRef,
    crossfadeEnabled,
  );
  useEventLayers(
    mapRef, events, layers.markers, mapReadyKey,
    drawingModeRef, placementModeRef, pathDrawingUnitIdRef,
    setPopupEvent, setPopupInfra as (v: null) => void,
    dark, layers.terrain, crossfadeEnabled,
  );
  useInfraLayers(
    mapRef, layers.infrastructure, selectedInfraTypes, mapReadyKey,
    drawingModeRef, placementModeRef, pathDrawingUnitIdRef,
    setPopupInfra, setPopupEvent as (v: null) => void,
    dark, layers.terrain,
  );
  useKeyboardCamera(mapRef, layersRef);

  // ── Mouse-direction rotation: mousemove updates bearing + aim line ───
  useEffect(() => {
    if (!mapLoaded || !rotatingUnitId) return;
    const m = mapRef.current?.getMap();
    if (!m) return;

    const srcId = "unit-rotate-line-src";
    const lyrId = "unit-rotate-line-lyr";

    // Find the rotating unit's position
    const unit = (placedUnits ?? []).find(u => u.id === rotatingUnitId);
    const origin: [number, number] | null = unit ? unit.position : null;

    // Create aim-line source + layer
    const emptyLine: GeoJSON.Feature = {
      type: "Feature",
      geometry: { type: "LineString", coordinates: origin ? [origin, origin] : [] },
      properties: {},
    };
    if (!m.getSource(srcId)) {
      m.addSource(srcId, { type: "geojson", data: emptyLine });
    }
    if (!m.getLayer(lyrId)) {
      m.addLayer({
        id: lyrId,
        type: "line",
        source: srcId,
        paint: {
          "line-color": unit?.color ?? "#ffffff",
          "line-width": 2,
          "line-dasharray": [4, 3],
          "line-opacity": 0.7,
        },
        layout: { "line-cap": "round" },
      });
    }

    function onMouseMove(e: maplibregl.MapMouseEvent) {
      onRotateUnitTowardRef.current?.([e.lngLat.lng, e.lngLat.lat]);
      // Update aim line
      if (origin) {
        const src = m!.getSource(srcId) as maplibregl.GeoJSONSource | undefined;
        src?.setData({
          type: "Feature",
          geometry: { type: "LineString", coordinates: [origin, [e.lngLat.lng, e.lngLat.lat]] },
          properties: {},
        });
      }
    }
    function onClick() {
      onStopRotationRef.current?.();
    }

    m.on("mousemove", onMouseMove);
    m.on("click", onClick);
    return () => {
      m.off("mousemove", onMouseMove);
      m.off("click", onClick);
      if (m.getLayer(lyrId)) m.removeLayer(lyrId);
      if (m.getSource(srcId)) m.removeSource(srcId);
    };
  }, [mapLoaded, rotatingUnitId, placedUnits]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Disable doubleClickZoom while drawing or path drawing ────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const m = mapRef.current?.getMap();
    if (!m) return;
    if (drawingMode || pathDrawingUnitId) {
      m.doubleClickZoom.disable();
    } else {
      m.doubleClickZoom.enable();
    }
  }, [drawingMode, pathDrawingUnitId, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="absolute inset-0">
      <Map
        ref={mapRef}
        initialViewState={DEFAULT_VIEW}
        minZoom={7}
        maxZoom={14}
        maxBounds={MAX_BOUNDS}
        maxPitch={85}
        style={mapStyle}
        mapStyle={dark ? "https://tiles.openfreemap.org/styles/dark" : "https://tiles.openfreemap.org/styles/bright"}
        dragRotate={true}
        touchZoomRotate={true}
        keyboard={false}
        attributionControl={false}
        onLoad={() => setMapReadyKey((k) => k + 1)}
        onClick={(e) => {
          if (rotatingUnitIdRef.current) {
            // Click confirms rotation — handled by the mousemove effect
            return;
          }
          if (drawingModeRef.current) {
            onMapClickRef.current([e.lngLat.lng, e.lngLat.lat]);
            return;
          }
          if (placementModeRef.current) {
            onPlaceUnitRef.current?.([e.lngLat.lng, e.lngLat.lat]);
            return;
          }
          if (pathDrawingUnitIdRef.current) {
            onAddWaypointRef.current?.([e.lngLat.lng, e.lngLat.lat]);
            return;
          }
          const m = mapRef.current?.getMap();
          if (m) {
            // Check if tap hit an event pin or infra pin (handled by layer-specific listeners)
            const pinLayers = ["event-pins", "infra-pin", "cluster-count"].filter(id => m.getLayer(id));
            const pinHit = pinLayers.length > 0 && m.queryRenderedFeatures(e.point, { layers: pinLayers }).length > 0;

            const allAnnotationLayers = [
              "draw-line-main", "draw-line-dashed",
              "draw-arrow-main", "draw-arrow-dashed",
              "draw-arrow-head-fill", "draw-arrow-jagged-fill",
              "draw-area-fill", "draw-area-edge", "draw-area-edge-dashed",
            ].filter(id => m.getLayer(id));
            let annotationHit = false;
            if (allAnnotationLayers.length > 0) {
              const features = m.queryRenderedFeatures(e.point, {
                layers: allAnnotationLayers,
              });
              if (features.length > 0) {
                annotationHit = true;
                const id = features[0].properties?.id as string | undefined;
                const ann = annotationsRef.current.find(a => a.id === id);
                if (ann) {
                  if (onSelectAnnotation) {
                    onSelectAnnotation(ann.id);
                  } else {
                    setPopupAnnotation({ annotation: ann, lngLat: [e.lngLat.lng, e.lngLat.lat] });
                    setPopupEvent(null);
                    setPopupInfra(null);
                  }
                }
              }
            }

            // Tapped empty space — dismiss all popups
            if (!pinHit && !annotationHit) {
              setPopupEvent(null);
              setPopupInfra(null);
              setPopupAnnotation(null);
              setClusterPopup(null);
            }
          }
        }}
        onDblClick={(e) => {
          if (drawingModeRef.current) {
            e.preventDefault();
            onMapDblClickRef.current([e.lngLat.lng, e.lngLat.lat]);
            return;
          }
          if (pathDrawingUnitIdRef.current) {
            e.preventDefault();
            onFinishPathRef.current?.();
          }
        }}
      >
        <AttributionControl compact={true} position="bottom-right" />

        {/* ── Drawing layers ── */}
        {mapLoaded && layers.annotations !== false && (
          <DrawingLayers
            annotations={annotations}
            previewMode={drawingMode}
            previewColor={drawingColor}
            tempCoords={tempDrawingCoords}
            previewWidth={previewWidth}
            previewArrowStyle={previewArrowStyle}
            terrainActive={layers.terrain}
            onPinClick={(ann, lngLat) => {
              setPopupAnnotation({ annotation: ann, lngLat });
              setPopupEvent(null);
              setPopupInfra(null);
            }}
          />
        )}

        {/* ── Animated units ── */}
        {mapLoaded && layers.units && (
          <UnitLayer
            terrain={layers.terrain}
            units={placedUnits ?? []}
            paths={unitPaths ?? []}
            onStartRotation={onStartRotation}
          />
        )}

        {/* ── Governorate labels ── */}
        <GovernorateLabels visible={layers.governorates} />
        {/* ── Subgovernorate (district) labels ── */}
        <SubgovernorateLabels visible={layers.subgovernorates} />

        {/* ── Infrastructure markers (native symbol layer via useInfraLayers) ── */}

        {/* ── Event popup ── */}
        {popupEvent && (
          <Popup longitude={popupEvent.event_location.lng} latitude={popupEvent.event_location.lat}
            anchor="bottom" offset={22} onClose={() => setPopupEvent(null)} closeOnClick={false}
            maxWidth="280px">
            <div className="flex flex-col gap-1.5 pr-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{popupEvent.event_icon}</span>
                <span className="font-semibold text-sm text-foreground">{popupEvent.event_label}</span>
                {popupEvent.severity && (
                  <span className={`ml-auto rounded-full px-1.5 py-0.5 text-2xs font-semibold leading-none ${
                    popupEvent.severity === "critical" ? "bg-red-600 text-white" :
                    popupEvent.severity === "major" ? "bg-red-500 text-white" :
                    popupEvent.severity === "moderate" ? "bg-amber-500 text-white" :
                    "bg-slate-400 text-white"
                  }`}>
                    {popupEvent.severity}
                  </span>
                )}
              </div>
              {popupEvent.summary && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{popupEvent.summary}</p>
              )}
              <div className="text-muted-foreground text-xs flex items-center gap-1">
                <span>📍</span> {popupEvent.event_location.name}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>{popupEvent.date}</span>
                {popupEvent.sourceChannel && (
                  <span className="text-muted-foreground/70">· {popupEvent.sourceChannel}</span>
                )}
                {popupEvent.verificationStatus && popupEvent.verificationStatus !== "reported" && (
                  <span className="rounded bg-muted px-1 py-0.5 text-2xs">{popupEvent.verificationStatus}</span>
                )}
              </div>
            </div>
          </Popup>
        )}

        {/* ── Infrastructure popup ── */}
        {popupInfra && (
          <Popup longitude={popupInfra.lng} latitude={popupInfra.lat}
            anchor="bottom" offset={18} onClose={() => setPopupInfra(null)} closeOnClick={false}>
            <div className="flex flex-col gap-1 pr-3">
              <div className="text-xl text-center">{popupInfra.icon}</div>
              <div className="font-semibold text-sm text-foreground">{popupInfra.label}</div>
              {popupInfra.sublabel && <div className="text-muted-foreground text-xs">{popupInfra.sublabel}</div>}
              <span className="mt-1 self-start rounded px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide"
                style={{ background: STATIC_MARKER_COLORS[popupInfra.type] + "22", color: STATIC_MARKER_COLORS[popupInfra.type] }}>
                {popupInfra.type}
              </span>
            </div>
          </Popup>
        )}

        {/* ── Annotation popup ── */}
        {popupAnnotation && (
          <Popup
            longitude={popupAnnotation.lngLat[0]}
            latitude={popupAnnotation.lngLat[1]}
            anchor="bottom" offset={14}
            onClose={() => setPopupAnnotation(null)}
            closeOnClick={false}
          >
            <div className="flex flex-col gap-1.5 pr-3">
              <div className="flex items-center gap-2">
                <div className="size-2.5 rounded-full shrink-0" style={{ background: popupAnnotation.annotation.color }} />
                <span className="font-semibold text-sm text-foreground">{popupAnnotation.annotation.label}</span>
              </div>
              <button
                onClick={() => {
                  onDeleteAnnotation(popupAnnotation.annotation.id);
                  setPopupAnnotation(null);
                }}
                className="self-start rounded px-2 py-0.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-950/40 transition-colors"
              >
                Delete
              </button>
            </div>
          </Popup>
        )}
        {/* ── Cluster popup ── */}
        {clusterPopup && (
          <ClusterPopup
            data={clusterPopup}
            onClose={() => setClusterPopup(null)}
            onSelectEvent={(evt) => {
              setClusterPopup(null);
              setPopupEvent(evt);
            }}
          />
        )}
      </Map>

      {/* ── Strategy-game vignette ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 75% 80% at 50% 50%, transparent 0%, rgba(0,0,0,0.05) 65%, rgba(0,0,0,0.18) 85%, rgba(0,0,0,0.32) 100%)" }}
      />

      {/* ── Float annotation overlay ── */}
      {mapLoaded && layers.annotations !== false && (
        <FloatAnnotationOverlay annotations={annotations} mapRef={mapRef} terrainActive={layers.terrain} />
      )}
    </div>
  );
});
