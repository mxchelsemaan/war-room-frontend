import type { EventRow } from "@/types/events";

// ── Political / diplomatic types — relevant from non-LB only if high-severity ──
const POLITICAL_TYPES = new Set([
  "political_statement", "diplomatic_meeting", "government_formation",
  "legislation", "judicial_proceedings", "sanction", "treaty",
  "election", "protest", "humanitarian_crisis",
]);

const HIGH_SEVERITY = new Set(["major", "critical"]);

// ── Lebanon-specific keywords (names, institutions, geography) ──
const LEBANON_KEYWORDS = [
  // geography & demonyms
  "lebanon", "lebanese", "beirut", "nabatieh", "tyre", "sidon", "baalbek",
  "south lebanon", "litani", "bekaa", "dahiyeh", "mount lebanon",
  "tripoli", "jounieh", "bint jbeil", "marjayoun", "hermel", "zahle",
  "chouf", "keserwan", "jbeil", "akkar", "rashaya", "hasbaya",
  // institutions
  "unifil", "laf", "lebanese army", "lebanese parliament", "cedar",
  "parliament", "government", "cabinet",
  // political figures
  "berri", "nabih berri", "salam", "nawaf salam", "nawwaf salam",
  "aoun", "michel aoun", "bassil", "gebran bassil", "geagea", "samir geagea",
  "frangieh", "suleiman frangieh", "hariri", "saad hariri", "rafik hariri",
  "nasrallah", "hassan nasrallah", "jumblatt", "walid jumblatt",
  "mikati", "najib mikati", "qassem", "naim qassem",
  // armed groups
  "hezbollah", "hizballah", "hizbollah",
];

// ── Regional keywords — events mentioning these are relevant regardless of country ──
const REGIONAL_KEYWORDS = [
  // israel
  "netanyahu", "knesset", "idf", "israel", "israeli", "mossad", "shin bet",
  "tel aviv", "west bank", "gaza", "golan",
  // palestinian
  "hamas", "islamic jihad", "pij", "fatah", "ramallah",
  // iran
  "iran", "iranian", "irgc", "quds force", "tehran", "khamenei",
  // syria
  "assad", "damascus", "syrian", "sdf",
  // broader
  "houthis", "hormuz", "strait", "red sea", "bab el-mandeb",
  "ceasefire", "truce", "armistice", "peace deal", "war ended",
];

function buildHaystack(d: EventRow["data"]): string {
  return [
    d.summary, d.summary_en as string | undefined,
    d.location_name, d.location_region,
    d.affected_party, d.target, d.attacker,
    ...(Array.isArray(d.topics) ? d.topics : []),
    d.source_claim, d.additional_context,
  ].filter(Boolean).join(" ").toLowerCase();
}

/**
 * Returns true if the event is relevant to the Lebanon/regional theater.
 *
 * Category A: Lebanon events (location_country = "LB") → always pass
 * Category B: Non-LB political events → pass only if major/critical severity
 * Category C: Any event mentioning Lebanon or regional keywords → pass
 */
export function isRelevantEvent(row: EventRow): boolean {
  const d = row.data;

  // Category A: Lebanon events always pass
  if (d.location_country === "LB") return true;

  const haystack = buildHaystack(d);

  // Category C: Any event mentioning Lebanon keywords
  if (LEBANON_KEYWORDS.some((kw) => haystack.includes(kw))) return true;

  // Category C: Any event mentioning regional keywords
  if (REGIONAL_KEYWORDS.some((kw) => haystack.includes(kw))) return true;

  // Category B: Non-LB political events — only if major/critical severity
  const eventType = d.event_type?.toLowerCase() ?? "";
  if (POLITICAL_TYPES.has(eventType)) {
    const severity = (d.severity as string | undefined)?.toLowerCase() ?? "";
    if (HIGH_SEVERITY.has(severity)) return true;
  }

  return false;
}

/** @deprecated Use isRelevantEvent instead */
export const isLebanonRelated = isRelevantEvent;
