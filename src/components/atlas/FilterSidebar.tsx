
import { useCallback, useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { ChevronLeft, Search, X } from "lucide-react";
import type { InfraTypeMeta } from "@/hooks/useInfraMarkers";
import { DatePicker } from "@/components/ui/DatePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/useIsMobile";
import { SidePanel } from "./SidePanel";
import { MultiSelectDropdown } from "@/components/ui/MultiSelectDropdown";
import type { EventTypeMeta } from "@/types/events";

export interface AtlasFilters {
  selectedTypes: Set<string>;
  selectedInfraTypes: Set<string>;
  selectedSeverities: Set<string>;
  selectedRegions: Set<string>;
  selectedWeaponSystems: Set<string>;
  selectedSourceTypes: Set<string>;
  selectedHandles: Set<string>;
  selectedTheaters: Set<string>;
  selectedCountries: Set<string>;
  selectedAttackers: Set<string>;
  selectedTargets: Set<string>;
  selectedAffectedParties: Set<string>;
  selectedTopics: Set<string>;
  dateFrom: string;
  dateTo: string;
  searchQuery: string;
}

/** Options list for a dynamic filter derived from event data */
export interface FilterOption {
  key: string;
  label: string;
  icon?: string;
  count?: number;
}

interface FilterSidebarProps {
  eventTypes: EventTypeMeta[];
  filters: AtlasFilters;
  onFiltersChange: (filters: AtlasFilters) => void;
  onClear: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading?: boolean;
  /** Dynamic options with cross-filtered counts */
  severityOptions?: FilterOption[];
  regionOptions?: FilterOption[];
  weaponSystemOptions?: FilterOption[];
  sourceTypeOptions: FilterOption[];
  handleOptions: FilterOption[];
  theaterOptions?: FilterOption[];
  countryOptions?: FilterOption[];
  attackerOptions?: FilterOption[];
  targetOptions?: FilterOption[];
  affectedPartyOptions?: FilterOption[];
  topicOptions: FilterOption[];
  /** Event count per event type key */
  eventTypeCounts: Map<string, number>;
  /** Dynamic infrastructure type metadata from Supabase */
  infraTypes?: Record<string, InfraTypeMeta>;
}

function buildInfraOptions(infraTypes?: Record<string, InfraTypeMeta>): FilterOption[] {
  if (!infraTypes) return [];
  return Object.entries(infraTypes).map(([key, meta]) => ({
    key,
    label: meta.label,
    icon: meta.icon,
  }));
}

export function FilterSidebar({
  eventTypes,
  filters,
  onFiltersChange,
  onClear,
  open,
  onOpenChange: setOpen,
  isLoading,
  sourceTypeOptions,
  handleOptions,
  topicOptions,
  eventTypeCounts,
  infraTypes,
}: FilterSidebarProps) {
  const isMobile = useIsMobile();

  // Debounced search input
  const [localSearch, setLocalSearch] = useState(filters.searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Sync local search when external filters reset (e.g. "Clear all")
  useEffect(() => {
    setLocalSearch(filters.searchQuery);
  }, [filters.searchQuery]);

  const handleSearchChange = useCallback((value: string) => {
    setLocalSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onFiltersChange({ ...filters, searchQuery: value });
    }, 300);
  }, [filters, onFiltersChange]);

  const clearSearch = useCallback(() => {
    setLocalSearch("");
    clearTimeout(debounceRef.current);
    onFiltersChange({ ...filters, searchQuery: "" });
  }, [filters, onFiltersChange]);

  const fmtDate = (iso: string) => {
    const d = parseISO(iso);
    return iso.includes("T") ? format(d, "dd MMM, HH:mm") : format(d, "dd MMM yyyy");
  };
  const dateLabel = filters.dateFrom
    ? filters.dateTo
      ? `${fmtDate(filters.dateFrom)} \u2013 ${fmtDate(filters.dateTo)}`
      : fmtDate(filters.dateFrom)
    : filters.dateTo
      ? `\u2264 ${fmtDate(filters.dateTo)}`
      : null;

  // Helper to update a specific Set filter field
  function updateSet<K extends keyof AtlasFilters>(field: K, value: AtlasFilters[K]) {
    onFiltersChange({ ...filters, [field]: value });
  }

  return (
    <SidePanel
      open={open}
      onOpenChange={setOpen}
      side="left"
      width="w-80"
      header={
        <div className="flex h-9 shrink-0 items-center border-b border-border px-3 gap-2">
          {(open || isMobile) && (
            <span className="flex-1 text-sm font-semibold text-foreground">Filters</span>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setOpen(!open)}
            className={open || isMobile ? "ml-auto" : "mx-auto"}
            aria-label={open ? "Collapse filters" : "Expand filters"}
          >
            <ChevronLeft className={`size-4 transition-transform duration-200 ${open || isMobile ? "" : "rotate-180"}`} />
          </Button>
        </div>
      }
      collapsedContent={
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4">
          <span
            className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground select-none [writing-mode:vertical-rl] rotate-180"
          >
            Filters
          </span>
        </div>
      }
    >
      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      {/* Search input */}
      <div className="p-2 border-b border-border">
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <Input
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search events…"
            className="h-auto border-0 bg-transparent shadow-none text-xs focus-visible:ring-0 placeholder:text-muted-foreground/60"
          />
          {localSearch && (
            <button type="button" onClick={clearSearch} className="text-muted-foreground hover:text-foreground">
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* Date filter */}
      <div className="p-2 border-b border-border">
        <DatePicker
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          onChange={(from, to) => onFiltersChange({ ...filters, dateFrom: from, dateTo: to })}
          numberOfMonths={1}
          presetColumns={2}
          label={
            <span className="section-heading">
              Date
            </span>
          }
          dateLabel={dateLabel}
        />
      </div>

      {/* 1. Event type filter */}
      <div className="p-3 border-b border-border">
        <MultiSelectDropdown
          label="Event Type"
          options={eventTypes.map((t) => ({ key: t.key, label: t.label, icon: t.icon, count: eventTypeCounts.get(t.key) ?? 0 }))}
          selected={filters.selectedTypes}
          onChange={(next) => updateSet("selectedTypes", next)}
          isLoading={isLoading}
          searchable
          showPills
          sortable
          placeholder="Search event types…"
          allLabel="All types"
        />
      </div>

      {/* 2. Platform */}
      <div className="p-3 border-b border-border">
        <MultiSelectDropdown
          label="Platform"
          options={sourceTypeOptions}
          selected={filters.selectedSourceTypes}
          onChange={(next) => updateSet("selectedSourceTypes", next)}
          allLabel="All platforms"
        />
      </div>

      {/* 3. Source */}
      <div className="p-3 border-b border-border">
        <MultiSelectDropdown
          label="Source"
          options={handleOptions}
          selected={filters.selectedHandles}
          onChange={(next) => updateSet("selectedHandles", next)}
          searchable
          placeholder="Search sources…"
          allLabel="All sources"
        />
      </div>

      {/* 4. Topics */}
      <div className="p-3 border-b border-border">
        <MultiSelectDropdown
          label="Topics"
          options={topicOptions}
          selected={filters.selectedTopics}
          onChange={(next) => updateSet("selectedTopics", next)}
          searchable
          placeholder="Search topics…"
          allLabel="All topics"
        />
      </div>

      {/* 5. Infrastructure */}
      <div className="p-3 border-b border-border">
        <MultiSelectDropdown
          label="Infrastructure"
          options={buildInfraOptions(infraTypes)}
          selected={filters.selectedInfraTypes}
          onChange={(next) => updateSet("selectedInfraTypes", next)}
          allLabel="All infra"
        />
      </div>

      {/* Clear */}
      <div className="p-3 flex items-center justify-end">
        <Button variant="outline" size="xs" onClick={onClear}>
          Clear
        </Button>
      </div>
      </div>
    </SidePanel>
  );
}
