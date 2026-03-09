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
import { YouTubeFloatingPanel } from "./YouTubeFloatingPanel";
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
import type { StaticMarkerType } from "@/data/staticMarkers";
import { STATIC_MARKER_META } from "@/data/staticMarkers";
import { useEvents } from "@/hooks/useEvents";
import { useYoutubePlayer } from "@/hooks/useYoutubePlayer";
import { getEventTypeMeta } from "@/config/eventTypes";
import type { FilterOption } from "./FilterSidebar";
import type { MapEvent } from "@/data/index";
import type { EnrichedEvent } from "@/types/events";
import { useIsMobile } from "@/hooks/useIsMobile";

/** Attacker key for events with no attacker (political, humanitarian, etc.) */
const UNATTRIBUTED_KEY = "__unattributed__";

/** Attackers excluded from the default selection (not the editorial focus) */
const EXCLUDED_ATTACKERS = new Set(["hezbollah", "hamas", "islamic jihad", "pij", "pflp", "resistance"]);

function buildDefaultFilters(typeKeys?: string[], attackerKeys?: string[]): AtlasFilters {
  return {
    selectedTypes: new Set(typeKeys ?? []),
    selectedInfraTypes: new Set(Object.keys(STATIC_MARKER_META) as StaticMarkerType[]),
    selectedSeverities: new Set<string>(),
    selectedRegions: new Set<string>(),
    selectedAttackers: new Set(attackerKeys ?? []),
    selectedWeaponSystems: new Set<string>(),
    selectedSourceTypes: new Set<string>(),
    dateFrom: "",
    dateTo: "",
  };
}

/** Snake_case to Sentence case */
function toLabel(s: string): string {
  const words = s.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Extract unique non-null values from events as FilterOption[] */
function extractOptions(events: EnrichedEvent[], getter: (e: EnrichedEvent) => string | null | undefined): FilterOption[] {
  const seen = new Set<string>();
  for (const e of events) {
    const v = getter(e);
    if (v) seen.add(v);
  }
  return Array.from(seen).sort().map((v) => ({ key: v, label: toLabel(v) }));
}

/** Convert EnrichedEvent[] to MapEvent[] (only events with coordinates) */
function toMapEvents(events: EnrichedEvent[]): MapEvent[] {
  return events
    .filter((e) => e.location.lat != null && e.location.lng != null)
    .map((e) => ({
      id: e.id,
      event_type: e.eventType,
      event_icon: getEventTypeMeta(e.eventType).icon,
      event_label: getEventTypeMeta(e.eventType).label,
      event_location: { name: e.location.name, lat: e.location.lat!, lng: e.location.lng! },
      event_count: 1,
      date: e.date,
      summary: e.summary,
      severity: e.severity,
      sourceChannel: e.sourceChannel ?? undefined,
      verificationStatus: e.verificationStatus,
    }));
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
  const [filters, setFilters] = useState<AtlasFilters>(() => buildDefaultFilters());

  const ann = useAnnotationContext();
  const up = useUnitPlacementContext();
  const yt = useYoutubePlayer();

  // Fetch live events from Supabase (paginated)
  const {
    events: allEvents,
    eventTypes: liveEventTypes,
    totalCount,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    canAutoLoad,
    loadMore,
  } = useEvents(filters.dateFrom || undefined, filters.dateTo || undefined);

  // Extract dynamic filter options from all loaded events
  const regionOptions = useMemo(() => extractOptions(allEvents, (e) => e.location.region), [allEvents]);
  const attackerOptions = useMemo(() => {
    const opts = extractOptions(allEvents, (e) => e.attacker);
    // Add "Unattributed" for events with no attacker (political, humanitarian, etc.)
    const hasUnattributed = allEvents.some((e) => !e.attacker);
    if (hasUnattributed) {
      opts.unshift({ key: UNATTRIBUTED_KEY, label: "Unattributed (political, etc.)", icon: "🏛️" });
    }
    return opts;
  }, [allEvents]);
  const weaponSystemOptions = useMemo(() => extractOptions(allEvents, (e) => e.weaponSystem), [allEvents]);
  const sourceTypeOptions = useMemo(() => extractOptions(allEvents, (e) => e.sourceType), [allEvents]);

  // Initialize selected types + attacker defaults when live data arrives
  const typesInitialized = useRef(false);
  useEffect(() => {
    if (liveEventTypes.length > 0 && !typesInitialized.current) {
      typesInitialized.current = true;
      setFilters((prev) => ({
        ...prev,
        selectedTypes: new Set(liveEventTypes.map((t) => t.key)),
      }));
    }
  }, [liveEventTypes]);

  // Initialize attacker filter defaults once we have events
  const attackersInitialized = useRef(false);
  useEffect(() => {
    if (attackerOptions.length > 0 && !attackersInitialized.current) {
      attackersInitialized.current = true;
      const defaultAttackers = new Set(
        attackerOptions
          .filter((o) => !EXCLUDED_ATTACKERS.has(o.key.toLowerCase()))
          .map((o) => o.key),
      );
      setFilters((prev) => ({ ...prev, selectedAttackers: defaultAttackers }));
    }
  }, [attackerOptions]);

  // Count events per event type — applies all filters EXCEPT event type so
  // each type shows how many events would appear if toggled on
  const eventTypeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of allEvents) {
      if (filters.selectedSeverities.size > 0 && !filters.selectedSeverities.has(e.severity)) continue;
      if (filters.selectedRegions.size > 0 && !filters.selectedRegions.has(e.location.region ?? "")) continue;
      if (filters.selectedAttackers.size > 0 && !filters.selectedAttackers.has(e.attacker ?? UNATTRIBUTED_KEY)) continue;
      if (filters.selectedWeaponSystems.size > 0 && !filters.selectedWeaponSystems.has(e.weaponSystem ?? "")) continue;
      if (filters.selectedSourceTypes.size > 0 && !filters.selectedSourceTypes.has(e.sourceType)) continue;
      counts.set(e.eventType, (counts.get(e.eventType) ?? 0) + 1);
    }
    return counts;
  }, [allEvents, filters.selectedSeverities, filters.selectedRegions, filters.selectedAttackers, filters.selectedWeaponSystems, filters.selectedSourceTypes]);

  // Client-side filter by all selected filters
  const filteredEvents = useMemo(() => {
    return allEvents.filter((event) => {
      if (filters.selectedTypes.size > 0 && !filters.selectedTypes.has(event.eventType)) return false;
      if (filters.selectedSeverities.size > 0 && !filters.selectedSeverities.has(event.severity)) return false;
      if (filters.selectedRegions.size > 0 && !filters.selectedRegions.has(event.location.region ?? "")) return false;
      if (filters.selectedAttackers.size > 0 && !filters.selectedAttackers.has(event.attacker ?? UNATTRIBUTED_KEY)) return false;
      if (filters.selectedWeaponSystems.size > 0 && !filters.selectedWeaponSystems.has(event.weaponSystem ?? "")) return false;
      if (filters.selectedSourceTypes.size > 0 && !filters.selectedSourceTypes.has(event.sourceType)) return false;
      return true;
    });
  }, [allEvents, filters.selectedTypes, filters.selectedSeverities, filters.selectedRegions, filters.selectedAttackers, filters.selectedWeaponSystems, filters.selectedSourceTypes]);

  const timelineDates = useMemo(() => {
    const seen = new Set<string>();
    filteredEvents.forEach((e) => seen.add(e.date));
    return Array.from(seen).sort();
  }, [filteredEvents]);

  const [timelineDay, setTimelineDay] = useState<string | null>(null);
  const { isPanelOpen, togglePanel: _togglePanel, setPanelOpen } = usePanelState(["filter", "feed"]);

  // Bottom toolbar panels are mutually exclusive
  const BOTTOM_PANELS: Set<string> = useMemo(() => new Set(["layers", "draw", "legend", "camera"]), []);
  const togglePanel = useCallback((id: Parameters<typeof _togglePanel>[0]) => {
    if (BOTTOM_PANELS.has(id)) {
      BOTTOM_PANELS.forEach(p => { if (p !== id) setPanelOpen(p as typeof id, false); });
    }
    _togglePanel(id);
  }, [_togglePanel, setPanelOpen, BOTTOM_PANELS]);
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
    heatmap: false,
    geoLabels: false,
  });

  const mapRef = useRef<MapRef | null>(null);

  const handleClearFilters = useCallback(
    () => {
      const defaultAttackerKeys = attackerOptions
        .filter((o) => !EXCLUDED_ATTACKERS.has(o.key.toLowerCase()))
        .map((o) => o.key);
      setFilters(buildDefaultFilters(liveEventTypes.map((t) => t.key), defaultAttackerKeys));
    },
    [liveEventTypes, attackerOptions],
  );

  const { setSelectedAnnotationId: _setSelAnnId } = ann;
  const handleSelectAnnotation = useCallback((id: string) => {
    _setSelAnnId(id);
    setPanelOpen('draw', true);
  }, [_setSelAnnId, setPanelOpen]);

  const handlePopOutYouTube = useCallback(() => {
    setPanelOpen('youtube', true);
  }, [setPanelOpen]);

  const handleDockYouTube = useCallback(() => {
    setPanelOpen('youtube', false);
  }, [setPanelOpen]);

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

  const displayEvents = useMemo(() => {
    if (!timelineDay) return filteredEvents;
    return filteredEvents.filter((e) => e.date === timelineDay);
  }, [filteredEvents, timelineDay]);

  const mapEvents = useMemo(() => toMapEvents(displayEvents), [displayEvents]);

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
          className="relative z-[70] flex h-20 shrink-0 items-center border-b border-border/50 transition-all duration-200"
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
              Israeli Operations in Lebanon — Live Monitor
            </p>
          </div>
          <div
            className="absolute flex items-center justify-center"
            style={{
              right: 12,
              top: 0,
              bottom: 0,
            }}
          >
            <SettingsMenu dark={dark} onToggleTheme={toggleTheme} showLabels={showLabels} onToggleLabels={toggleLabels} />
          </div>
        </div>
      )}
      <div className="flex flex-1 min-h-0 min-w-0">
        <FilterSidebar
          eventTypes={liveEventTypes}
          filters={filters}
          filteredCount={filteredEvents.length}
          totalCount={totalCount}
          onFiltersChange={setFilters}
          onClear={handleClearFilters}
          open={isPanelOpen('filter')}
          onOpenChange={(v) => setPanelOpen('filter', v)}
          isLoading={isLoading}
          regionOptions={regionOptions}
          attackerOptions={attackerOptions}
          weaponSystemOptions={weaponSystemOptions}
          sourceTypeOptions={sourceTypeOptions}
          eventTypeCounts={eventTypeCounts}
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
            <YouTubeFloatingPanel
              open={isPanelOpen('youtube')}
              onClose={() => setPanelOpen('youtube', false)}
              yt={yt}
            />
            {/* Top-center: Shifra copilot (large) */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
              <FloatingTriggerBtn
                onClick={() => togglePanel('briefing')}
                aria-label={isPanelOpen('briefing') ? "Close briefing" : "Open briefing"}
                className="px-5 py-2.5 text-sm"
              >
                <Sparkles className="size-5 text-primary" />
                <span className="text-[13px] font-semibold">Debrief with Shifra</span>
              </FloatingTriggerBtn>
            </div>
            {/* Bottom-center: layers + annotate + camera */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-end gap-2">
              <MapLayerControls
                layers={layers}
                onChange={setLayers}
                open={isPanelOpen('layers')}
                onToggle={() => togglePanel('layers')}
                showLabels={showLabels}
              />
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
              <CameraControls mapRef={mapRef} terrainActive={layers.terrain} onResetView={resetView} showLabels={showLabels} open={isPanelOpen('camera')} onToggle={() => togglePanel('camera')} />
            </div>
            <MapLegend
              open={isPanelOpen('legend')}
              onToggle={() => togglePanel('legend')}
              layers={layers}
              eventTypes={liveEventTypes}
              showLabels={showLabels}
              placedUnits={up.units}
            />
            {!isLoading && mapEvents.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="glass-panel px-6 py-4 text-center">
                  <p className="text-sm font-medium text-foreground">
                    {error ? "Failed to load events" : "No events match the current filters."}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {error ?? "Adjust the event types or date range to see results."}
                  </p>
                </div>
              </div>
            )}
            {/* Timeline scrubber removed for now */}
          </div>
          <EventFeedPanel
            events={displayEvents}
            activeDay={timelineDay}
            open={isPanelOpen('feed')}
            onOpenChange={(v) => setPanelOpen('feed', v)}
            isLoading={isLoading}
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
            canAutoLoad={canAutoLoad}
            onLoadMore={loadMore}
            error={error}
            yt={yt}
            youtubePopped={isPanelOpen('youtube')}
            onPopOutYouTube={handlePopOutYouTube}
            onDockYouTube={handleDockYouTube}
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
