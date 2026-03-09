export type NATOUnitType =
  | "infantry" | "armor" | "artillery" | "mechanized" | "hq"
  | "fighter" | "helicopter" | "warship" | "submarine";

export interface PlacedUnit {
  id: string;
  unitType: NATOUnitType;
  color: string;           // hex
  label: string;
  glow: boolean;
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
