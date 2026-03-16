import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import { FilterSidebar } from "./FilterSidebar";
import type { AtlasFilters } from "./FilterSidebar";
import { EventFeedPanel } from "./EventFeedPanel";
import { AISummaryCard } from "./AISummaryCard";
import { AtlasMap } from "./AtlasMap";
import { MapLayerControls } from "./MapLayerControls";
import type { LayerVisibility } from "./MapLayerControls";
import { DrawingToolbar } from "./DrawingToolbar";
import { FloatingTriggerBtn } from "./FloatingPanel";
import { YouTubeFloatingPanel } from "./YouTubeFloatingPanel";
import { Sparkles, SlidersHorizontal, List } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CameraControls } from "./CameraControls";
import { DEFAULT_VIEW } from "@/config/map";
import type { MonitorMode } from "@/config/map";
import { MapLegend } from "./UnitLegend";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SettingsMenu } from "./SettingsMenu";
import { useTheme } from "@/hooks/useTheme";
import { useSettings } from "@/hooks/useSettings";
import { usePanelState } from "@/hooks/usePanelState";
import { AnnotationProvider, useAnnotationContext } from "@/context/AnnotationContext";
import { UnitPlacementProvider, useUnitPlacementContext } from "@/context/UnitPlacementContext";
import { useInfraMarkers } from "@/hooks/useInfraMarkers";
import { useRecentEvents } from "@/hooks/useRecentEvents";
import { useMapMarkers } from "@/hooks/useMapMarkers";
import { useFeedEvents } from "@/hooks/useFeedEvents";
import type { FeedFilters } from "@/hooks/useFeedEvents";
import { useTimelineDates } from "@/hooks/useTimelineDates";
import { useFilterFacets } from "@/hooks/useFilterFacets";
import { useYoutubePlayer } from "@/hooks/useYoutubePlayer";
import { useFilterOptions, matchesSearch } from "@/hooks/useFilterOptions";
import type { MapEvent } from "@/data/index";
import type { MapMarkerEvent } from "@/types/events";
import { useIsMobile } from "@/hooks/useIsMobile";
import { subDays } from "date-fns";
import { theaterCountries } from "@/config/theaters";
import { posthog } from "@/lib/posthog";

function buildDefaultFilters(typeKeys?: string[], infraTypeKeys?: string[]): AtlasFilters {
  return {
    selectedTypes: new Set(typeKeys ?? []),
    selectedInfraTypes: new Set(infraTypeKeys ?? []),
    selectedSeverities: new Set<string>(),
    selectedRegions: new Set<string>(),
    selectedWeaponSystems: new Set<string>(),
    selectedSourceTypes: new Set<string>(),
    selectedHandles: new Set<string>(),
    selectedTheaters: new Set<string>(),
    selectedCountries: new Set<string>(),
    selectedAttackers: new Set<string>(),
    selectedTargets: new Set<string>(),
    selectedAffectedParties: new Set<string>(),
    selectedTopics: new Set<string>(),
    dateFrom: subDays(new Date(), 2).toISOString(),
    dateTo: new Date().toISOString(),
    searchQuery: "",
  };
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

  // Track page view on mount
  useEffect(() => {
    posthog.capture("page_viewed");
  }, []);

  // Fetch infrastructure pins from Supabase
  const {
    markers: infraMarkers,
    markerTypes: infraTypes,
    markerColors: infraColors,
  } = useInfraMarkers();

  // Fetch live events from Supabase — tiered loading
  const {
    events: allEvents,
    eventTypes: liveEventTypes,
    totalCount,
    isLoading: eventsLoading,
    error: eventsError,
    fetchDateRange,
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
  const { dates: _timelineDateEntries } = useTimelineDates(
    filters.dateFrom || undefined,
    filters.dateTo || undefined,
  );

  // Filter facets from materialized view
  const { facets } = useFilterFacets(
    filters.dateFrom || undefined,
    filters.dateTo || undefined,
  );

  // Filter options with cross-faceted counts
  const { severityOptions, regionOptions, sourceTypeOptions, weaponSystemOptions, handleOptions, theaterOptions, countryOptions, attackerOptions, targetOptions, affectedPartyOptions, topicOptions, eventTypeCounts } = useFilterOptions(allEvents, filters);

  const [timelineDay, setTimelineDay] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Priority 4: Server-side feed pagination
  const feedFilters = useMemo<FeedFilters>(() => ({
    types: filters.selectedTypes.size > 0 ? Array.from(filters.selectedTypes) : undefined,
    severities: filters.selectedSeverities.size > 0 ? Array.from(filters.selectedSeverities) : undefined,
    regions: filters.selectedRegions.size > 0 ? Array.from(filters.selectedRegions) : undefined,
    sourceTypes: filters.selectedSourceTypes.size > 0 ? Array.from(filters.selectedSourceTypes) : undefined,
    handles: filters.selectedHandles.size > 0 ? Array.from(filters.selectedHandles) : undefined,
    dateFrom: timelineDay ?? filters.dateFrom?.slice(0, 10),
    dateTo: timelineDay ?? filters.dateTo?.slice(0, 10),
    weaponSystems: filters.selectedWeaponSystems.size > 0 ? [...filters.selectedWeaponSystems] : undefined,
    countries: (() => {
      const tc = filters.selectedTheaters.size > 0 ? theaterCountries(filters.selectedTheaters) : null;
      const cc = filters.selectedCountries.size > 0 ? filters.selectedCountries : null;
      if (!tc && !cc) return undefined;
      if (tc && cc) {
        // Intersect: only countries in both theater expansion AND explicit selection
        const result = [...cc].filter((c) => tc.has(c));
        return result.length > 0 ? result : ["__none__"]; // no overlap → match nothing
      }
      return [...(tc ?? cc!)];
    })(),
    attackers: filters.selectedAttackers.size > 0 ? [...filters.selectedAttackers] : undefined,
    targets: filters.selectedTargets.size > 0 ? [...filters.selectedTargets] : undefined,
    affectedParties: filters.selectedAffectedParties.size > 0 ? [...filters.selectedAffectedParties] : undefined,
    topics: filters.selectedTopics.size > 0 ? [...filters.selectedTopics] : undefined,
    query: filters.searchQuery || undefined,
  }), [filters.selectedTypes, filters.selectedSeverities, filters.selectedRegions, filters.selectedSourceTypes, filters.selectedHandles, filters.dateFrom, filters.dateTo, filters.selectedWeaponSystems, filters.selectedTheaters, filters.selectedCountries, filters.selectedAttackers, filters.selectedTargets, filters.selectedAffectedParties, filters.selectedTopics, filters.searchQuery, timelineDay]);

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

  // Initialize infra type selection when markers arrive
  const infraInitialized = useRef(false);
  useEffect(() => {
    if (infraMarkers.length > 0 && !infraInitialized.current) {
      infraInitialized.current = true;
      setFilters((prev) => ({
        ...prev,
        selectedInfraTypes: new Set(Object.keys(infraTypes)),
      }));
    }
  }, [infraMarkers, infraTypes]);


  // Client-side filter by all selected filters
  const filteredEvents = useMemo(() => {
    return allEvents.filter((event) => {
      if (filters.searchQuery && !matchesSearch(filters.searchQuery, event.summary, event.location.name, event.attacker, event.target, event.affectedParty, event.weaponSystem, event.sourceChannel, event.topics.join(' '), event.sourceClaim)) return false;
      if (filters.selectedTypes.size > 0 && !filters.selectedTypes.has(event.eventType)) return false;
      if (filters.selectedSeverities.size > 0 && !filters.selectedSeverities.has(event.severity)) return false;
      if (filters.selectedRegions.size > 0 && !filters.selectedRegions.has(event.location.region ?? "")) return false;
      if (filters.selectedWeaponSystems.size > 0 && !filters.selectedWeaponSystems.has(event.weaponSystem ?? "")) return false;
      if (filters.selectedSourceTypes.size > 0 && !filters.selectedSourceTypes.has(event.sourceType)) return false;
      if (filters.selectedHandles.size > 0 && !filters.selectedHandles.has(event.sourceChannel ?? "")) return false;
      if (filters.selectedTheaters.size > 0 && !theaterCountries(filters.selectedTheaters).has(event.location.country ?? "")) return false;
      if (filters.selectedCountries.size > 0 && !filters.selectedCountries.has(event.location.country ?? "")) return false;
      if (filters.selectedAttackers.size > 0 && !filters.selectedAttackers.has(event.attacker ?? "")) return false;
      if (filters.selectedTargets.size > 0 && !filters.selectedTargets.has(event.target ?? "")) return false;
      if (filters.selectedAffectedParties.size > 0 && !filters.selectedAffectedParties.has(event.affectedParty ?? "")) return false;
      if (filters.selectedTopics.size > 0 && !event.topics.some((t) => filters.selectedTopics.has(t))) return false;
      return true;
    });
  }, [allEvents, filters.searchQuery, filters.selectedTypes, filters.selectedSeverities, filters.selectedRegions, filters.selectedWeaponSystems, filters.selectedSourceTypes, filters.selectedHandles, filters.selectedTheaters, filters.selectedCountries, filters.selectedAttackers, filters.selectedTargets, filters.selectedAffectedParties, filters.selectedTopics]);

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
    () => setFilters(buildDefaultFilters(liveEventTypes.map((t) => t.key), Object.keys(infraTypes))),
    [liveEventTypes, infraTypes],
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

  const handleFlyToEvent = useCallback((lat: number, lng: number, eventId?: string) => {
    mapRef.current?.getMap().flyTo({
      center: [lng, lat],
      zoom: 11,
      duration: 1800,
      easing: (t: number) => t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2,
    });
    if (eventId) setSelectedEventId(eventId);
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

  // Map uses slim markers (Priority 1), filtered by current type/severity selection
  const filteredMarkers = useMemo(() => {
    return mapMarkers.filter((m) => {
      if (filters.searchQuery && !matchesSearch(filters.searchQuery, m.event_label, m.event_location.name, m.locationRegion)) return false;
      if (filters.selectedTypes.size > 0 && !filters.selectedTypes.has(m.event_type)) return false;
      if (filters.selectedSeverities.size > 0 && !filters.selectedSeverities.has(m.severity)) return false;
      if (filters.selectedRegions.size > 0 && !filters.selectedRegions.has(m.locationRegion ?? "")) return false;
      if (filters.selectedSourceTypes.size > 0 && !filters.selectedSourceTypes.has(m.sourceType)) return false;
      return true;
    });
  }, [mapMarkers, filters.searchQuery, filters.selectedTypes, filters.selectedSeverities, filters.selectedRegions, filters.selectedSourceTypes]);

  const displayMarkers = useMemo(() => {
    if (!timelineDay) return filteredMarkers;
    return filteredMarkers.filter((m) => m.date === timelineDay);
  }, [filteredMarkers, timelineDay]);

  const mapEvents = useMemo(() => markersToMapEvents(displayMarkers), [displayMarkers]);

  // Enriched events by ID for richer popups
  const enrichedEventsById = useMemo(
    () => new Map(allEvents.map((e) => [e.id, e])),
    [allEvents],
  );

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
              className="font-black text-black uppercase leading-none font-['Inter_Tight'] text-[0.85rem] tracking-[0.04em] scale-y-[1.12]"
            >
              The Situation Room
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
          className="relative z-[70] flex h-14 shrink-0 items-center border-b border-border/50 transition-all duration-200"
          style={{
            paddingLeft: isPanelOpen('filter') ? 288 : 56,
            paddingRight: isPanelOpen('feed') ? 392 : 56,
          }}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 pointer-events-none">
            <h1
              className="text-black uppercase leading-none underline decoration-2 underline-offset-[3px] font-['Bebas_Neue'] text-[1.5rem] tracking-[-0.03em] scale-y-[1.15] origin-bottom"
            >
              The Situation Room
            </h1>
            <p
              className="uppercase text-muted-foreground leading-none font-sans font-bold text-[0.55rem] tracking-[0.02em] scale-y-[1.1]"
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
          onFiltersChange={setFilters}
          onClear={handleClearFilters}
          open={isPanelOpen('filter')}
          onOpenChange={handleFilterOpenChange}
          isLoading={isLoading}
          regionOptions={regionOptions}
          severityOptions={severityOptions}
          weaponSystemOptions={weaponSystemOptions}
          sourceTypeOptions={sourceTypeOptions}
          handleOptions={handleOptions}
          theaterOptions={theaterOptions}
          countryOptions={countryOptions}
          attackerOptions={attackerOptions}
          targetOptions={targetOptions}
          affectedPartyOptions={affectedPartyOptions}
          topicOptions={topicOptions}
          eventTypeCounts={eventTypeCounts}
          infraTypes={infraTypes}
        />
        <div className="flex flex-1 min-h-0 min-w-0">
          <div className="relative flex-1 min-h-0 min-w-0" onMouseDown={closeFloatingPanels}>
            <ErrorBoundary>
            <AtlasMap
              events={mapEvents}
              enrichedEventsById={enrichedEventsById}
              layers={effectiveLayers}
              monitorMode={monitorMode}
              dark={dark}
              selectedInfraTypes={filters.selectedInfraTypes}
              infraMarkers={infraMarkers}
              infraColors={infraColors}
              selectedEventId={selectedEventId}
              onEventSelect={setSelectedEventId}
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
            {/* Top-center: Shifra copilot — centered within map area */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
              <FloatingTriggerBtn
                onClick={() => togglePanel('briefing')}
                aria-label={isPanelOpen('briefing') ? "Close briefing" : "Open briefing"}
                className="px-4 py-2 text-sm"
              >
                <Sparkles className="size-4 text-primary" />
                <span className="text-xs font-semibold">Debrief with Shifra</span>
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
                infraTypes={infraTypes}
                infraColors={infraColors}
              />
            </div>
            {/* Bottom-right: Camera */}
            <div className="absolute bottom-4 right-3 z-30">
              <CameraControls mapRef={mapRef} terrainActive={layers.terrain} onResetView={resetView} showLabels={rightLabels} open={isPanelOpen('camera')} onToggle={() => togglePanel('camera')} />
            </div>
            {/* Bottom-center: Alpha disclaimer */}
            <div className="absolute bottom-16 md:bottom-2 left-1/2 -translate-x-1/2 z-20">
              <Badge
                variant="outline"
                className="bg-background/80 backdrop-blur-sm border-red-400/30 text-red-400/70 whitespace-normal overflow-visible py-2 text-xs font-normal px-4"
              >
                <span className="block max-w-sm text-center">
                  In active development. Bugs and inaccuracies can occur.
                </span>
              </Badge>
            </div>
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
            selectedEventId={selectedEventId}
            onEventSelect={setSelectedEventId}
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
