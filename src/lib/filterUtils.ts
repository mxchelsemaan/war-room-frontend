import type { EventRow } from "@/types/events";

// ── Lebanon-specific keywords (names, institutions, geography, figures) ──
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
 * Returns true if the event is relevant to Lebanon.
 * - location_country = "LB" → always pass
 * - Otherwise pass if any text field mentions Lebanon-related keywords
 */
export function isRelevantEvent(row: EventRow): boolean {
  if (row.data.location_country === "LB") return true;

  const haystack = buildHaystack(row.data);
  return LEBANON_KEYWORDS.some((kw) => haystack.includes(kw));
}

/** @deprecated Use isRelevantEvent instead */
export const isLebanonRelated = isRelevantEvent;
