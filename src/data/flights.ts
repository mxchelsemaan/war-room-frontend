// BEY airport: 33.8209°N, 35.4884°E

export interface FlightSpec {
  id: string;
  callsign: string;       // e.g. "MEA 315"
  airline: string;
  airlineCode: string;
  country: string;        // flag emoji + country code, e.g. "🇱🇧 LB"
  color: string;          // airline brand color
  route: [number, number][];  // [lng, lat] waypoints
  direction: "arrival" | "departure";
  origin: string;         // e.g. "Paris (CDG)"
  destination: string;    // e.g. "Beirut (BEY)"
  loopMs: number;
  startOffset: number;
}

// ── Arrivals ──────────────────────────────────────────────────────────────────

// MEA from Paris — approaching from NW, final approach heading south
const MEA_PARIS_ROUTE: [number, number][] = [
  [34.200, 34.600],  // NW Mediterranean
  [34.700, 34.200],
  [35.050, 34.000],
  [35.250, 33.980],
  [35.380, 33.900],
  [35.450, 33.870],  // final approach
  [35.488, 33.821],  // BEY
];

// Turkish Airlines from Istanbul — from the NE
const TK_IST_ROUTE: [number, number][] = [
  [36.800, 35.400],  // NE Turkey/Syria
  [36.400, 35.100],
  [36.000, 34.800],
  [35.750, 34.550],
  [35.600, 34.300],
  [35.520, 34.100],
  [35.488, 33.821],  // BEY
];

// Emirates from Dubai — from the SE / east
const EK_DXB_ROUTE: [number, number][] = [
  [37.500, 33.200],  // E (inland Syria/Iraq)
  [37.000, 33.500],
  [36.500, 33.700],
  [36.000, 33.800],
  [35.800, 33.820],
  [35.600, 33.822],
  [35.488, 33.821],  // BEY
];

// Lufthansa from Frankfurt — from the W/NW over sea
const LH_FRA_ROUTE: [number, number][] = [
  [33.600, 34.800],  // W Mediterranean
  [34.100, 34.500],
  [34.600, 34.300],
  [35.000, 34.100],
  [35.300, 33.980],
  [35.430, 33.880],
  [35.488, 33.821],  // BEY
];

// ── Departures ────────────────────────────────────────────────────────────────

// MEA to Amman — heading SE
const MEA_AMM_ROUTE: [number, number][] = [
  [35.488, 33.821],  // BEY
  [35.520, 33.700],
  [35.580, 33.520],
  [35.700, 33.300],
  [35.900, 33.050],
  [36.100, 32.800],
  [35.994, 31.723],  // AMM
];

// Qatar Airways to Doha — heading S/SE
const QR_DOH_ROUTE: [number, number][] = [
  [35.488, 33.821],  // BEY
  [35.600, 33.650],
  [35.750, 33.400],
  [35.900, 33.100],
  [36.200, 32.700],
  [36.600, 32.000],
  [51.565, 25.261],  // DOH (simplified — off map, clip naturally)
];

// Aegean to Athens — heading W over Mediterranean
const A3_ATH_ROUTE: [number, number][] = [
  [35.488, 33.821],  // BEY
  [35.200, 33.900],
  [34.700, 34.000],
  [34.100, 34.200],
  [33.400, 34.500],
  [32.500, 34.800],
  [23.944, 37.936],  // ATH (off map)
];

// Royal Jordanian to Amman — heading SSE
const RJ_AMM_ROUTE: [number, number][] = [
  [35.488, 33.821],  // BEY
  [35.510, 33.680],
  [35.560, 33.480],
  [35.640, 33.250],
  [35.780, 32.950],
  [35.900, 32.600],
  [35.994, 31.723],  // AMM
];

// ── Flight specs ──────────────────────────────────────────────────────────────

export const FLIGHT_SPECS: FlightSpec[] = [
  {
    id: "mea-315",
    callsign: "MEA 315",
    airline: "Middle East Airlines",
    airlineCode: "MEA",
    country: "🇱🇧 LB",
    color: "#16a34a",        // MEA green
    route: MEA_PARIS_ROUTE,
    direction: "arrival",
    origin: "Paris (CDG)",
    destination: "Beirut (BEY)",
    loopMs: 28_000,
    startOffset: 0,
  },
  {
    id: "tk-782",
    callsign: "TK 782",
    airline: "Turkish Airlines",
    airlineCode: "THY",
    country: "🇹🇷 TR",
    color: "#dc2626",        // Turkish red
    route: TK_IST_ROUTE,
    direction: "arrival",
    origin: "Istanbul (IST)",
    destination: "Beirut (BEY)",
    loopMs: 32_000,
    startOffset: 8_000,
  },
  {
    id: "ek-427",
    callsign: "EK 427",
    airline: "Emirates",
    airlineCode: "UAE",
    country: "🇦🇪 AE",
    color: "#d97706",        // Emirates gold
    route: EK_DXB_ROUTE,
    direction: "arrival",
    origin: "Dubai (DXB)",
    destination: "Beirut (BEY)",
    loopMs: 26_000,
    startOffset: 14_000,
  },
  {
    id: "lh-1301",
    callsign: "LH 1301",
    airline: "Lufthansa",
    airlineCode: "DLH",
    country: "🇩🇪 DE",
    color: "#2563eb",        // Lufthansa blue
    route: LH_FRA_ROUTE,
    direction: "arrival",
    origin: "Frankfurt (FRA)",
    destination: "Beirut (BEY)",
    loopMs: 30_000,
    startOffset: 5_000,
  },
  {
    id: "mea-204",
    callsign: "MEA 204",
    airline: "Middle East Airlines",
    airlineCode: "MEA",
    country: "🇱🇧 LB",
    color: "#16a34a",
    route: MEA_AMM_ROUTE,
    direction: "departure",
    origin: "Beirut (BEY)",
    destination: "Amman (AMM)",
    loopMs: 24_000,
    startOffset: 3_000,
  },
  {
    id: "qr-441",
    callsign: "QR 441",
    airline: "Qatar Airways",
    airlineCode: "QTR",
    country: "🇶🇦 QA",
    color: "#7c3aed",        // Qatar purple
    route: QR_DOH_ROUTE,
    direction: "departure",
    origin: "Beirut (BEY)",
    destination: "Doha (DOH)",
    loopMs: 22_000,
    startOffset: 11_000,
  },
  {
    id: "a3-930",
    callsign: "A3 930",
    airline: "Aegean Airlines",
    airlineCode: "AEE",
    country: "🇬🇷 GR",
    color: "#0891b2",        // Aegean cyan
    route: A3_ATH_ROUTE,
    direction: "departure",
    origin: "Beirut (BEY)",
    destination: "Athens (ATH)",
    loopMs: 25_000,
    startOffset: 18_000,
  },
  {
    id: "rj-112",
    callsign: "RJ 112",
    airline: "Royal Jordanian",
    airlineCode: "RJA",
    country: "🇯🇴 JO",
    color: "#b45309",        // Royal Jordanian gold
    route: RJ_AMM_ROUTE,
    direction: "departure",
    origin: "Beirut (BEY)",
    destination: "Amman (AMM)",
    loopMs: 20_000,
    startOffset: 7_000,
  },
];
