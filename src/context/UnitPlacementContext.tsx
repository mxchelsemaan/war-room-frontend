import { createContext, useContext, useMemo } from "react";
import { useUnitPlacement } from "@/hooks/useUnitPlacement";
import type { UseUnitPlacementResult } from "@/hooks/useUnitPlacement";

const UnitPlacementCtx = createContext<UseUnitPlacementResult | null>(null);

export function useUnitPlacementContext() {
  const ctx = useContext(UnitPlacementCtx);
  if (!ctx) throw new Error("useUnitPlacementContext must be used within UnitPlacementProvider");
  return ctx;
}

export function UnitPlacementProvider({ children }: { children: React.ReactNode }) {
  const up = useUnitPlacement();

  const value = useMemo<UseUnitPlacementResult>(() => ({
    units: up.units,
    paths: up.paths,
    placementMode: up.placementMode,
    pendingColor: up.pendingColor,
    pathDrawingUnitId: up.pathDrawingUnitId,
    tempPathCoords: up.tempPathCoords,
    rotatingUnitId: up.rotatingUnitId,
    startPlacement: up.startPlacement,
    cancelPlacement: up.cancelPlacement,
    placeUnit: up.placeUnit,
    setPendingColor: up.setPendingColor,
    updateUnit: up.updateUnit,
    deleteUnit: up.deleteUnit,
    reorderUnit: up.reorderUnit,
    startPathDrawing: up.startPathDrawing,
    addWaypoint: up.addWaypoint,
    finishPathDrawing: up.finishPathDrawing,
    cancelPathDrawing: up.cancelPathDrawing,
    deletePath: up.deletePath,
    startRotation: up.startRotation,
    stopRotation: up.stopRotation,
    rotateUnitToward: up.rotateUnitToward,
  }), [
    up.units, up.paths, up.placementMode, up.pendingColor,
    up.pathDrawingUnitId, up.tempPathCoords, up.rotatingUnitId,
    up.startPlacement, up.cancelPlacement, up.placeUnit,
    up.setPendingColor, up.updateUnit, up.deleteUnit, up.reorderUnit,
    up.startPathDrawing, up.addWaypoint, up.finishPathDrawing,
    up.cancelPathDrawing, up.deletePath,
    up.startRotation, up.stopRotation, up.rotateUnitToward,
  ]);

  return (
    <UnitPlacementCtx.Provider value={value}>
      {children}
    </UnitPlacementCtx.Provider>
  );
}
