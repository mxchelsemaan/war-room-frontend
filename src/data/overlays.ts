import type { FeatureCollection, LineString, Polygon } from "geojson";

/** Major Lebanese rivers — coordinates from OSM relation geometry */
export const LEBANON_RIVERS: FeatureCollection<LineString> = {
  type: "FeatureCollection",
  features: [
    {
      // Litani: Yammouneh spring (N Bekaa) → S through Bekaa valley
      //         → Al-Qaraoun reservoir → SW gorge → coastal plain → Qasimiyeh mouth
      type: "Feature",
      properties: { name: "Litani River" },
      geometry: {
        type: "LineString",
        coordinates: [
          // Upper: Bekaa valley, flowing south-southwest
          [36.08, 33.97], [36.04, 33.93], [36.00, 33.88],
          [35.95, 33.83], [35.91, 33.79],
          // Al-Qaraoun reservoir
          [35.87, 33.72], [35.80, 33.64], [35.73, 33.58],
          [35.63, 33.56], [35.56, 33.55],
          // Gorge (steep SW descent through mountains)
          [35.52, 33.48], [35.47, 33.39], [35.44, 33.32],
          // Lower coastal plain → mouth near Qasimiyeh
          [35.39, 33.31], [35.33, 33.31], [35.28, 33.33], [35.24, 33.34],
        ],
      },
    },
    {
      // Hasbani (Snir): slopes of Mt Hermon → Marjayoun plain → Jordan River
      type: "Feature",
      properties: { name: "Nahr Hasbani" },
      geometry: {
        type: "LineString",
        coordinates: [
          [35.65, 33.55], [35.64, 33.49], [35.63, 33.42],
          [35.62, 33.35], [35.62, 33.28], [35.62, 33.22],
          [35.62, 33.19], [35.63, 33.11],
        ],
      },
    },
    {
      // Orontes (Nahr el-Assi): S Bekaa → N through Hermel → Syria
      type: "Feature",
      properties: { name: "Nahr el-Assi (Orontes)" },
      geometry: {
        type: "LineString",
        coordinates: [
          [36.07, 34.02], [36.11, 34.09], [36.17, 34.17],
          [36.23, 34.24], [36.30, 34.32], [36.37, 34.39],
          [36.42, 34.47], [36.49, 34.55],
        ],
      },
    },
    {
      // Nahr Ibrahim (Adonis): Afqa gorge → Mediterranean near Byblos
      type: "Feature",
      properties: { name: "Nahr Ibrahim" },
      geometry: {
        type: "LineString",
        coordinates: [
          [35.90, 34.10], [35.83, 34.09], [35.76, 34.09],
          [35.69, 34.08], [35.63, 34.08],
        ],
      },
    },
    {
      // Nahr el-Awali: Shouf highlands → Mediterranean near Jiyeh
      type: "Feature",
      properties: { name: "Nahr el-Awali" },
      geometry: {
        type: "LineString",
        coordinates: [
          [35.70, 33.67], [35.65, 33.64], [35.59, 33.61],
          [35.55, 33.59], [35.49, 33.57], [35.46, 33.56],
          [35.40, 33.57], [35.33, 33.59],
        ],
      },
    },
    {
      // Nahr Beirut: Mt Lebanon foothills → Beirut coast
      type: "Feature",
      properties: { name: "Nahr Beirut" },
      geometry: {
        type: "LineString",
        coordinates: [
          [35.73, 33.85], [35.67, 33.84], [35.61, 33.84],
          [35.56, 33.86], [35.54, 33.90], [35.49, 33.91],
        ],
      },
    },
    {
      // Nahr el-Kebir: Akkar mountains → Mediterranean (Lebanon/Syria border)
      type: "Feature",
      properties: { name: "Nahr el-Kebir" },
      geometry: {
        type: "LineString",
        coordinates: [
          [36.35, 34.56], [36.22, 34.59], [36.10, 34.65], [35.99, 34.69],
        ],
      },
    },
  ],
};

/** Blue Line — the Lebanon–Israel ceasefire boundary */
export const frontLines: FeatureCollection<LineString> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Blue Line", status: "active" },
      geometry: {
        type: "LineString",
        coordinates: [
          [35.108, 33.093],
          [35.220, 33.068],
          [35.350, 33.058],
          [35.480, 33.060],
          [35.620, 33.127],
          [35.760, 33.218],
          [35.870, 33.270],
        ],
      },
    },
  ],
};

export interface ZoneProperties {
  name: string;
  faction: "idf" | "hezbollah";
  color: string;
  opacity: number;
}

/**
 * Territory control zones for South Lebanon.
 * Boundaries approximated from:
 *  - Blue Line (UN-demarcated Lebanon–Israel ceasefire line)
 *  - Litani River (simplified lower course)
 *  - Mediterranean coastline
 *  - Lebanon–Syria/Israel border (east)
 */
export const territoryZones: FeatureCollection<Polygon, ZoneProperties> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        name: "IDF Buffer Zone",
        faction: "idf",
        color: "#dc2626",
        opacity: 0.22,
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          // South edge — Blue Line (west → east)
          [35.108, 33.093],
          [35.220, 33.068],
          [35.350, 33.058],
          [35.480, 33.060],
          [35.620, 33.127],
          [35.760, 33.218],
          [35.870, 33.270],
          // East border north to buffer edge
          [35.870, 33.315],
          // North edge — ~5 km north of Blue Line (east → west)
          [35.770, 33.258],
          [35.640, 33.167],
          [35.500, 33.100],
          [35.370, 33.098],
          [35.240, 33.108],
          [35.115, 33.130],
          // West coast south back to Naqoura
          [35.108, 33.093],
        ]],
      },
    },
    {
      type: "Feature",
      properties: {
        name: "South Lebanon (Hezbollah)",
        faction: "hezbollah",
        color: "#f59e0b",
        opacity: 0.15,
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          // South edge — IDF buffer north edge (west → east)
          [35.115, 33.130],
          [35.240, 33.108],
          [35.370, 33.098],
          [35.500, 33.100],
          [35.640, 33.167],
          [35.770, 33.258],
          [35.870, 33.315],
          // East border north to Litani east end
          [35.870, 33.432],
          // North edge — simplified lower Litani River (east → west)
          [35.750, 33.432],
          [35.660, 33.405],
          [35.590, 33.378],
          [35.500, 33.390],
          [35.400, 33.395],
          [35.320, 33.370],
          [35.243, 33.337],
          // West coast — Litani mouth south to IDF buffer edge
          [35.210, 33.310],
          [35.180, 33.278],
          [35.150, 33.228],
          [35.125, 33.175],
          [35.115, 33.130],
        ]],
      },
    },
  ],
};
