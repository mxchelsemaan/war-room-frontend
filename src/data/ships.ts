// Port of Beirut: 33.9006°N, 35.5183°E
// Port of Tripoli: 34.4479°N, 35.8371°E
// Port of Sidon: 33.5570°N, 35.3674°E

export interface ShipSpec {
  id: string;
  name: string;           // vessel name
  type: "cargo" | "tanker" | "naval" | "patrol";
  flag: string;           // flag emoji + country code
  color: string;
  description: string;    // e.g. "Inbound to Port of Beirut"
  route: [number, number][];  // [lng, lat] waypoints — must stay in water
  loopMs: number;
  startOffset: number;
}

// ── Routes (all in Mediterranean, west of Lebanese coast) ────────────────────

// Cargo: approaching Beirut from the west
const CARGO_BEIRUT_INBOUND: [number, number][] = [
  [34.200, 34.100],   // open sea W
  [34.500, 34.050],
  [34.800, 33.980],
  [35.050, 33.950],
  [35.250, 33.920],
  [35.400, 33.910],
  [35.518, 33.901],   // Port of Beirut
];

// Tanker: Tripoli → south along coast offshore
const TANKER_COAST_SOUTH: [number, number][] = [
  [35.700, 34.500],   // off Tripoli
  [35.550, 34.350],
  [35.400, 34.200],
  [35.300, 34.050],
  [35.250, 33.900],
  [35.200, 33.750],
  [35.150, 33.600],
  [35.100, 33.450],   // off Sidon heading south
];

// UNIFIL patrol: east-west patrol line off southern coast
const UNIFIL_PATROL: [number, number][] = [
  [35.000, 33.250],   // west of Naqoura
  [35.050, 33.200],
  [35.120, 33.180],
  [35.200, 33.170],
  [35.280, 33.180],
  [35.350, 33.200],
  [35.280, 33.220],
  [35.200, 33.230],
  [35.120, 33.220],
  [35.050, 33.210],
  [35.000, 33.250],   // loop back
];

// Cargo: departing Beirut heading NW
const CARGO_BEIRUT_OUTBOUND: [number, number][] = [
  [35.518, 33.901],   // Port of Beirut
  [35.400, 33.920],
  [35.200, 33.950],
  [34.900, 34.000],
  [34.600, 34.100],
  [34.200, 34.250],
  [33.700, 34.500],   // open sea NW
];

// Naval vessel: Israeli navy patrol S of Lebanon
const IDF_NAVAL: [number, number][] = [
  [35.100, 33.050],
  [35.000, 33.000],
  [34.900, 32.950],
  [34.800, 33.000],
  [34.750, 33.080],
  [34.800, 33.120],
  [34.900, 33.100],
  [35.000, 33.060],
  [35.100, 33.050],   // loop
];

// Cargo: inbound to Tripoli from NW
const CARGO_TRIPOLI_INBOUND: [number, number][] = [
  [34.500, 35.000],   // open sea NW
  [34.800, 34.800],
  [35.100, 34.650],
  [35.350, 34.550],
  [35.550, 34.480],
  [35.700, 34.460],
  [35.837, 34.448],   // Port of Tripoli
];

// ── Ship specs ──────────────────────────────────────────────────────────────

export const SHIP_SPECS: ShipSpec[] = [
  {
    id: "mv-cedar",
    name: "MV Cedar Star",
    type: "cargo",
    flag: "🇵🇦 PA",
    color: "#22c55e",        // green
    description: "Inbound to Port of Beirut — general cargo",
    route: CARGO_BEIRUT_INBOUND,
    loopMs: 80_000,
    startOffset: 0,
  },
  {
    id: "mt-levant",
    name: "MT Levant Spirit",
    type: "tanker",
    flag: "🇱🇷 LR",
    color: "#f59e0b",        // amber
    description: "Crude oil transit — Tripoli to Sidon offshore",
    route: TANKER_COAST_SOUTH,
    loopMs: 90_000,
    startOffset: 15_000,
  },
  {
    id: "unifil-patrol",
    name: "UNIFIL FPB-01",
    type: "patrol",
    flag: "🇺🇳 UN",
    color: "#3b82f6",        // blue
    description: "UNIFIL maritime patrol — Blue Line enforcement",
    route: UNIFIL_PATROL,
    loopMs: 60_000,
    startOffset: 5_000,
  },
  {
    id: "mv-phoenicia",
    name: "MV Phoenicia",
    type: "cargo",
    flag: "🇲🇹 MT",
    color: "#a855f7",        // purple
    description: "Outbound from Port of Beirut — containers",
    route: CARGO_BEIRUT_OUTBOUND,
    loopMs: 75_000,
    startOffset: 30_000,
  },
  {
    id: "ins-hanit",
    name: "INS Hanit",
    type: "naval",
    flag: "🇮🇱 IL",
    color: "#64748b",        // slate
    description: "IDF Navy — patrol south of Lebanese maritime border",
    route: IDF_NAVAL,
    loopMs: 50_000,
    startOffset: 10_000,
  },
  {
    id: "mv-orient",
    name: "MV Orient Bay",
    type: "cargo",
    flag: "🇹🇷 TR",
    color: "#ef4444",        // red
    description: "Inbound to Port of Tripoli — bulk grain",
    route: CARGO_TRIPOLI_INBOUND,
    loopMs: 85_000,
    startOffset: 40_000,
  },
];
