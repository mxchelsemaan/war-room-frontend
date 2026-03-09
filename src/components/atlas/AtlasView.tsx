import { useEffect, useMemo, useRef, useState } from "react";
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
import { DEFAULT_VIEW } from "./AtlasMap";
import { MapLegend } from "./UnitLegend";
import { SettingsMenu } from "./SettingsMenu";
import { useTheme } from "@/hooks/useTheme";
import { useSettings } from "@/hooks/useSettings";
import { useDrawing } from "@/hooks/useDrawing";
import type { Annotation } from "@/hooks/useDrawing";
import { useUnitPlacement } from "@/hooks/useUnitPlacement";
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
  const { dark, toggle: toggleTheme } = useTheme();
  const { showLabels, toggleLabels } = useSettings();
  const isMobile = useIsMobile();
  const [filters, setFilters] = useState<AtlasFilters>(buildDefaultFilters);

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
  const [filterOpen, setFilterOpen] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);
  const [layersOpen,   setLayersOpen]   = useState(false);
  const [legendOpen,   setLegendOpen]   = useState(false);
  const [drawOpen,     setDrawOpen]     = useState(false);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [layers, setLayers] = useState<LayerVisibility>({
    terrain: false,
    hillshade: true,
    markers: true,
    heatmap: false,
    rivers: true,
    frontLines: false,
    territory: false,
    infrastructure: true,
    governorates: true,
    units: true,
    flights: true,
    ships: true,
    geoLabels: false,
  });

  const mapRef = useRef<MapRef | null>(null);

  function resetView() {
    mapRef.current?.getMap().flyTo({
      center: [DEFAULT_VIEW.longitude, DEFAULT_VIEW.latitude],
      zoom: DEFAULT_VIEW.zoom,
      pitch: layers.terrain ? 65 : DEFAULT_VIEW.pitch,
      bearing: DEFAULT_VIEW.bearing,
      duration: 900,
    });
  }

  const drawing = useDrawing();
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const unitPlacement = useUnitPlacement();

  function handleStartPlacement(type: NATOUnitType) {
    drawing.cancel();
    unitPlacement.startPlacement(type);
  }

  function handleStartPathDrawing(unitId: string) {
    drawing.cancel();
    unitPlacement.startPathDrawing(unitId);
  }

  // Consume completed annotation from drawing hook — inherit current float default
  useEffect(() => {
    if (!drawing.completed) return;
    setAnnotations(prev => [...prev, { ...drawing.completed!, float: false }]);
    drawing.clearCompleted();
  }, [drawing.completed]); // eslint-disable-line react-hooks/exhaustive-deps

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
            onClick={() => setFilterOpen(v => !v)}
            aria-label="Open filters"
            className="glass-panel p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <SlidersHorizontal className="size-4" />
          </button>
          <span
            className="flex-1 text-center font-black text-[#c62828] uppercase tracking-tight"
            style={{ fontFamily: "'Inter Tight', system-ui, sans-serif", fontSize: '1rem' }}
          >
            War Room
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFeedOpen(v => !v)}
              aria-label="Open live feeds"
              className="glass-panel p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <List className="size-4" />
            </button>
            <SettingsMenu dark={dark} onToggleTheme={toggleTheme} showLabels={showLabels} onToggleLabels={toggleLabels} />
          </div>
        </div>
      ) : (
        /* Desktop header */
        <div
          className="relative z-[70] flex h-28 shrink-0 items-center border-b border-border transition-all duration-200"
          style={{
            paddingLeft: filterOpen ? 288 : 56,
            paddingRight: feedOpen ? 288 : 56,
          }}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ paddingTop: '22px', paddingBottom: '10px' }}>
            <h1
              style={{
                fontFamily: "'Inter Tight', system-ui, sans-serif",
                fontWeight: 900,
                fontSize: '2rem',
                color: '#c62828',
                letterSpacing: '-0.02em',
                textTransform: 'uppercase',
                fontVariantCaps: 'all-small-caps',
                lineHeight: 0.8,
                transform: 'scale(0.8, 2.6)',
                transformOrigin: 'center center',
                marginBottom: '8px',
              }}
            >
              The ◆ War ◆ Room
            </h1>
            <div style={{ width: '60%', height: '3px', background: '#c62828', marginBottom: '8px' }} />
            <span
              style={{
                fontFamily: "'Inter Tight', system-ui, sans-serif",
                fontWeight: 700,
                fontSize: '1.1rem',
                color: 'var(--muted-foreground)',
                letterSpacing: '-0.02em',
                textTransform: 'uppercase',
                lineHeight: 1,
                transform: 'scale(0.8, 2.0)',
                transformOrigin: 'center center',
                display: 'block',
              }}
            >
              2026 Israeli Campaign in Lebanon Monitor
            </span>
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
          onClear={() => setFilters(buildDefaultFilters())}
          open={filterOpen}
          onOpenChange={setFilterOpen}
        />
        <div className="flex flex-1 min-h-0 min-w-0">
          <div className="relative flex-1 min-h-0 min-w-0">
            <AtlasMap
              events={mapEvents}
              layers={layers}
              dark={dark}
              selectedInfraTypes={filters.selectedInfraTypes}
              annotations={annotations}
              drawingMode={drawing.mode}
              drawingColor={drawing.color}
              tempDrawingCoords={drawing.tempCoords}
              onMapClick={drawing.handleClick}
              onMapDblClick={drawing.handleDblClick}
              onDeleteAnnotation={(id) => setAnnotations(prev => prev.filter(a => a.id !== id))}
              externalMapRef={mapRef}
              previewWidth={drawing.drawWidth}
              previewArrowStyle={drawing.drawArrowStyle}
              placedUnits={unitPlacement.units}
              unitPaths={unitPlacement.paths}
              placementMode={unitPlacement.placementMode}
              pathDrawingUnitId={unitPlacement.pathDrawingUnitId}
              onPlaceUnit={unitPlacement.placeUnit}
              onAddPathWaypoint={unitPlacement.addWaypoint}
              onFinishPath={unitPlacement.finishPathDrawing}
            />
            <AISummaryCard
              open={briefingOpen}
              onToggle={() => setBriefingOpen(v => !v)}
            />
            {/* Top-center: briefing trigger */}
            <div className="absolute top-[10px] left-1/2 -translate-x-1/2 z-20">
              <FloatingTriggerBtn
                onClick={() => setBriefingOpen(v => !v)}
                aria-label={briefingOpen ? "Close briefing" : "Open briefing"}
              >
                <Sparkles className="size-3.5 text-primary" />
                Debrief with Shifra
              </FloatingTriggerBtn>
            </div>
            {/* Top-right: draw toolbar + unit palette */}
            <div className="absolute top-[10px] right-3 z-30 flex flex-col items-end gap-1">
              <DrawingToolbar
                mode={drawing.mode}
                color={drawing.color}
                drawWidth={drawing.drawWidth}
                drawArrowStyle={drawing.drawArrowStyle}
                annotations={annotations}
                open={drawOpen}
                onToggle={() => setDrawOpen(v => !v)}
                onStartDrawing={drawing.startDrawing}
                onSetColor={drawing.setColor}
                onSetWidth={drawing.setDrawWidth}
                onSetArrowStyle={drawing.setDrawArrowStyle}
                onCancel={drawing.cancel}
                onDeleteAnnotation={(id) => setAnnotations(prev => prev.filter(a => a.id !== id))}
                onRenameAnnotation={(id, label) =>
                  setAnnotations(prev => prev.map(a => a.id === id ? { ...a, label } : a))
                }
                onToggleGlow={(id) =>
                  setAnnotations(prev => prev.map(a => a.id === id ? { ...a, glow: !a.glow } : a))
                }
                onToggleDash={(id) =>
                  setAnnotations(prev => prev.map(a => a.id === id ? { ...a, dash: !a.dash } : a))
                }
                onToggleLabel={(id) =>
                  setAnnotations(prev => prev.map(a => a.id === id ? { ...a, showLabel: !a.showLabel } : a))
                }
                onToggleAnnotationFloat={(id) =>
                  setAnnotations(prev => prev.map(a => a.id === id ? { ...a, float: !a.float } : a))
                }
                onSetAnnotationColor={(id, color) =>
                  setAnnotations(prev => prev.map(a => a.id === id ? { ...a, color } : a))
                }
                onSetAnnotationWidth={(id, width) =>
                  setAnnotations(prev => prev.map(a => a.id === id ? { ...a, width } : a))
                }
                units={unitPlacement.units}
                paths={unitPlacement.paths}
                placementMode={unitPlacement.placementMode}
                pendingColor={unitPlacement.pendingColor}
                pathDrawingUnitId={unitPlacement.pathDrawingUnitId}
                onStartPlacement={handleStartPlacement}
                onCancelPlacement={unitPlacement.cancelPlacement}
                onSetPendingColor={unitPlacement.setPendingColor}
                onUpdateUnit={unitPlacement.updateUnit}
                onDeleteUnit={unitPlacement.deleteUnit}
                onStartPathDrawing={handleStartPathDrawing}
                onFinishPathDrawing={unitPlacement.finishPathDrawing}
                onCancelPathDrawing={unitPlacement.cancelPathDrawing}
                onDeletePath={unitPlacement.deletePath}
                direction="down"
                showLabels={showLabels}
              />
            </div>
            <MapLayerControls
              layers={layers}
              onChange={setLayers}
              open={layersOpen}
              onToggle={() => setLayersOpen(v => !v)}
              showLabels={showLabels}
            />
            {/* Bottom-right control stack */}
            <div className="absolute bottom-6 right-3 z-10 flex flex-col items-end gap-1">
              <CameraControls mapRef={mapRef} terrainActive={layers.terrain} onResetView={resetView} showLabels={showLabels} />
            </div>
            <MapLegend
              open={legendOpen}
              onToggle={() => setLegendOpen(v => !v)}
              layers={layers}
              eventTypes={mockEventTypes}
              showLabels={showLabels}
              placedUnits={unitPlacement.units}
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
                open={timelineOpen}
                onToggle={() => setTimelineOpen(v => !v)}
              />
            )}
          </div>
          <EventFeedPanel
            events={filteredEvents}
            activeDay={timelineDay}
            open={feedOpen}
            onOpenChange={setFeedOpen}
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
