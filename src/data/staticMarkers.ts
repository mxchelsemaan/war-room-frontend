export type StaticMarkerType = "airport" | "port" | "checkpoint" | "base" | "hospital";

export interface StaticMarker {
  id: string;
  type: StaticMarkerType;
  label: string;
  sublabel?: string;
  icon: string;
  lat: number;
  lng: number;
}

export const STATIC_MARKER_META: Record<StaticMarkerType, { label: string; icon: string }> = {
  airport:    { label: "Airport",         icon: "✈️" },
  port:       { label: "Port",            icon: "⚓" },
  checkpoint: { label: "Border Crossing", icon: "🛂" },
  base:       { label: "Military Base",   icon: "🪖" },
  hospital:   { label: "Hospital",        icon: "🏥" },
};

export const STATIC_MARKER_COLORS: Record<StaticMarkerType, string> = {
  airport:    "#3b82f6",
  port:       "#06b6d4",
  checkpoint: "#eab308",
  base:       "#f97316",
  hospital:   "#22c55e",
};

export const staticMarkers: StaticMarker[] = [
  // ── Airports ──────────────────────────────────────────────────────────────
  {
    id: "leb-bia",
    type: "airport",
    label: "Rafic Hariri Int'l Airport",
    sublabel: "Beirut (BEY) — civil",
    icon: "✈️",
    lat: 33.8208,
    lng: 35.4884,
  },
  {
    id: "leb-riyaq",
    type: "airport",
    label: "Riyaq Air Base",
    sublabel: "Lebanese Air Force",
    icon: "✈️",
    lat: 33.8507,
    lng: 35.9876,
  },
  {
    id: "leb-kleiat",
    type: "airport",
    label: "René Mouawad Air Base",
    sublabel: "Kleiat (KYE) — military/civil",
    icon: "✈️",
    lat: 34.5893,
    lng: 36.0119,
  },

  // ── Ports ─────────────────────────────────────────────────────────────────
  {
    id: "leb-port-beirut",
    type: "port",
    label: "Port of Beirut",
    sublabel: "Main cargo & container hub",
    icon: "⚓",
    lat: 33.9006,
    lng: 35.5183,
  },
  {
    id: "leb-port-tripoli",
    type: "port",
    label: "Port of Tripoli",
    sublabel: "Northern Lebanon",
    icon: "⚓",
    lat: 34.4479,
    lng: 35.8371,
  },
  {
    id: "leb-port-sidon",
    type: "port",
    label: "Port of Sidon",
    sublabel: "South Lebanon",
    icon: "⚓",
    lat: 33.5570,
    lng: 35.3674,
  },
  {
    id: "leb-port-tyre",
    type: "port",
    label: "Port of Tyre",
    sublabel: "Tyre (Sour)",
    icon: "⚓",
    lat: 33.2741,
    lng: 35.1956,
  },

  // ── Border crossings ──────────────────────────────────────────────────────
  {
    id: "leb-masnaa",
    type: "checkpoint",
    label: "Masnaa Crossing",
    sublabel: "Lebanon–Syria (main)",
    icon: "🛂",
    lat: 33.5178,
    lng: 35.9189,
  },
  {
    id: "leb-arida",
    type: "checkpoint",
    label: "Arida Crossing",
    sublabel: "Lebanon–Syria (north)",
    icon: "🛂",
    lat: 34.6094,
    lng: 36.0522,
  },
  {
    id: "leb-abboudieh",
    type: "checkpoint",
    label: "Abboudieh Crossing",
    sublabel: "Lebanon–Syria (Bekaa)",
    icon: "🛂",
    lat: 33.7500,
    lng: 35.8700,
  },
  {
    id: "leb-naqoura",
    type: "checkpoint",
    label: "Naqoura — UNIFIL HQ",
    sublabel: "Lebanon–Israel (Blue Line west)",
    icon: "🛂",
    lat: 33.1075,
    lng: 35.1384,
  },

  // ── Military bases ─────────────────────────────────────────────────────────
  {
    id: "leb-yarze",
    type: "base",
    label: "Lebanese Ministry of Defence",
    sublabel: "Yarze, Greater Beirut",
    icon: "🪖",
    lat: 33.8600,
    lng: 35.5600,
  },
  {
    id: "leb-laf-south",
    type: "base",
    label: "LAF Southern Command",
    sublabel: "Marjayoun",
    icon: "🪖",
    lat: 33.3570,
    lng: 35.5820,
  },
  {
    id: "leb-laf-north",
    type: "base",
    label: "LAF Northern Command",
    sublabel: "Tripoli area",
    icon: "🪖",
    lat: 34.4350,
    lng: 35.8200,
  },

  // ── Hospitals ─────────────────────────────────────────────────────────────
  {
    id: "leb-aubmc",
    type: "hospital",
    label: "AUBMC",
    sublabel: "American Univ. of Beirut Medical Center",
    icon: "🏥",
    lat: 33.8998,
    lng: 35.4770,
  },
  {
    id: "leb-rhuh",
    type: "hospital",
    label: "Rafik Hariri Univ. Hospital",
    sublabel: "Beirut — main government facility",
    icon: "🏥",
    lat: 33.8635,
    lng: 35.4912,
  },
  {
    id: "leb-south-gov-hosp",
    type: "hospital",
    label: "Tyre Government Hospital",
    sublabel: "Southern Lebanon",
    icon: "🏥",
    lat: 33.2701,
    lng: 35.2031,
  },
];
