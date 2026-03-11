/** Shared map configuration constants */

/** Countries to fetch events for — server-side filter passed to Supabase RPCs */
export const THEATER_COUNTRIES = ["LB"] as const;

export const DEFAULT_VIEW = {
  longitude: 35.5018,
  latitude: 33.8938,
  zoom: 9,
  pitch: 0,
  bearing: 0,
} as const;

/** Loose bounds — allows surrounding countries to be visible with vignette treatment */
export const MAX_BOUNDS: [[number, number], [number, number]] = [
  [31.0, 29.5],
  [40.5, 37.5],
];

export const TERRAIN_CONFIG = {
  exaggeration: 5.0,
  pitch3d: 65,
} as const;

export const SKY_CONFIG = {
  skyColor: "#9ab5c8",
  horizonColor: "#d4dfe6",
  fogColor: "#cbbf9e",
  fogGroundBlend: 0.22,
  horizonFogBlend: 0.45,
  skyHorizonBlend: 0.38,
  atmosphereBlendInitial: 0.45,
  atmosphereBlendMin: 0.38,
  atmosphereBlendMax: 0.52,
} as const;

export const FACTION_COLORS = {
  idf: "#dc2626",
  hezbollah: "#f59e0b",
  unknown: "#808080",
} as const;

export const NATO_SYMBOL_BG = "#1a1a2e";

// ── Event monitor crossfade configuration ────────────────────────────────────

export const CROSSFADE = {
  HEATMAP_FULL: 9,    // heatmap 100% opacity below this zoom
  FADE_START: 9,      // crossfade begins
  FADE_END: 10.5,     // crossfade ends, markers 100% above this
} as const;

export const DEFAULT_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type MonitorMode = "auto" | "heatmap" | "markers";

// ── Heatmap configuration ────────────────────────────────────────────────────

export interface HeatmapPreset {
  key: string;
  label: string;
  description: string;
  icon: string;
  eventTypeFilter: string[] | null;     // null = all types
  weightStrategy: "severity" | "casualties" | "density";
}

export const HEATMAP_PRESETS: Record<string, HeatmapPreset> = {
  all_events: {
    key: "all_events", label: "All Events", icon: "📊",
    description: "All events weighted by severity",
    eventTypeFilter: null, weightStrategy: "severity",
  },
  airstrikes: {
    key: "airstrikes", label: "Air Ops", icon: "💥",
    description: "Airstrikes, drones, missiles, rockets",
    eventTypeFilter: ["airstrike", "drone_strike", "missile_attack", "rocket_attack", "shelling"],
    weightStrategy: "severity",
  },
  ground_combat: {
    key: "ground_combat", label: "Ground", icon: "⚔️",
    description: "Armed clashes, ground ops, raids",
    eventTypeFilter: ["armed_clash", "ground_operation", "raid", "border_incident", "explosion"],
    weightStrategy: "severity",
  },
  casualties: {
    key: "casualties", label: "Casualties", icon: "🩸",
    description: "Weighted by killed + injured count",
    eventTypeFilter: null, weightStrategy: "casualties",
  },
  density: {
    key: "density", label: "Density", icon: "🔵",
    description: "Pure event density, equal weight",
    eventTypeFilter: null, weightStrategy: "density",
  },
};

export interface HeatmapSettings {
  preset: string;
  radius: number;
  intensity: number;
  opacity: number;
  colorScheme: string;
  drapeOnTerrain: boolean;
}

export const HEATMAP_DEFAULTS: HeatmapSettings = {
  preset: "all_events",
  radius: 40,
  intensity: 3.0,
  opacity: 0.85,
  colorScheme: "fire",
  drapeOnTerrain: false,
} as const;

export const HEATMAP_GRID = {
  cellSizeKm: 1.5,
  floatAltitude: 4000,     // meters ASL
  slabThickness: 200,      // meters
  bounds: { west: 34.8, east: 36.8, south: 32.9, north: 34.8 },
} as const;

export const HEATMAP_COLOR_SCHEMES: Record<string, { label: string; stops: [number, string][]; lightStops: [number, string][] }> = {
  fire: {
    label: "Fire",
    stops: [
      [0, "rgba(0,0,0,0)"], [0.05, "#1e3a5f"], [0.35, "#7b2d8e"],
      [0.55, "#dc2626"], [0.75, "#f97316"], [1, "#fef9c3"],
    ],
    lightStops: [
      [0, "rgba(0,0,0,0)"], [0.05, "#fecaca"], [0.35, "#f87171"],
      [0.55, "#dc2626"], [0.75, "#b91c1c"], [1, "#7f1d1d"],
    ],
  },
  plasma: {
    label: "Plasma",
    stops: [
      [0, "rgba(0,0,0,0)"], [0.05, "#0d0887"], [0.35, "#7e03a8"],
      [0.55, "#cc4778"], [0.75, "#f89540"], [1, "#f0f921"],
    ],
    lightStops: [
      [0, "rgba(0,0,0,0)"], [0.05, "#e0cffc"], [0.35, "#a855f7"],
      [0.55, "#7e22ce"], [0.75, "#cc4778"], [1, "#581c87"],
    ],
  },
  arctic: {
    label: "Arctic",
    stops: [
      [0, "rgba(0,0,0,0)"], [0.05, "#0c1445"], [0.35, "#1b6497"],
      [0.55, "#2bc0e4"], [0.75, "#b4ecf2"], [1, "#ffffff"],
    ],
    lightStops: [
      [0, "rgba(0,0,0,0)"], [0.05, "#bae6fd"], [0.35, "#38bdf8"],
      [0.55, "#0284c7"], [0.75, "#1e3a5f"], [1, "#0c1445"],
    ],
  },
  military: {
    label: "Military",
    stops: [
      [0, "rgba(0,0,0,0)"], [0.05, "#1a1c16"], [0.35, "#3d4a2e"],
      [0.55, "#6b8c42"], [0.75, "#a3c644"], [1, "#e2f57a"],
    ],
    lightStops: [
      [0, "rgba(0,0,0,0)"], [0.05, "#d9f99d"], [0.35, "#84cc16"],
      [0.55, "#4d7c0f"], [0.75, "#3d4a2e"], [1, "#1a1c16"],
    ],
  },
};

