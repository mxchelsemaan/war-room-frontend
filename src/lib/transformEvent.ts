import type { EventRow, EnrichedEvent, MapMarkerRow, MapMarkerEvent } from "@/types/events";
import { getEventTypeMeta } from "@/config/eventTypes";

/** Transform a raw DB row into a display-ready EnrichedEvent */
export function transformRow(row: EventRow): EnrichedEvent {
  const d = row.data;

  const rawDate = row.message_date;
  const date = rawDate ? rawDate.slice(0, 10) : "Unknown";

  return {
    id: row.id,
    eventType: d.event_type ?? "unknown",
    summary: d.summary ?? d.summary_en ?? "",
    severity: d.severity ?? "moderate",
    verificationStatus: d.verification_status ?? "reported",
    date,
    dateTime: row.message_date ?? null,
    messageDate: row.message_date ?? null,
    location: {
      name: d.location_name ?? "Unknown location",
      region: d.location_region ?? null,
      country: d.location_country ?? null,
      lat: row.latitude ?? null,
      lng: row.longitude ?? null,
    },
    sourceType: row.source_type,
    sourceChannel: row.source_channel,
    sourceId: row.source_id,
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
    mediaType: row.media_type ?? null,
    enrichedAt: row.enriched_at,
  };
}

/** Transform a slim marker row into a map-ready marker */
export function transformMarkerRow(row: MapMarkerRow): MapMarkerEvent {
  const meta = getEventTypeMeta(row.event_type);
  const rawDate = row.date ? row.date.slice(0, 10) : "Unknown";

  return {
    id: row.id,
    event_type: row.event_type,
    event_icon: meta.icon,
    event_label: meta.label,
    event_location: {
      name: row.location_name ?? "Unknown location",
      lat: row.lat,
      lng: row.lng,
    },
    event_count: 1,
    date: rawDate,
    severity: row.severity ?? "moderate",
    sourceType: row.source_type,
    locationRegion: row.location_region ?? null,
  };
}
