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
import { Button } from "@/components/ui/button";
import { CameraControls } from "./CameraControls";
import { DEFAULT_VIEW, HEATMAP_DEFAULTS } from "@/config/map";
import type { HeatmapSettings, MonitorMode } from "@/config/map";
import { MapLegend } from "./UnitLegend";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SettingsMenu } from "./SettingsMenu";
import { useTheme } from "@/hooks/useTheme";
import { useSettings } from "@/hooks/useSettings";
import { usePanelState } from "@/hooks/usePanelState";
import { AnnotationProvider, useAnnotationContext } from "@/context/AnnotationContext";
import { UnitPlacementProvider, useUnitPlacementContext } from "@/context/UnitPlacementContext";
import type { StaticMarkerType } from "@/data/staticMarkers";
import { STATIC_MARKER_META } from "@/data/staticMarkers";
import { useRecentEvents } from "@/hooks/useRecentEvents";
import { useMapMarkers } from "@/hooks/useMapMarkers";
import { useFeedEvents } from "@/hooks/useFeedEvents";
import type { FeedFilters } from "@/hooks/useFeedEvents";
import { useTimelineDates } from "@/hooks/useTimelineDates";
import { useFilterFacets } from "@/hooks/useFilterFacets";
import { useYoutubePlayer } from "@/hooks/useYoutubePlayer";
import { getEventTypeMeta } from "@/config/eventTypes";
import type { FilterOption } from "./FilterSidebar";
import type { MapEvent } from "@/data/index";
import type { EnrichedEvent, MapMarkerEvent } from "@/types/events";
import { useIsMobile } from "@/hooks/useIsMobile";
import { subDays } from "date-fns";

function buildDefaultFilters(typeKeys?: string[]): AtlasFilters {
  return {
    selectedTypes: new Set(typeKeys ?? []),
    selectedInfraTypes: new Set(Object.keys(STATIC_MARKER_META) as StaticMarkerType[]),
    selectedSeverities: new Set<string>(),
    selectedRegions: new Set<string>(),
    selectedWeaponSystems: new Set<string>(),
    selectedSourceTypes: new Set<string>(),
    dateFrom: subDays(new Date(), 7).toISOString(),
    dateTo: new Date().toISOString(),
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

/** Convert MapMarkerEvent[] to MapEvent[] for the map layers */
function markersToMapEvents(markers: MapMarkerEvent[]): MapEvent[] {
  return markers.map((m) => ({
    id: m.id,
    event_type: m.event_type,
    event_icon: m.event_icon,
    event_label: m.event_label,
    event_location: m.event_location,
    event_count: m.event_count,
    date: m.date,
    severity: m.severity,
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
  const { showLabels: _showLabels, toggleLabels } = useSettings();
  const isMobile = useIsMobile();
  const showLabels = isMobile ? false : _showLabels;
  const [filters, setFilters] = useState<AtlasFilters>(() => buildDefaultFilters());

  const ann = useAnnotationContext();
  const up = useUnitPlacementContext();
  const yt = useYoutubePlayer();

  // Fetch live events from Supabase — tiered loading
  const {
    events: allEvents,
    eventTypes: liveEventTypes,
    totalCount,
    isLoading: eventsLoading,
    error: eventsError,
    fetchDateRange,
    fetchDay,
  } = useRecentEvents();

  // Priority 1+2+3: Slim map markers with Realtime + stale eviction
  const {
    markers: mapMarkers,
    isLoading: markersLoading,
    error: markersError,
  } = useMapMarkers();

  const isLoading = eventsLoading || markersLoading;
  const error = eventsError || markersError;

  // Timeline dates from materialized view
  const { dates: timelineDateEntries } = useTimelineDates(
    filters.dateFrom || undefined,
    filters.dateTo || undefined,
  );

  // Filter facets from materialized view
  const { facets } = useFilterFacets(
    filters.dateFrom || undefined,
    filters.dateTo || undefined,
  );

  // Derive filter options from facets (mat view) — fast, no full iteration
  const regionOptions = useMemo<FilterOption[]>(() =>
    Object.entries(facets.by_region).map(([key, count]) => ({
      key, label: toLabel(key), count,
    })).sort((a, b) => a.label.localeCompare(b.label)),
  [facets.by_region]);

  const sourceTypeOptions = useMemo<FilterOption[]>(() =>
    Object.entries(facets.by_source_type).map(([key, count]) => ({
      key, label: toLabel(key), count,
    })).sort((a, b) => a.label.localeCompare(b.label)),
  [facets.by_source_type]);

  // Weapon systems still extracted client-side (not in mat view)
  const weaponSystemOptions = useMemo(() => extractOptions(allEvents, (e) => e.weaponSystem), [allEvents]);

  // Priority 4: Server-side feed pagination
  const feedFilters = useMemo<FeedFilters>(() => ({
    types: filters.selectedTypes.size > 0 ? Array.from(filters.selectedTypes) : undefined,
    severities: filters.selectedSeverities.size > 0 ? Array.from(filters.selectedSeverities) : undefined,
    regions: filters.selectedRegions.size > 0 ? Array.from(filters.selectedRegions) : undefined,
    sourceTypes: filters.selectedSourceTypes.size > 0 ? Array.from(filters.selectedSourceTypes) : undefined,
  }), [filters.selectedTypes, filters.selectedSeverities, filters.selectedRegions, filters.selectedSourceTypes]);

  const {
    events: feedEvents,
    loadMore: feedLoadMore,
    hasMore: feedHasMore,
    isLoading: feedLoading,
    isLoadingMore: feedLoadingMore,
    error: feedError,
  } = useFeedEvents(feedFilters);

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


  // Event type counts — use facets from mat view when no secondary filters active,
  // fall back to client-side iteration when secondary filters narrow the data
  const eventTypeCounts = useMemo(() => {
    const hasSecondaryFilters =
      filters.selectedSeverities.size > 0 ||
      filters.selectedRegions.size > 0 ||
      filters.selectedWeaponSystems.size > 0 ||
      filters.selectedSourceTypes.size > 0;

    if (!hasSecondaryFilters && Object.keys(facets.by_type).length > 0) {
      return new Map(Object.entries(facets.by_type));
    }

    // Fallback: iterate loaded events with secondary filters applied
    const counts = new Map<string, number>();
    for (const e of allEvents) {
      if (filters.selectedSeverities.size > 0 && !filters.selectedSeverities.has(e.severity)) continue;
      if (filters.selectedRegions.size > 0 && !filters.selectedRegions.has(e.location.region ?? "")) continue;
      if (filters.selectedWeaponSystems.size > 0 && !filters.selectedWeaponSystems.has(e.weaponSystem ?? "")) continue;
      if (filters.selectedSourceTypes.size > 0 && !filters.selectedSourceTypes.has(e.sourceType)) continue;
      counts.set(e.eventType, (counts.get(e.eventType) ?? 0) + 1);
    }
    return counts;
  }, [allEvents, facets.by_type, filters.selectedSeverities, filters.selectedRegions, filters.selectedWeaponSystems, filters.selectedSourceTypes]);

  // Client-side filter by all selected filters
  const filteredEvents = useMemo(() => {
    return allEvents.filter((event) => {
      if (filters.selectedTypes.size > 0 && !filters.selectedTypes.has(event.eventType)) return false;
      if (filters.selectedSeverities.size > 0 && !filters.selectedSeverities.has(event.severity)) return false;
      if (filters.selectedRegions.size > 0 && !filters.selectedRegions.has(event.location.region ?? "")) return false;
      if (filters.selectedWeaponSystems.size > 0 && !filters.selectedWeaponSystems.has(event.weaponSystem ?? "")) return false;
      if (filters.selectedSourceTypes.size > 0 && !filters.selectedSourceTypes.has(event.sourceType)) return false;
      return true;
    });
  }, [allEvents, filters.selectedTypes, filters.selectedSeverities, filters.selectedRegions, filters.selectedWeaponSystems, filters.selectedSourceTypes]);

  // Timeline dates from materialized view (or fallback to client-side)
  const timelineDates = useMemo(() => {
    if (timelineDateEntries.length > 0) return timelineDateEntries;
    // Fallback: derive from loaded events
    const counts = new Map<string, number>();
    filteredEvents.forEach((e) => counts.set(e.date, (counts.get(e.date) ?? 0) + 1));
    return Array.from(counts.entries())
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [timelineDateEntries, filteredEvents]);

  const [timelineDay, setTimelineDay] = useState<string | null>(null);
  const { isPanelOpen, togglePanel: _togglePanel, setPanelOpen, closeFloatingPanels } = usePanelState(isMobile ? [] : ["filter", "feed"]);

  // Bottom toolbar panels are mutually exclusive
  const BOTTOM_PANELS: Set<string> = useMemo(() => new Set(["layers", "draw", "legend", "camera"]), []);
  const togglePanel = useCallback((id: Parameters<typeof _togglePanel>[0]) => {
    if (BOTTOM_PANELS.has(id)) {
      BOTTOM_PANELS.forEach(p => { if (p !== id) setPanelOpen(p as typeof id, false); });
    }
    // Opening briefing closes all floating map panels
    if (id === 'briefing' && !isPanelOpen('briefing')) {
      BOTTOM_PANELS.forEach(p => setPanelOpen(p as typeof id, false));
    }
    _togglePanel(id);
  }, [_togglePanel, setPanelOpen, BOTTOM_PANELS, isPanelOpen]);

  // Opening left sidebar collapses left-side floating panels; opening right sidebar collapses right-side ones
  const handleFilterOpenChange = useCallback((v: boolean) => {
    if (v) { setPanelOpen('layers', false); setPanelOpen('legend', false); }
    setPanelOpen('filter', v);
  }, [setPanelOpen]);
  const handleFeedOpenChange = useCallback((v: boolean) => {
    if (v) { setPanelOpen('draw', false); setPanelOpen('camera', false); }
    setPanelOpen('feed', v);
  }, [setPanelOpen]);

  // Hide labels on left-side buttons when filter sidebar is expanded, right-side when feed is expanded
  const leftLabels = showLabels && !isPanelOpen('filter');
  const rightLabels = showLabels && !isPanelOpen('feed');
  const [heatmapSettings, setHeatmapSettings] = useState<HeatmapSettings>({ ...HEATMAP_DEFAULTS });
  const [monitorMode, setMonitorMode] = useState<MonitorMode>("auto");
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
    heatmap: true,
    geoLabels: false,
    subgovernorates: false,
  });

  // Compute effective layer visibility based on monitor mode
  const effectiveLayers = useMemo(() => {
    switch (monitorMode) {
      case "auto":
        return { ...layers, markers: true, heatmap: true };
      case "heatmap":
        return { ...layers, markers: false, heatmap: true };
      case "markers":
        return { ...layers, markers: true, heatmap: false };
    }
  }, [layers, monitorMode]);

  const mapRef = useRef<MapRef | null>(null);

  const handleClearFilters = useCallback(
    () => setFilters(buildDefaultFilters(liveEventTypes.map((t) => t.key))),
    [liveEventTypes],
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

  const handleFlyToEvent = useCallback((lat: number, lng: number) => {
    mapRef.current?.getMap().flyTo({
      center: [lng, lat],
      zoom: 11,
      duration: 4000,
      easing: (t: number) => t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2,
    });
  }, []);

  // When date range changes, fetch that range and reset timeline
  useEffect(() => {
    setTimelineDay(null);
    if (filters.dateFrom && filters.dateTo) {
      fetchDateRange(filters.dateFrom.slice(0, 10), filters.dateTo.slice(0, 10));
    }
  }, [filters.dateFrom, filters.dateTo, fetchDateRange]);

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

  // Map uses slim markers (Priority 1), filtered by current type/severity selection
  const filteredMarkers = useMemo(() => {
    return mapMarkers.filter((m) => {
      if (filters.selectedTypes.size > 0 && !filters.selectedTypes.has(m.event_type)) return false;
      if (filters.selectedSeverities.size > 0 && !filters.selectedSeverities.has(m.severity)) return false;
      if (filters.selectedRegions.size > 0 && !filters.selectedRegions.has(m.locationRegion ?? "")) return false;
      if (filters.selectedSourceTypes.size > 0 && !filters.selectedSourceTypes.has(m.sourceType)) return false;
      return true;
    });
  }, [mapMarkers, filters.selectedTypes, filters.selectedSeverities, filters.selectedRegions, filters.selectedSourceTypes]);

  const displayMarkers = useMemo(() => {
    if (!timelineDay) return filteredMarkers;
    return filteredMarkers.filter((m) => m.date === timelineDay);
  }, [filteredMarkers, timelineDay]);

  const mapEvents = useMemo(() => markersToMapEvents(displayMarkers), [displayMarkers]);

  return (
    <div className="flex flex-col h-full w-full min-h-0 min-w-0">
      {/* Mobile header */}
      {isMobile ? (
        <div className="relative z-[70] flex h-12 shrink-0 items-center border-b border-border px-3 gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => togglePanel('filter')}
            aria-label="Open filters"
            className="glass-panel size-9"
          >
            <SlidersHorizontal className="size-4" />
          </Button>
          <div className="flex-1 flex flex-col items-center justify-center">
            <span
              className="font-black text-title uppercase tracking-widest leading-none font-['Inter_Tight'] text-[0.85rem] tracking-[0.15em]"
            >
              The War Room
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => togglePanel('feed')}
              aria-label="Open live feeds"
              className="glass-panel size-9"
            >
              <List className="size-4" />
            </Button>
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
              className="text-title uppercase leading-none underline decoration-2 underline-offset-[3px] font-['Bebas_Neue'] text-[2rem] tracking-[-0.01em]"
            >
              The War Room
            </h1>
            <p
              className="uppercase text-muted-foreground leading-none font-['Inter_Tight'] font-bold text-[0.6rem] tracking-[0.08em]"
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
          totalCount={facets.total > 0 ? facets.total : totalCount}
          onFiltersChange={setFilters}
          onClear={handleClearFilters}
          open={isPanelOpen('filter')}
          onOpenChange={handleFilterOpenChange}
          isLoading={isLoading}
          regionOptions={regionOptions}
          weaponSystemOptions={weaponSystemOptions}
          sourceTypeOptions={sourceTypeOptions}
          eventTypeCounts={eventTypeCounts}
        />
        <div className="flex flex-1 min-h-0 min-w-0">
          <div className="relative flex-1 min-h-0 min-w-0" onMouseDown={closeFloatingPanels}>
            <ErrorBoundary>
            <AtlasMap
              events={mapEvents}
              layers={effectiveLayers}
              monitorMode={monitorMode}
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
              rotatingUnitId={up.rotatingUnitId}
              onStartRotation={up.startRotation}
              onRotateUnitToward={up.rotateUnitToward}
              onStopRotation={up.stopRotation}
              heatmapSettings={heatmapSettings}
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
            {/* Right-middle: Annotate */}
            <div className="absolute top-1/2 -translate-y-1/2 right-3 z-50">
              <DrawingToolbar
                open={isPanelOpen('draw')}
                onToggle={() => togglePanel('draw')}
                showLabels={rightLabels}
              />
            </div>
            {/* Left-middle: Layers (mirrors DrawingToolbar on right) */}
            <div className="absolute top-1/2 -translate-y-1/2 left-3 z-50">
              <MapLayerControls
                layers={layers}
                onChange={setLayers}
                open={isPanelOpen('layers')}
                onToggle={() => togglePanel('layers')}
                showLabels={leftLabels}
                bigger
                heatmapSettings={heatmapSettings}
                onHeatmapSettingsChange={setHeatmapSettings}
                monitorMode={monitorMode}
                onMonitorModeChange={setMonitorMode}
              />
            </div>
            {/* Bottom-left: Legend */}
            <div className="absolute bottom-4 left-3 z-50">
              <MapLegend
                open={isPanelOpen('legend')}
                onToggle={() => togglePanel('legend')}
                layers={layers}
                eventTypes={liveEventTypes}
                showLabels={leftLabels}
                placedUnits={up.units}
              />
            </div>
            {/* Bottom-right: Camera */}
            <div className="absolute bottom-4 right-3 z-30">
              <CameraControls mapRef={mapRef} terrainActive={layers.terrain} onResetView={resetView} showLabels={rightLabels} open={isPanelOpen('camera')} onToggle={() => togglePanel('camera')} />
            </div>
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
            events={feedEvents}
            activeDay={timelineDay}
            open={isPanelOpen('feed')}
            onOpenChange={handleFeedOpenChange}
            isLoading={feedLoading}
            isLoadingMore={feedLoadingMore}
            error={feedError}
            hasMore={feedHasMore}
            onLoadMore={feedLoadMore}
            yt={yt}
            youtubePopped={isPanelOpen('youtube')}
            onPopOutYouTube={handlePopOutYouTube}
            onDockYouTube={handleDockYouTube}
            onFlyToEvent={handleFlyToEvent}
          />
        </div>
      </div>
      <footer className="hidden md:flex items-center justify-center py-1 border-t border-border/40 bg-background/80">
        <span className="text-2xs italic text-muted-foreground/50 tracking-wide">
          "Gentlemen, you can't fight in here! This is the war room!"
        </span>
      </footer>
    </div>
  );
}
