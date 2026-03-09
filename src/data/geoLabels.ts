export type GeoFeatureType = "mountain" | "forest" | "lake" | "valley" | "plain" | "cape" | "river_source";

export interface GeoLabel {
  id: string;
  type: GeoFeatureType;
  name: string;
  nameAr?: string;
  lat: number;
  lng: number;
  elevation?: number;
}

export const GEO_FEATURE_META: Record<GeoFeatureType, { label: string; icon: string }> = {
  mountain:     { label: "Mountain",      icon: "⛰️" },
  forest:       { label: "Forest",        icon: "🌲" },
  lake:         { label: "Lake",          icon: "🏞️" },
  valley:       { label: "Valley",        icon: "🏜️" },
  plain:        { label: "Plain",         icon: "🌾" },
  cape:         { label: "Cape",          icon: "🏖️" },
  river_source: { label: "River Source",  icon: "💧" },
};

export const GEO_LABELS: GeoLabel[] = [
  // ── Mountains ───────────────────────────────────────────────────────────────
  { id: "geo-qurnat",    type: "mountain", name: "Qurnat as Sawda",   nameAr: "قرنة السوداء",   lat: 34.2417, lng: 36.0886, elevation: 3088 },
  { id: "geo-sannine",   type: "mountain", name: "Jabal Sannine",     nameAr: "جبل صنين",       lat: 33.9708, lng: 35.8500, elevation: 2628 },
  { id: "geo-hermon",    type: "mountain", name: "Mount Hermon",       nameAr: "جبل الشيخ",      lat: 33.4167, lng: 35.8572, elevation: 2814 },
  { id: "geo-knisseh",   type: "mountain", name: "Jabal al Knisseh",  nameAr: "جبل الكنيسة",    lat: 34.1500, lng: 36.0300, elevation: 2032 },
  { id: "geo-barouk",    type: "mountain", name: "Jabal al Barouk",   nameAr: "جبل الباروك",    lat: 33.7000, lng: 35.7000, elevation: 1980 },
  { id: "geo-makmel",    type: "mountain", name: "Jabal al Makmel",   nameAr: "جبل المكمل",     lat: 34.2600, lng: 36.0700, elevation: 3064 },

  // ── Forests ─────────────────────────────────────────────────────────────────
  { id: "geo-cedars",    type: "forest",   name: "Cedars of God",       nameAr: "أرز الرب",       lat: 34.2456, lng: 36.0628 },
  { id: "geo-chouf",     type: "forest",   name: "Chouf Cedar Reserve", nameAr: "محمية أرز الشوف", lat: 33.6647, lng: 35.7197 },
  { id: "geo-horsh",     type: "forest",   name: "Horsh Ehden",         nameAr: "حرش إهدن",       lat: 34.3050, lng: 36.0050 },
  { id: "geo-tannourine", type: "forest",  name: "Tannourine Cedars",   nameAr: "أرز تنورين",     lat: 34.2000, lng: 35.9300 },

  // ── Lakes ───────────────────────────────────────────────────────────────────
  { id: "geo-qaraoun",   type: "lake",     name: "Lake Qaraoun",      nameAr: "بحيرة القرعون",  lat: 33.5614, lng: 35.6922 },
  { id: "geo-yammouneh", type: "lake",     name: "Lake Yammouneh",    nameAr: "بحيرة يمونة",    lat: 34.0617, lng: 36.0250 },

  // ── Valleys ─────────────────────────────────────────────────────────────────
  { id: "geo-beqaa",     type: "valley",   name: "Beqaa Valley",      nameAr: "سهل البقاع",     lat: 33.8464, lng: 35.9017 },
  { id: "geo-qadisha",   type: "valley",   name: "Qadisha Valley",    nameAr: "وادي قاديشا",    lat: 34.2400, lng: 36.0300 },
  { id: "geo-wadi-taym", type: "valley",   name: "Wadi al-Taym",      nameAr: "وادي التيم",     lat: 33.4500, lng: 35.6800 },

  // ── Plains ──────────────────────────────────────────────────────────────────
  { id: "geo-akkar",     type: "plain",    name: "Akkar Plain",       nameAr: "سهل عكار",       lat: 34.5400, lng: 36.0800 },
  { id: "geo-koura",     type: "plain",    name: "Koura Plateau",     nameAr: "قضاء الكورة",    lat: 34.3200, lng: 35.8100 },

  // ── Capes ───────────────────────────────────────────────────────────────────
  { id: "geo-ras-beirut", type: "cape",    name: "Ras Beirut",        nameAr: "رأس بيروت",      lat: 33.9000, lng: 35.4750 },
  { id: "geo-ras-chekka", type: "cape",    name: "Ras Chekka",        nameAr: "رأس شكا",        lat: 34.3150, lng: 35.7200 },
];

export const GEO_LABELS_GEOJSON: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: GEO_LABELS.map((g) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [g.lng, g.lat] },
    properties: { id: g.id, type: g.type, name: g.name, nameAr: g.nameAr, elevation: g.elevation },
  })),
};
