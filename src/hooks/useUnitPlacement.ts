import { useCallback, useEffect, useRef, useState } from "react";
import type { PlacedUnit, UnitPath, NATOUnitType } from "@/types/units";
import { DRAW_COLOR_PRESETS } from "@/hooks/useDrawing";

const DEFAULT_LOOP_MS = 30_000;

let unitCounter = 0;

const UNIT_LABELS: Record<NATOUnitType, string> = {
  infantry: "Infantry",
  armor: "Armor",
  artillery: "Artillery",
  mechanized: "Mechanized",
  hq: "HQ",
};

export interface UseUnitPlacementResult {
  units: PlacedUnit[];
  paths: UnitPath[];
  placementMode: NATOUnitType | null;
  pendingColor: string;
  pathDrawingUnitId: string | null;
  tempPathCoords: [number, number][];

  startPlacement: (type: NATOUnitType) => void;
  cancelPlacement: () => void;
  placeUnit: (lngLat: [number, number]) => void;

  setPendingColor: (color: string) => void;
  updateUnit: (id: string, changes: Partial<Pick<PlacedUnit, "label" | "color" | "glow" | "animating" | "loopMs">>) => void;
  deleteUnit: (id: string) => void;

  startPathDrawing: (unitId: string) => void;
  addWaypoint: (lngLat: [number, number]) => void;
  finishPathDrawing: () => void;
  cancelPathDrawing: () => void;
  deletePath: (unitId: string) => void;
}

export function useUnitPlacement(): UseUnitPlacementResult {
  const [units, setUnits] = useState<PlacedUnit[]>([]);
  const [paths, setPaths] = useState<UnitPath[]>([]);
  const [placementMode, setPlacementMode] = useState<NATOUnitType | null>(null);
  const [pendingColor, setPendingColor] = useState<string>(DRAW_COLOR_PRESETS[0]);
  const [pathDrawingUnitId, setPathDrawingUnitId] = useState<string | null>(null);
  const [tempPathCoords, setTempPathCoords] = useState<[number, number][]>([]);

  const placementModeRef = useRef(placementMode);
  placementModeRef.current = placementMode;
  const pendingColorRef = useRef(pendingColor);
  pendingColorRef.current = pendingColor;
  const pathDrawingUnitIdRef = useRef(pathDrawingUnitId);
  pathDrawingUnitIdRef.current = pathDrawingUnitId;
  const tempPathCoordsRef = useRef(tempPathCoords);
  tempPathCoordsRef.current = tempPathCoords;
  const unitsRef = useRef(units);
  unitsRef.current = units;

  const startPlacement = useCallback((type: NATOUnitType) => {
    setPlacementMode(type);
    setPathDrawingUnitId(null);
    setTempPathCoords([]);
  }, []);

  const cancelPlacement = useCallback(() => {
    setPlacementMode(null);
  }, []);

  const placeUnit = useCallback((lngLat: [number, number]) => {
    const type = placementModeRef.current;
    if (!type) return;
    unitCounter += 1;
    const newUnit: PlacedUnit = {
      id: crypto.randomUUID(),
      unitType: type,
      color: pendingColorRef.current,
      label: `${UNIT_LABELS[type]} ${unitCounter}`,
      glow: false,
      position: lngLat,
      pathId: null,
      loopMs: DEFAULT_LOOP_MS,
      animating: false,
    };
    setUnits(prev => [...prev, newUnit]);
    setPlacementMode(null);
  }, []);

  const updateUnit = useCallback((id: string, changes: Partial<Pick<PlacedUnit, "label" | "color" | "glow" | "animating" | "loopMs">>) => {
    setUnits(prev => prev.map(u => u.id === id ? { ...u, ...changes } : u));
  }, []);

  const deleteUnit = useCallback((id: string) => {
    setUnits(prev => {
      const unit = prev.find(u => u.id === id);
      if (unit?.pathId) {
        setPaths(pp => pp.filter(p => p.id !== unit.pathId));
      }
      return prev.filter(u => u.id !== id);
    });
  }, []);

  const startPathDrawing = useCallback((unitId: string) => {
    setPathDrawingUnitId(unitId);
    setPlacementMode(null);
    setTempPathCoords([]);
  }, []);

  const addWaypoint = useCallback((lngLat: [number, number]) => {
    setTempPathCoords(prev => [...prev, lngLat]);
  }, []);

  const finishPathDrawing = useCallback(() => {
    const unitId = pathDrawingUnitIdRef.current;
    const coords = tempPathCoordsRef.current;
    if (!unitId || coords.length < 2) {
      setPathDrawingUnitId(null);
      setTempPathCoords([]);
      return;
    }

    // Get unit color for path
    const unit = unitsRef.current.find(u => u.id === unitId);
    const color = unit?.color ?? "#ef4444";

    const pathId = crypto.randomUUID();
    const newPath: UnitPath = { id: pathId, coordinates: coords, color };

    setPaths(prev => {
      // Remove old path for this unit if any
      const oldPathId = unit?.pathId;
      return [...prev.filter(p => p.id !== oldPathId), newPath];
    });
    setUnits(prev => prev.map(u => u.id === unitId ? { ...u, pathId, animating: false } : u));
    setPathDrawingUnitId(null);
    setTempPathCoords([]);
  }, []);

  const cancelPathDrawing = useCallback(() => {
    setPathDrawingUnitId(null);
    setTempPathCoords([]);
  }, []);

  const deletePath = useCallback((unitId: string) => {
    setUnits(prev => {
      const unit = prev.find(u => u.id === unitId);
      if (unit?.pathId) {
        setPaths(pp => pp.filter(p => p.id !== unit.pathId));
      }
      return prev.map(u => u.id === unitId ? { ...u, pathId: null, animating: false } : u);
    });
  }, []);

  // Esc key: cancel active mode
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (placementModeRef.current) {
        setPlacementMode(null);
      } else if (pathDrawingUnitIdRef.current) {
        // If we have at least 2 waypoints, finish; otherwise cancel
        const coords = tempPathCoordsRef.current;
        if (coords.length >= 2) {
          finishPathDrawing();
        } else {
          setPathDrawingUnitId(null);
          setTempPathCoords([]);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [finishPathDrawing]);

  return {
    units, paths, placementMode, pendingColor, pathDrawingUnitId, tempPathCoords,
    startPlacement, cancelPlacement, placeUnit,
    setPendingColor, updateUnit, deleteUnit,
    startPathDrawing, addWaypoint, finishPathDrawing, cancelPathDrawing, deletePath,
  };
}
