
import { format, parseISO } from "date-fns";
import { ChevronLeft } from "lucide-react";
import { EventType, MapEvent } from "@/data/index";
import { STATIC_MARKER_META } from "@/data/staticMarkers";
import type { StaticMarkerType } from "@/data/staticMarkers";
import { DatePicker } from "@/components/ui/DatePicker";
import { Button } from "@/components/ui/button";

export interface AtlasFilters {
  selectedTypes: Set<string>;
  selectedInfraTypes: Set<StaticMarkerType>;
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FilterSidebar({
  eventTypes,
  allEvents,
  filters,
  filteredCount,
  onFiltersChange,
  onClear,
  open,
  onOpenChange: setOpen,
}: FilterSidebarProps) {
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

  function toggleInfraType(key: StaticMarkerType) {
    const next = new Set(filters.selectedInfraTypes);
    if (next.has(key)) next.delete(key); else next.add(key);
    onFiltersChange({ ...filters, selectedInfraTypes: next });
  }

  function selectAllInfra() {
    onFiltersChange({ ...filters, selectedInfraTypes: new Set(Object.keys(STATIC_MARKER_META) as StaticMarkerType[]) });
  }

  function selectNoneInfra() {
    onFiltersChange({ ...filters, selectedInfraTypes: new Set() });
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
      className={`relative z-30 flex h-full shrink-0 flex-col border-r border-border bg-card transition-all duration-200 ${
        open ? "w-72" : "w-14 cursor-pointer"
      }`}
      onClick={!open ? () => setOpen(true) : undefined}
    >
      {/* Header with toggle — not scrollable */}
      <div className="flex h-14 shrink-0 items-center border-b border-border px-3 gap-2">
        {open && (
          <span className="flex-1 text-sm font-semibold text-foreground">Filters</span>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setOpen(!open)}
          className={open ? "ml-auto" : "mx-auto"}
          aria-label={open ? "Collapse filters" : "Expand filters"}
        >
          <ChevronLeft className={`size-4 transition-transform duration-200 ${open ? "" : "rotate-180"}`} />
        </Button>
      </div>

      {/* Collapsed: vertical label */}
      {!open && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4">
          <span
            className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground select-none"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            Filters
          </span>
        </div>
      )}

      {/* Expanded content — scrollable */}
      {open && (
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto"><>
      {/* Event type filter */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
            Event Type
          </span>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="text-2xs text-muted-foreground hover:text-foreground transition-colors"
            >
              All
            </button>
            <span className="text-2xs text-muted-foreground">/</span>
            <button
              onClick={selectNone}
              className="text-2xs text-muted-foreground hover:text-foreground transition-colors"
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
              <span className="text-xs leading-none">
                {et.icon} {et.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Infrastructure filter */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
            Infrastructure
          </span>
          <div className="flex gap-2">
            <button onClick={selectAllInfra} className="text-2xs text-muted-foreground hover:text-foreground transition-colors">All</button>
            <span className="text-2xs text-muted-foreground">/</span>
            <button onClick={selectNoneInfra} className="text-2xs text-muted-foreground hover:text-foreground transition-colors">None</button>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          {(Object.entries(STATIC_MARKER_META) as [StaticMarkerType, { label: string; icon: string }][]).map(([key, meta]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={filters.selectedInfraTypes.has(key)}
                onChange={() => toggleInfraType(key)}
                className="w-3.5 h-3.5 accent-foreground cursor-pointer"
              />
              <span className="text-xs leading-none">{meta.icon} {meta.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Date filter */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
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
      <div className="p-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{filteredCount}</span>
          {" / "}
          {total} events
        </span>
        <Button variant="outline" size="xs" onClick={onClear}>
          Clear
        </Button>
      </div>
      </></div>
      )}
    </aside>
  );
}
