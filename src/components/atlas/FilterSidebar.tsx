"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ChevronLeft } from "lucide-react";
import { EventType, MapEvent } from "@/data/index";
import { DatePicker } from "@/components/ui/DatePicker";

export interface AtlasFilters {
  selectedTypes: Set<string>;
  dateFrom: string;
  dateTo: string;
}

interface FilterSidebarProps {
  eventTypes: EventType[];
  allEvents: MapEvent[];
  filters: AtlasFilters;
  filteredCount: number;
  onFiltersChange: (filters: AtlasFilters) => void;
  onClear: () => void;
}

export function FilterSidebar({
  eventTypes,
  allEvents,
  filters,
  filteredCount,
  onFiltersChange,
  onClear,
}: FilterSidebarProps) {
  const [open, setOpen] = useState(true);
  const total = allEvents.length;

  function toggleType(key: string) {
    const next = new Set(filters.selectedTypes);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onFiltersChange({ ...filters, selectedTypes: next });
  }

  function selectAll() {
    onFiltersChange({
      ...filters,
      selectedTypes: new Set(eventTypes.map((t) => t.key)),
    });
  }

  function selectNone() {
    onFiltersChange({ ...filters, selectedTypes: new Set() });
  }

  const dateLabel = filters.dateFrom
    ? filters.dateTo
      ? `${format(parseISO(filters.dateFrom), "dd MMM")} \u2013 ${format(parseISO(filters.dateTo), "dd MMM yyyy")}`
      : format(parseISO(filters.dateFrom), "dd MMM yyyy")
    : filters.dateTo
      ? `\u2264 ${format(parseISO(filters.dateTo), "dd MMM yyyy")}`
      : null;

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-border bg-card transition-all duration-200 overflow-y-auto ${
        open ? "w-72" : "w-14"
      }`}
    >
      {/* Header with toggle */}
      <div className="flex h-14 shrink-0 items-center border-b border-border px-3 gap-2">
        {open && (
          <span className="flex-1 text-sm font-semibold text-foreground">Filters</span>
        )}
        <button
          onClick={() => setOpen((o) => !o)}
          className={`flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ${
            open ? "ml-auto" : "mx-auto"
          }`}
          aria-label={open ? "Collapse filters" : "Expand filters"}
        >
          <ChevronLeft className={`h-4 w-4 transition-transform duration-200 ${open ? "" : "rotate-180"}`} />
        </button>
      </div>

      {/* Collapsed: vertical label */}
      {!open && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4">
          <span
            className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground select-none"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            Filters
          </span>
        </div>
      )}

      {/* Expanded content */}
      {open && (
        <>
      {/* Event type filter */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Event Type
          </span>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              All
            </button>
            <span className="text-xs text-muted-foreground">/</span>
            <button
              onClick={selectNone}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              None
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          {eventTypes.map((et) => (
            <label
              key={et.key}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <input
                type="checkbox"
                checked={filters.selectedTypes.has(et.key)}
                onChange={() => toggleType(et.key)}
                className="w-3.5 h-3.5 accent-foreground cursor-pointer"
              />
              <span className="text-sm leading-none">
                {et.icon} {et.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Date filter */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Date
          </span>
          {dateLabel && (
            <span className="text-xs text-muted-foreground">{dateLabel}</span>
          )}
        </div>
        <DatePicker
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          onChange={(from, to) => onFiltersChange({ ...filters, dateFrom: from, dateTo: to })}
          numberOfMonths={1}
          presetColumns={2}
        />
      </div>

      {/* Counter + clear */}
      <div className="p-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{filteredCount}</span>
          {" / "}
          {total} events
        </span>
        <button
          onClick={onClear}
          className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-2.5 py-1 transition-colors hover:bg-muted"
        >
          Clear
        </button>
      </div>
      </>
      )}
    </aside>
  );
}
