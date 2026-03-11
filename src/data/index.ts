// ---------------------------------------------------------------------------
// Atlas / Map events
// ---------------------------------------------------------------------------

import rawEvents from './mockEvents.json';

export interface EventLocation {
  name: string;
  lat: number;
  lng: number;
}

export interface MapEvent {
  id: string;
  event_type: string;
  event_icon: string;
  event_label: string;
  event_location: EventLocation;
  event_count: number;
  date: string;
  summary?: string;
  severity?: string;
  sourceType?: string;
  sourceChannel?: string;
  sourceId?: string;
  verificationStatus?: string;
  casualties?: { killed: number | null; injured: number | null; displaced: number | null };
}

export interface EventType {
  key: string;
  label: string;
  icon: string;
}

export interface MockEventsData {
  event_types: EventType[];
  events: (Omit<MapEvent, 'id'> & { id: number })[];
}

const eventsData = rawEvents as MockEventsData;

export const mockEventTypes: EventType[] = eventsData.event_types;
export const mockMapEvents: MapEvent[] = eventsData.events.map(e => ({ ...e, id: String(e.id) }));

