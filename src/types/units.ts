export type NATOUnitType =
  | "infantry" | "armor" | "artillery" | "mechanized" | "hq"
  | "fighter" | "helicopter" | "warship" | "submarine";

export type UnitEffect = "none" | "glow" | "hover";

export interface PlacedUnit {
  id: string;
  unitType: NATOUnitType;
  color: string;           // hex
  label: string;
  effect: UnitEffect;       // "none" | "glow" | "hover"
  bearing: number;           // 0–360 degrees, default 0
  target: boolean;           // red inverted triangle indicator
  groundCircle: boolean;     // circle on map surface
  position: [number, number]; // [lng, lat]
  pathId: string | null;
  loopMs: number;           // default 30000
  animating: boolean;
}

export interface UnitPath {
  id: string;
  coordinates: [number, number][];
  color: string;
}
