import type { EventRow } from "@/types/events";

const LEBANON_KEYWORDS = [
  "lebanon", "lebanese", "beirut", "hezbollah", "hizballah", "hizbollah",
  "nabatieh", "tyre", "sidon", "baalbek", "south lebanon", "litani",
  "bekaa", "dahiyeh", "unifil", "nasrallah", "mount lebanon",
  "tripoli", "jounieh", "bint jbeil", "marjayoun", "hermel",
];

/** Returns true if the event is located in Lebanon or mentions Lebanon-related keywords */
export function isLebanonRelated(row: EventRow): boolean {
  if (row.data.location_country === "LB") return true;

  const d = row.data;
  const haystack = [
    d.summary, d.summary_en as string | undefined,
    d.location_name, d.location_region,
    d.affected_party, d.target, d.attacker,
    ...(Array.isArray(d.topics) ? d.topics : []),
    d.source_claim, d.additional_context,
  ].filter(Boolean).join(" ").toLowerCase();

  return LEBANON_KEYWORDS.some((kw) => haystack.includes(kw));
}
