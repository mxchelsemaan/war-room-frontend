import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import { FilterSidebar } from "./FilterSidebar";
import type { AtlasFilters } from "./FilterSidebar";
import { TimelineScrubber } from "./TimelineScrubber";
import { EventFeedPanel } from "./EventFeedPanel";
import { AISummaryCard } from "./AISummaryCard";
import { AtlasMap } from "./AtlasMap";
import { MapLayerControls } from "./MapLayerControls";
import type { LayerVisibility } from "./MapLayerControls";
import { DrawingToolbar } from "./DrawingToolbar";
import { FloatingTriggerBtn } from "./FloatingPanel";
import { Sparkles, SlidersHorizontal, List } from "lucide-react";
import { CameraControls } from "./CameraControls";
import { DEFAULT_VIEW } from "@/config/map";
import { MapLegend } from "./UnitLegend";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SettingsMenu } from "./SettingsMenu";
import { useTheme } from "@/hooks/useTheme";
import { useSettings } from "@/hooks/useSettings";
import { usePanelState } from "@/hooks/usePanelState";
import { AnnotationProvider, useAnnotationContext } from "@/context/AnnotationContext";
import { UnitPlacementProvider, useUnitPlacementContext } from "@/context/UnitPlacementContext";
import type { NATOUnitType } from "@/types/units";
import { mockEventTypes, mockMapEvents } from "@/data/index";
import type { StaticMarkerType } from "@/data/staticMarkers";
import { STATIC_MARKER_META } from "@/data/staticMarkers";
import { useIsMobile } from "@/hooks/useIsMobile";

function buildDefaultFilters(): AtlasFilters {
  return {
    selectedTypes: new Set(mockEventTypes.map((t) => t.key)),
    selectedInfraTypes: new Set(Object.keys(STATIC_MARKER_META) as StaticMarkerType[]),
    dateFrom: "",
    dateTo: "",
  };
}

export function AtlasView() {
  return (
    <AnnotationProvider>
      <UnitPlacementProvider>
        <AtlasViewInner />
      </UnitPlacementProvider>
    </AnnotationProvider>
  );
}

function AtlasViewInner() {
  const { dark, toggle: toggleTheme } = useTheme();
  const { showLabels, toggleLabels } = useSettings();
  const isMobile = useIsMobile();
  const [filters, setFilters] = useState<AtlasFilters>(buildDefaultFilters);

  const ann = useAnnotationContext();
  const up = useUnitPlacementContext();

  const filteredEvents = useMemo(() => {
    return mockMapEvents.filter((event) => {
      if (!filters.selectedTypes.has(event.event_type)) return false;
      if (filters.dateFrom && event.date < filters.dateFrom) return false;
      if (filters.dateTo && event.date > filters.dateTo) return false;
      return true;
    });
  }, [filters]);

  const timelineDates = useMemo(() => {
    const seen = new Set<string>();
    filteredEvents.forEach((e) => seen.add(e.date));
    return Array.from(seen).sort();
  }, [filteredEvents]);

  const [timelineDay, setTimelineDay] = useState<string | null>(null);
  const { isPanelOpen, togglePanel, setPanelOpen } = usePanelState();
  const [layers, setLayers] = useState<LayerVisibility>({
    terrain: false,
    hillshade: true,
    markers: true,
    rivers: true,
    frontLines: false,
    territory: false,
    infrastructure: true,
    governorates: true,
    annotations: true,
    units: true,
    flights: true,
    ships: true,
    geoLabels: false,
  });

  const mapRef = useRef<MapRef | null>(null);

  const handleClearFilters = useCallback(() => setFilters(buildDefaultFilters()), []);

  const { setSelectedAnnotationId: _setSelAnnId } = ann;
  const handleSelectAnnotation = useCallback((id: string) => {
    _setSelAnnId(id);
    setPanelOpen('draw', true);
  }, [_setSelAnnId, setPanelOpen]);

  function resetView() {
    mapRef.current?.getMap().flyTo({
      center: [DEFAULT_VIEW.longitude, DEFAULT_VIEW.latitude],
      zoom: DEFAULT_VIEW.zoom,
      pitch: layers.terrain ? 65 : DEFAULT_VIEW.pitch,
      bearing: DEFAULT_VIEW.bearing,
      duration: 900,
    });
  }

  function handleStartPlacement(type: NATOUnitType) {
    ann.cancel();
    up.startPlacement(type);
  }

  function handleStartPathDrawing(unitId: string) {
    ann.cancel();
    up.startPathDrawing(unitId);
  }

  useEffect(() => {
    setTimelineDay(null);
  }, [filters.dateFrom, filters.dateTo]);

  // Disable 3D terrain on mobile
  useEffect(() => {
    if (isMobile) {
      setLayers(prev => prev.terrain ? { ...prev, terrain: false } : prev);
    }
  }, [isMobile]);

  const mapEvents = useMemo(() => {
    if (!timelineDay) return filteredEvents;
    return filteredEvents.filter((e) => e.date === timelineDay);
  }, [filteredEvents, timelineDay]);

  return (
    <div className="flex flex-col h-full w-full min-h-0 min-w-0">
      {/* Mobile header */}
      {isMobile ? (
        <div className="relative z-[70] flex h-12 shrink-0 items-center border-b border-border px-3 gap-2">
          <button
            onClick={() => togglePanel('filter')}
            aria-label="Open filters"
            className="glass-panel size-9 flex items-center justify-center shrink-0"
          >
            <SlidersHorizontal className="size-4" />
          </button>
          <div className="flex-1 flex flex-col items-center justify-center">
            <span
              className="font-black text-[#c62828] uppercase tracking-widest leading-none"
              style={{ fontFamily: "'Inter Tight', system-ui, sans-serif", fontSize: '0.85rem', letterSpacing: '0.15em' }}
            >
              The War Room
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => togglePanel('feed')}
              aria-label="Open live feeds"
              className="glass-panel size-9 flex items-center justify-center shrink-0"
            >
              <List className="size-4" />
            </button>
            <SettingsMenu dark={dark} onToggleTheme={toggleTheme} showLabels={showLabels} onToggleLabels={toggleLabels} />
          </div>
        </div>
      ) : (
        /* Desktop header */
        <div
          className="relative z-[70] flex h-20 shrink-0 items-center border-b border-border transition-all duration-200"
          style={{
            paddingLeft: isPanelOpen('filter') ? 288 : 56,
            paddingRight: isPanelOpen('feed') ? 288 : 56,
          }}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pointer-events-none">
            <h1
              className="font-black text-[#c62828] uppercase tracking-widest leading-none"
              style={{ fontFamily: "'Inter Tight', system-ui, sans-serif", fontSize: '1.5rem', letterSpacing: '0.2em' }}
            >
              The War Room
            </h1>
            <p
              className="uppercase tracking-widest text-muted-foreground leading-none"
              style={{ fontFamily: "'Inter Tight', system-ui, sans-serif", fontWeight: 500, fontSize: '0.65rem', letterSpacing: '0.25em' }}
            >
              2026 Israeli Campaign in Lebanon — Live Monitor
            </p>
          </div>
          <div className="absolute flex items-center gap-3" style={{ right: 56 + 16 }}>
            <SettingsMenu dark={dark} onToggleTheme={toggleTheme} showLabels={showLabels} onToggleLabels={toggleLabels} />
          </div>
        </div>
      )}
      <div className="flex flex-1 min-h-0 min-w-0">
        <FilterSidebar
          eventTypes={mockEventTypes}
          allEvents={mockMapEvents}
          filters={filters}
          filteredCount={filteredEvents.length}
          onFiltersChange={setFilters}
          onClear={handleClearFilters}
          open={isPanelOpen('filter')}
          onOpenChange={(v) => setPanelOpen('filter', v)}
        />
        <div className="flex flex-1 min-h-0 min-w-0">
          <div className="relative flex-1 min-h-0 min-w-0">
            <ErrorBoundary>
            <AtlasMap
              events={mapEvents}
              layers={layers}
              dark={dark}
              selectedInfraTypes={filters.selectedInfraTypes}
              annotations={ann.annotations}
              drawingMode={ann.mode}
              drawingColor={ann.color}
              tempDrawingCoords={ann.tempCoords}
              onMapClick={ann.handleClick}
              onMapDblClick={ann.handleDblClick}
              onDeleteAnnotation={ann.deleteAnnotation}
              onSelectAnnotation={handleSelectAnnotation}
              externalMapRef={mapRef}
              previewWidth={ann.drawWidth}
              previewArrowStyle={ann.drawArrowStyle}
              placedUnits={up.units}
              unitPaths={up.paths}
              placementMode={up.placementMode}
              pathDrawingUnitId={up.pathDrawingUnitId}
              onPlaceUnit={up.placeUnit}
              onAddPathWaypoint={up.addWaypoint}
              onFinishPath={up.finishPathDrawing}
            />
            </ErrorBoundary>
            <AISummaryCard
              open={isPanelOpen('briefing')}
              onToggle={() => togglePanel('briefing')}
            />
            {/* Top-center: briefing trigger */}
            <div className="absolute top-[10px] left-1/2 -translate-x-1/2 z-20">
              <FloatingTriggerBtn
                onClick={() => togglePanel('briefing')}
                aria-label={isPanelOpen('briefing') ? "Close briefing" : "Open briefing"}
              >
                <Sparkles className="size-3.5 text-primary" />
                Debrief with Shifra
              </FloatingTriggerBtn>
            </div>
            {/* Top-right: draw toolbar */}
            <div className="absolute top-14 right-3 z-30 flex flex-col items-end gap-1">
              <DrawingToolbar
                mode={ann.mode}
                color={ann.color}
                drawWidth={ann.drawWidth}
                drawArrowStyle={ann.drawArrowStyle}
                open={isPanelOpen('draw')}
                onToggle={() => togglePanel('draw')}
                onStartDrawing={ann.startDrawing}
                onSetColor={ann.setColor}
                onSetWidth={ann.setDrawWidth}
                onSetArrowStyle={ann.setDrawArrowStyle}
                drawGlow={ann.drawGlow}
                drawDash={ann.drawDash}
                drawFloat={ann.drawFloat}
                onSetDrawGlow={ann.setDrawGlow}
                onSetDrawDash={ann.setDrawDash}
                onSetDrawFloat={ann.setDrawFloat}
                onCancel={ann.cancel}
                placementMode={up.placementMode}
                pendingColor={up.pendingColor}
                pathDrawingUnitId={up.pathDrawingUnitId}
                onStartPlacement={handleStartPlacement}
                onCancelPlacement={up.cancelPlacement}
                onSetPendingColor={up.setPendingColor}
                showLabels={showLabels}
              />
            </div>
            {/* Top-left: layers */}
            <div className="absolute top-14 left-3 z-10 flex flex-col items-start gap-1">
              <MapLayerControls
                layers={layers}
                onChange={setLayers}
                open={isPanelOpen('layers')}
                onToggle={() => togglePanel('layers')}
                showLabels={showLabels}
              />
            </div>
            {/* Bottom-right control stack */}
            <div className="absolute bottom-6 right-3 z-10 flex flex-col items-end gap-1">
              <CameraControls mapRef={mapRef} terrainActive={layers.terrain} onResetView={resetView} showLabels={showLabels} />
            </div>
            <MapLegend
              open={isPanelOpen('legend')}
              onToggle={() => togglePanel('legend')}
              layers={layers}
              eventTypes={mockEventTypes}
              showLabels={showLabels}
              placedUnits={up.units}
            />
            {mapEvents.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="glass-panel px-6 py-4 text-center">
                  <p className="text-sm font-medium text-foreground">No events match the current filters.</p>
                  <p className="mt-1 text-xs text-muted-foreground">Adjust the event types or date range to see results.</p>
                </div>
              </div>
            )}
            {timelineDates.length >= 2 && (
              <TimelineScrubber
                dates={timelineDates}
                activeDay={timelineDay}
                onChange={setTimelineDay}
                open={isPanelOpen('timeline')}
                onToggle={() => togglePanel('timeline')}
              />
            )}
          </div>
          <EventFeedPanel
            events={filteredEvents}
            activeDay={timelineDay}
            open={isPanelOpen('feed')}
            onOpenChange={(v) => setPanelOpen('feed', v)}
          />
        </div>
      </div>
      <footer className="hidden md:flex items-center justify-center py-1 border-t border-border/40 bg-background/80">
        <span className="text-[10px] italic text-muted-foreground/50 tracking-wide">
          "Gentlemen, you can't fight in here! This is the war room!"
        </span>
      </footer>
    </div>
  );
}
