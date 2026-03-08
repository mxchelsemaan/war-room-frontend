"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { FilterSidebar } from "./FilterSidebar";
import type { AtlasFilters } from "./FilterSidebar";
import { TimelineScrubber } from "./TimelineScrubber";
import { EventFeedPanel } from "./EventFeedPanel";
import { AISummaryCard } from "./AISummaryCard";
import { mockEventTypes, mockMapEvents } from "@/data/index";

// Dynamically import AtlasMap with SSR disabled — Leaflet requires `window`
const AtlasMap = dynamic(
  () => import("./AtlasMap").then((m) => ({ default: m.AtlasMap })),
  { ssr: false, loading: () => <div className="flex-1 bg-[#0f0f1a]" /> }
);

function buildDefaultFilters(): AtlasFilters {
  return {
    selectedTypes: new Set(mockEventTypes.map((t) => t.key)),
    dateFrom: "",
    dateTo: "",
  };
}

export function AtlasView() {
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
  const [feedOpen, setFeedOpen] = useState(true);

  useEffect(() => {
    setTimelineDay(null);
  }, [filters.dateFrom, filters.dateTo]);

  const mapEvents = useMemo(() => {
    if (!timelineDay) return filteredEvents;
    return filteredEvents.filter((e) => e.date === timelineDay);
  }, [filteredEvents, timelineDay]);

  return (
    <>
      <FilterSidebar
        eventTypes={mockEventTypes}
        allEvents={mockMapEvents}
        filters={filters}
        filteredCount={filteredEvents.length}
        onFiltersChange={setFilters}
        onClear={() => setFilters(buildDefaultFilters())}
      />
      <div className="flex flex-1 flex-col min-h-0 min-w-0">
        <div className="flex h-14 shrink-0 items-center border-b border-border px-5">
          <h1 className="text-base font-semibold">Atlas</h1>
          <span className="ml-3 text-sm text-muted-foreground">Lebanon — live event map</span>
        </div>
        <div className="flex flex-1 min-h-0 min-w-0">
          <div className="relative flex-1 min-h-0 min-w-0">
            <AtlasMap events={mapEvents} />
            <AISummaryCard />
            {mapEvents.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="rounded-xl border border-border bg-card/90 px-6 py-4 text-center shadow-lg backdrop-blur-sm">
                  <p className="text-sm font-medium text-foreground">No events match the current filters.</p>
                  <p className="mt-1 text-xs text-muted-foreground">Adjust the event types or date range to see results.</p>
                </div>
              </div>
            )}
            {(filters.dateFrom || filters.dateTo) && timelineDates.length >= 2 && (
              <TimelineScrubber
                dates={timelineDates}
                activeDay={timelineDay}
                onChange={setTimelineDay}
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
    </>
  );
}
