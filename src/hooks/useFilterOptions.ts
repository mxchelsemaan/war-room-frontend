import { useMemo } from "react";
import type { EnrichedEvent } from "@/types/events";
import type { AtlasFilters, FilterOption } from "@/components/atlas/FilterSidebar";
import { computeCrossFacets } from "@/lib/facetUtils";
import { THEATERS } from "@/config/theaters";

const SEVERITY_META = [
  { key: "critical", label: "Critical", icon: "🔴" },
  { key: "major", label: "Major", icon: "🟠" },
  { key: "moderate", label: "Moderate", icon: "🟡" },
  { key: "minor", label: "Minor", icon: "🟢" },
];

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

/** Case-insensitive text match across multiple fields */
export function matchesSearch(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = query.toLowerCase();
  return fields.some((f) => f?.toLowerCase().includes(q));
}

export function useFilterOptions(allEvents: EnrichedEvent[], filters: AtlasFilters) {
  // ── Base options: all unique values per dimension (stable, from all loaded events) ──
  const baseSeverityOptions = useMemo<FilterOption[]>(() =>
    SEVERITY_META.map((s) => ({ key: s.key, label: s.label, icon: s.icon })),
  []);
  const baseRegionOptions = useMemo(() => extractOptions(allEvents, (e) => e.location.region), [allEvents]);
  const baseSourceTypeOptions = useMemo(() => extractOptions(allEvents, (e) => e.sourceType), [allEvents]);
  const baseWeaponSystemOptions = useMemo(() => extractOptions(allEvents, (e) => e.weaponSystem), [allEvents]);
  const baseHandleOptions = useMemo(() => extractOptions(allEvents, (e) => e.sourceChannel), [allEvents]);
  const baseTheaterOptions = useMemo<FilterOption[]>(() =>
    Object.entries(THEATERS).map(([key, t]) => ({ key, label: t.label })),
  []);
  const baseCountryOptions = useMemo(() => extractOptions(allEvents, (e) => e.location.country), [allEvents]);
  const baseAttackerOptions = useMemo(() => extractOptions(allEvents, (e) => e.attacker), [allEvents]);
  const baseTargetOptions = useMemo(() => extractOptions(allEvents, (e) => e.target), [allEvents]);
  const baseAffectedPartyOptions = useMemo(() => extractOptions(allEvents, (e) => e.affectedParty), [allEvents]);
  const baseTopicOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const e of allEvents) {
      for (const t of e.topics) seen.add(t);
    }
    return Array.from(seen).sort().map((v) => ({ key: v, label: toLabel(v) }));
  }, [allEvents]);

  // Pre-filter events by search query before cross-faceting
  const searchFilteredEvents = useMemo(() => {
    if (!filters.searchQuery) return allEvents;
    return allEvents.filter((e) => matchesSearch(filters.searchQuery, e.summary, e.location.name, e.attacker, e.target, e.affectedParty, e.weaponSystem, e.sourceChannel, e.topics.join(' '), e.sourceClaim));
  }, [allEvents, filters.searchQuery]);

  // ── Cross-filtered counts: for each dimension, apply all OTHER filters ──
  const crossFacets = useMemo(
    () => computeCrossFacets(searchFilteredEvents, filters),
    [searchFilteredEvents, filters],
  );

  // Merge base options with cross-filtered counts (single memo)
  const options = useMemo(() => {
    const merge = (opts: FilterOption[], counts: Map<string, number>): FilterOption[] =>
      opts.map((o) => ({ ...o, count: counts.get(o.key) ?? 0 }));
    return {
      severityOptions: merge(baseSeverityOptions, crossFacets.severityCounts),
      regionOptions: merge(baseRegionOptions, crossFacets.regionCounts),
      sourceTypeOptions: merge(baseSourceTypeOptions, crossFacets.sourceTypeCounts),
      weaponSystemOptions: merge(baseWeaponSystemOptions, crossFacets.weaponSystemCounts),
      handleOptions: merge(baseHandleOptions, crossFacets.handleCounts),
      theaterOptions: merge(baseTheaterOptions, crossFacets.theaterCounts),
      countryOptions: merge(baseCountryOptions, crossFacets.countryCounts),
      attackerOptions: merge(baseAttackerOptions, crossFacets.attackerCounts),
      targetOptions: merge(baseTargetOptions, crossFacets.targetCounts),
      affectedPartyOptions: merge(baseAffectedPartyOptions, crossFacets.affectedPartyCounts),
      topicOptions: merge(baseTopicOptions, crossFacets.topicCounts),
      eventTypeCounts: crossFacets.typeCounts,
    };
  }, [baseSeverityOptions, baseRegionOptions, baseSourceTypeOptions, baseWeaponSystemOptions, baseHandleOptions, baseTheaterOptions, baseCountryOptions, baseAttackerOptions, baseTargetOptions, baseAffectedPartyOptions, baseTopicOptions, crossFacets]);

  return options;
}
