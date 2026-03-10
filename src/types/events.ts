/** Raw row from get_events_page RPC */
export interface EventRow {
  id: string;
  source_type: string;
  source_id: string;
  source_channel: string | null;
  date_occurred: string | null;
  message_date: string | null;
  latitude: number | null;
  longitude: number | null;
  enriched_at: string;
  data: EventData;
  media_url: string | null;
}

/** JSONB data column — open-ended, index signature for future fields */
export interface EventData {
  event_type: string;
  summary: string;
  severity?: "minor" | "moderate" | "major" | "critical";
  verification_status?: "confirmed" | "reported" | "alleged" | "denied";
  location_name?: string | null;
  location_region?: string | null;
  location_country?: string | null;
  target?: string | null;
  attacker?: string | null;
  affected_party?: string | null;
  casualties_killed?: number | null;
  casualties_injured?: number | null;
  casualties_displaced?: number | null;
  weapon_system?: string | null;
  weapon_type?: string | null;
  topics?: string[];
  source_claim?: string | null;
  additional_context?: string | null;
  confidence?: number | null;
  [key: string]: unknown;
}

/** Display-ready event consumed by components */
export interface EnrichedEvent {
  id: string;
  eventType: string;
  summary: string;
  severity: "minor" | "moderate" | "major" | "critical";
  verificationStatus: "confirmed" | "reported" | "alleged" | "denied";
  date: string;              // yyyy-MM-dd
  dateTime: string | null;   // full ISO
  location: {
    name: string;
    region: string | null;
    country: string | null;
    lat: number | null;
    lng: number | null;
  };
  sourceType: string;
  sourceChannel: string | null;
  casualties: { killed: number | null; injured: number | null; displaced: number | null };
  attacker: string | null;
  affectedParty: string | null;
  weaponSystem: string | null;
  topics: string[];
  sourceClaim: string | null;
  mediaUrl: string | null;
}

/** Metadata for rendering an event type */
export interface EventTypeMeta {
  key: string;
  label: string;
  icon: string;
  color: string;
}

/** Timeline date entry with event count (from materialized view) */
export interface TimelineDateEntry {
  day: string;
  count: number;
}

/** Aggregated filter facets from materialized view */
export interface FilterFacets {
  by_type: Record<string, number>;
  by_severity: Record<string, number>;
  by_region: Record<string, number>;
  by_source_type: Record<string, number>;
  total: number;
}

/** Slim row from get_map_markers / get_new_markers_since RPCs */
export interface MapMarkerRow {
  id: string;
  event_type: string;
  severity: string | null;
  lat: number;
  lng: number;
  date: string;            // ISO timestamptz
  source_type: string;
  location_name: string | null;
  location_region: string | null;
  enriched_at: string;
}

/** Display-ready marker for the map (converted from MapMarkerRow) */
export interface MapMarkerEvent {
  id: string;
  event_type: string;
  event_icon: string;
  event_label: string;
  event_location: { name: string; lat: number; lng: number };
  event_count: number;
  date: string;            // yyyy-MM-dd
  severity: string;
  sourceType: string;
  locationRegion: string | null;
}
