import type { EventRow, EnrichedEvent } from "@/types/events";

/** Transform a raw DB row into a display-ready EnrichedEvent */
export function transformRow(row: EventRow): EnrichedEvent {
  const d = row.data;

  // Prefer date_occurred, fallback to message_date
  const rawDate = row.date_occurred ?? row.message_date;
  const date = rawDate ? rawDate.slice(0, 10) : "Unknown";

  return {
    id: row.id,
    eventType: d.event_type ?? "unknown",
    summary: d.summary ?? d.summary_en ?? "",
    severity: d.severity ?? "moderate",
    verificationStatus: d.verification_status ?? "reported",
    date,
    dateTime: row.date_occurred ?? row.message_date ?? null,
    location: {
      name: d.location_name ?? "Unknown location",
      region: d.location_region ?? null,
      country: d.location_country ?? null,
      lat: row.latitude ?? null,
      lng: row.longitude ?? null,
    },
    sourceType: row.source_type,
    sourceChannel: row.source_channel,
    casualties: {
      killed: d.casualties_killed ?? (d.casualties as any)?.killed ?? null,
      injured: d.casualties_injured ?? (d.casualties as any)?.injured ?? null,
      displaced: d.casualties_displaced ?? (d.casualties as any)?.displaced ?? null,
    },
    attacker: d.attacker ?? null,
    affectedParty: d.affected_party ?? null,
    weaponSystem: d.weapon_system ?? d.weapon_type ?? null,
    topics: Array.isArray(d.topics) ? d.topics : [],
    sourceClaim: d.source_claim ?? null,
    mediaUrl: row.media_url ?? null,
  };
}
