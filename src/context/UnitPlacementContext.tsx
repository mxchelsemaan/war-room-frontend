import { createContext, useContext } from "react";
import { useUnitPlacement } from "@/hooks/useUnitPlacement";
import type { UseUnitPlacementResult } from "@/hooks/useUnitPlacement";

const UnitPlacementCtx = createContext<UseUnitPlacementResult | null>(null);

export function useUnitPlacementContext() {
  const ctx = useContext(UnitPlacementCtx);
  if (!ctx) throw new Error("useUnitPlacementContext must be used within UnitPlacementProvider");
  return ctx;
}

export function UnitPlacementProvider({ children }: { children: React.ReactNode }) {
  const unitPlacement = useUnitPlacement();

  return (
    <UnitPlacementCtx.Provider value={unitPlacement}>
      {children}
    </UnitPlacementCtx.Provider>
  );
}
