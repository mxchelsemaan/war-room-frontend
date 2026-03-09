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
import { FlightLayer } from "./FlightLayer";
import { ShipLayer } from "./ShipLayer";
import { staticMarkers, STATIC_MARKER_COLORS } from "@/data/staticMarkers";
import type { StaticMarker, StaticMarkerType } from "@/data/staticMarkers";
import { GOVERNORATES } from "@/data/governorates";
import { DEFAULT_VIEW as _DEFAULT_VIEW, MAX_BOUNDS as _MAX_BOUNDS } from "@/config/map";

import { useKeyboardCamera } from "@/hooks/map/useKeyboardCamera";
import { useTerrainLayer } from "@/hooks/map/useTerrainLayer";
import { useRiverLayers } from "@/hooks/map/useRiverLayers";
import { useOverlayLayers } from "@/hooks/map/useOverlayLayers";
import { useEventLayers } from "@/hooks/map/useEventLayers";
import { useMapAnimation } from "@/hooks/map/useMapAnimation";

try {
  maplibregl.setRTLTextPlugin(
    "https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js",
    true
  );
} catch { /* already set (HMR) */ }

export const DEFAULT_VIEW = _DEFAULT_VIEW;
const MAX_BOUNDS = _MAX_BOUNDS;

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
}

export function AtlasMap({
  events, layers, selectedInfraTypes,
  annotations, drawingMode, drawingColor, tempDrawingCoords,
  onMapClick, onMapDblClick, onDeleteAnnotation, onSelectAnnotation,
  externalMapRef,
  previewWidth = 2, previewArrowStyle = "simple",
  dark = true,
  placedUnits, unitPaths, placementMode, pathDrawingUnitId,
  onPlaceUnit, onAddPathWaypoint, onFinishPath,
}: AtlasMapProps) {
  const internalMapRef = useRef<MapRef>(null);
  const mapRef = (externalMapRef ?? internalMapRef) as React.RefObject<MapRef>;

  const layersRef = useRef(layers);
  const eventsRef = useRef(events);
  layersRef.current = layers;
  eventsRef.current = events;

  const [mapLoaded, setMapLoaded] = useState(false);
  const [popupEvent, setPopupEvent] = useState<MapEvent | null>(null);
  const [popupInfra, setPopupInfra] = useState<StaticMarker | null>(null);
  const [popupAnnotation, setPopupAnnotation] = useState<{ annotation: Annotation; lngLat: [number, number] } | null>(null);

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

  // ── Extracted hooks ──────────────────────────────────────────────────
  useMapAnimation(mapRef, layersRef, mapLoaded);
  useTerrainLayer(mapRef, layers.terrain, layers.hillshade, mapLoaded);
  useRiverLayers(mapRef, layers.rivers, mapLoaded);
  useOverlayLayers(mapRef, layers, mapLoaded);
  useEventLayers(
    mapRef, events, layers.markers, layers.heatmap, mapLoaded,
    drawingModeRef, placementModeRef, pathDrawingUnitIdRef,
    setPopupEvent, setPopupInfra as (v: null) => void,
  );
  useKeyboardCamera(mapRef, layersRef);

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
        style={{ width: "100%", height: "100%", cursor: (drawingMode || placementMode || pathDrawingUnitId) ? "crosshair" : undefined }}
        mapStyle={dark ? "https://tiles.openfreemap.org/styles/dark" : "https://tiles.openfreemap.org/styles/bright"}
        dragRotate={true}
        touchZoomRotate={true}
        attributionControl={false}
        onLoad={() => setMapLoaded(true)}
        onClick={(e) => {
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
            const allAnnotationLayers = [
              "draw-line-main", "draw-line-dashed",
              "draw-arrow-main", "draw-arrow-dashed",
              "draw-arrow-head-fill", "draw-arrow-jagged-fill",
              "draw-area-fill", "draw-area-edge", "draw-area-edge-dashed",
            ].filter(id => m.getLayer(id));
            if (allAnnotationLayers.length > 0) {
              const features = m.queryRenderedFeatures(e.point, {
                layers: allAnnotationLayers,
              });
              if (features.length > 0) {
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
        {mapLoaded && (
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
          />
        )}

        {/* ── Animated flights ── */}
        {mapLoaded && layers.flights && <FlightLayer terrain={layers.terrain} />}
        {/* ── Animated ships ── */}
        {mapLoaded && layers.ships && <ShipLayer terrain={layers.terrain} />}

        {/* ── Governorate labels ── */}
        {layers.governorates && GOVERNORATES.map((gov) => (
          <Marker key={gov.id} longitude={gov.lng} latitude={gov.lat} anchor="center"
            pitchAlignment="viewport" rotationAlignment="viewport">
            <div style={{
              pointerEvents: "none",
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              color: "#e2e8f0",
              opacity: 1,
              textShadow: "0 0 8px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,0.9), 0 1px 4px rgba(0,0,0,0.9)",
              whiteSpace: "nowrap",
              userSelect: "none",
            }}>
              {gov.nameEn}
            </div>
          </Marker>
        ))}

        {/* ── Infrastructure markers ── */}
        {layers.infrastructure && staticMarkers.filter(m => selectedInfraTypes.has(m.type)).map((marker) => (
          <Marker key={marker.id} longitude={marker.lng} latitude={marker.lat}
            anchor={layers.terrain ? "bottom" : "center"}
            pitchAlignment="viewport" rotationAlignment="viewport"
            onClick={(e) => { e.originalEvent.stopPropagation(); setPopupEvent(null); setPopupInfra(marker); }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}>
              <div style={{ width: 28, height: 28, background: "#0f172a", border: `2px solid ${STATIC_MARKER_COLORS[marker.type]}`,
                borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
                boxShadow: `0 0 8px ${STATIC_MARKER_COLORS[marker.type]}66` }}>
                {marker.icon}
              </div>
              {layers.terrain && (
                <div style={{ width: 3, height: 70, background: `linear-gradient(to bottom, ${STATIC_MARKER_COLORS[marker.type]}cc, transparent)` }} />
              )}
            </div>
          </Marker>
        ))}

        {/* ── Event popup ── */}
        {popupEvent && (
          <Popup longitude={popupEvent.event_location.lng} latitude={popupEvent.event_location.lat}
            anchor="bottom" offset={22} onClose={() => setPopupEvent(null)} closeOnClick={true}>
            <div className="flex flex-col gap-1 pr-3">
              <div className="text-xl text-center">{popupEvent.event_icon}</div>
              <div className="font-semibold text-sm text-foreground">{popupEvent.event_label}</div>
              <div className="text-muted-foreground text-xs">📍 {popupEvent.event_location.name}</div>
              <div className="text-xs text-foreground">Count: <span className="font-semibold">{popupEvent.event_count}</span></div>
              <div className="text-[11px] text-muted-foreground">{popupEvent.date}</div>
            </div>
          </Popup>
        )}

        {/* ── Infrastructure popup ── */}
        {popupInfra && (
          <Popup longitude={popupInfra.lng} latitude={popupInfra.lat}
            anchor="bottom" offset={18} onClose={() => setPopupInfra(null)} closeOnClick={true}>
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
            closeOnClick={true}
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
      </Map>

      {/* ── Strategy-game vignette ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 75% 80% at 50% 50%, transparent 0%, rgba(0,0,0,0.05) 65%, rgba(0,0,0,0.18) 85%, rgba(0,0,0,0.32) 100%)" }}
      />

      {/* ── Float annotation overlay ── */}
      {mapLoaded && (
        <FloatAnnotationOverlay annotations={annotations} mapRef={mapRef} terrainActive={layers.terrain} />
      )}
    </div>
  );
}
