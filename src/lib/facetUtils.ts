import type { EnrichedEvent } from "@/types/events";
import type { AtlasFilters } from "@/components/atlas/FilterSidebar";
import { COUNTRY_TO_THEATER, theaterCountries } from "@/config/theaters";

export interface CrossFacets {
  typeCounts: Map<string, number>;
  severityCounts: Map<string, number>;
  regionCounts: Map<string, number>;
  weaponSystemCounts: Map<string, number>;
  sourceTypeCounts: Map<string, number>;
  handleCounts: Map<string, number>;
  theaterCounts: Map<string, number>;
  countryCounts: Map<string, number>;
  attackerCounts: Map<string, number>;
  targetCounts: Map<string, number>;
  affectedPartyCounts: Map<string, number>;
  topicCounts: Map<string, number>;
}

/**
 * Single-pass cross-faceting: for each event compute an 11-bit mask of which
 * filters it passes, then for each dimension count events passing all OTHER
 * dimensions.
 */
export function computeCrossFacets(events: EnrichedEvent[], filters: AtlasFilters): CrossFacets {
  // Bit positions: 0=types, 1=severities, 2=regions, 3=weaponSystems, 4=sourceTypes, 5=handles,
  //                6=countries, 7=attackers, 8=targets, 9=affectedParties, 10=topics, 11=theaters
  const hasType = filters.selectedTypes.size > 0;
  const hasSev = filters.selectedSeverities.size > 0;
  const hasReg = filters.selectedRegions.size > 0;
  const hasWep = filters.selectedWeaponSystems.size > 0;
  const hasSrc = filters.selectedSourceTypes.size > 0;
  const hasHdl = filters.selectedHandles.size > 0;
  const hasCty = filters.selectedCountries.size > 0;
  const hasAtk = filters.selectedAttackers.size > 0;
  const hasTgt = filters.selectedTargets.size > 0;
  const hasAff = filters.selectedAffectedParties.size > 0;
  const hasTop = filters.selectedTopics.size > 0;
  const hasThtr = filters.selectedTheaters.size > 0;
  const theaterCodes = hasThtr ? theaterCountries(filters.selectedTheaters) : null;
  const FULL = 0b111111111111;

  const typeCounts = new Map<string, number>();
  const severityCounts = new Map<string, number>();
  const regionCounts = new Map<string, number>();
  const weaponSystemCounts = new Map<string, number>();
  const sourceTypeCounts = new Map<string, number>();
  const handleCounts = new Map<string, number>();
  const theaterCounts = new Map<string, number>();
  const countryCounts = new Map<string, number>();
  const attackerCounts = new Map<string, number>();
  const targetCounts = new Map<string, number>();
  const affectedPartyCounts = new Map<string, number>();
  const topicCounts = new Map<string, number>();

  for (const e of events) {
    let bits = FULL;
    if (hasType && !filters.selectedTypes.has(e.eventType)) bits &= ~1;
    if (hasSev && !filters.selectedSeverities.has(e.severity)) bits &= ~2;
    if (hasReg && !filters.selectedRegions.has(e.location.region ?? "")) bits &= ~4;
    if (hasWep && !filters.selectedWeaponSystems.has(e.weaponSystem ?? "")) bits &= ~8;
    if (hasSrc && !filters.selectedSourceTypes.has(e.sourceType)) bits &= ~16;
    if (hasHdl && !filters.selectedHandles.has(e.sourceChannel ?? "")) bits &= ~32;
    if (hasCty && !filters.selectedCountries.has(e.location.country ?? "")) bits &= ~64;
    if (hasAtk && !filters.selectedAttackers.has(e.attacker ?? "")) bits &= ~128;
    if (hasTgt && !filters.selectedTargets.has(e.target ?? "")) bits &= ~256;
    if (hasAff && !filters.selectedAffectedParties.has(e.affectedParty ?? "")) bits &= ~512;
    if (hasTop && !e.topics.some((t) => filters.selectedTopics.has(t))) bits &= ~1024;
    if (hasThtr && !theaterCodes!.has(e.location.country ?? "")) bits &= ~2048;

    // For each dimension, count if all OTHER filters pass (mask without that bit)
    const inc = (bit: number, key: string | null | undefined, map: Map<string, number>) => {
      if (key && (bits & (FULL ^ bit)) === (FULL ^ bit)) map.set(key, (map.get(key) ?? 0) + 1);
    };
    inc(1, e.eventType, typeCounts);
    inc(2, e.severity, severityCounts);
    inc(4, e.location.region, regionCounts);
    inc(8, e.weaponSystem, weaponSystemCounts);
    inc(16, e.sourceType, sourceTypeCounts);
    inc(32, e.sourceChannel, handleCounts);
    inc(64, e.location.country, countryCounts);
    inc(128, e.attacker, attackerCounts);
    inc(256, e.target, targetCounts);
    inc(512, e.affectedParty, affectedPartyCounts);
    // Topics: each topic gets counted independently
    if ((bits & (FULL ^ 1024)) === (FULL ^ 1024)) {
      for (const t of e.topics) {
        topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1);
      }
    }
    // Theater: derive from country code
    const theater = COUNTRY_TO_THEATER[e.location.country ?? ""];
    inc(2048, theater, theaterCounts);
  }

  return { typeCounts, severityCounts, regionCounts, weaponSystemCounts, sourceTypeCounts, handleCounts, theaterCounts, countryCounts, attackerCounts, targetCounts, affectedPartyCounts, topicCounts };
}
