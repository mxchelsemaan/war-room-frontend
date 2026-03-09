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
  id: number;
  event_type: string;
  event_icon: string;
  event_label: string;
  event_location: EventLocation;
  event_count: number;
  date: string;
}

export interface EventType {
  key: string;
  label: string;
  icon: string;
}

export interface MockEventsData {
  event_types: EventType[];
  events: MapEvent[];
}

const eventsData = rawEvents as MockEventsData;

export const mockEventTypes: EventType[] = eventsData.event_types;
export const mockMapEvents: MapEvent[] = eventsData.events;

