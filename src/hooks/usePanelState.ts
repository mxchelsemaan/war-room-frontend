import { useCallback, useState } from "react";

export type PanelId = "filter" | "feed" | "layers" | "legend" | "draw" | "briefing" | "timeline" | "items" | "camera" | "youtube";

/** Floating map-control panels that should be mutually exclusive */
const FLOATING_PANELS: Set<PanelId> = new Set(["layers", "draw", "camera", "legend"]);

export function usePanelState(initial: PanelId[] = []) {
  const [openPanels, setOpenPanels] = useState<Set<PanelId>>(() => new Set(initial));

  const isPanelOpen = useCallback(
    (id: PanelId) => openPanels.has(id),
    [openPanels],
  );

  const togglePanel = useCallback((id: PanelId) => {
    setOpenPanels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        // Close other floating panels when opening one
        if (FLOATING_PANELS.has(id)) {
          for (const fp of FLOATING_PANELS) {
            if (fp !== id) next.delete(fp);
          }
        }
        next.add(id);
      }
      return next;
    });
  }, []);

  const setPanelOpen = useCallback((id: PanelId, open: boolean) => {
    setOpenPanels((prev) => {
      const next = new Set(prev);
      if (open) {
        if (FLOATING_PANELS.has(id)) {
          for (const fp of FLOATING_PANELS) {
            if (fp !== id) next.delete(fp);
          }
        }
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  /** Close all floating map-control panels (e.g. on map click) */
  const closeFloatingPanels = useCallback(() => {
    setOpenPanels((prev) => {
      let changed = false;
      for (const fp of FLOATING_PANELS) {
        if (prev.has(fp)) { changed = true; break; }
      }
      if (!changed) return prev;
      const next = new Set(prev);
      for (const fp of FLOATING_PANELS) next.delete(fp);
      return next;
    });
  }, []);

  return { openPanels, isPanelOpen, togglePanel, setPanelOpen, closeFloatingPanels };
}
