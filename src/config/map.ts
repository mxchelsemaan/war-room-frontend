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

/** Tight bounding box for Lebanon — coords outside are treated as geocoding errors */
export const LEBANON_BOUNDS = {
  latMin: 33.05,
  latMax: 34.75,
  lngMin: 35.05,
  lngMax: 36.65,
} as const;

export type MonitorMode = "auto" | "heatmap" | "markers";


