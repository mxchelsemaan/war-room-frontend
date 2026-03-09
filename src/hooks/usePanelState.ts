import { useCallback, useState } from "react";

export type PanelId = "filter" | "feed" | "layers" | "legend" | "draw" | "briefing" | "timeline";

export function usePanelState(initial: PanelId[] = []) {
  const [openPanels, setOpenPanels] = useState<Set<PanelId>>(() => new Set(initial));

  const isPanelOpen = useCallback(
    (id: PanelId) => openPanels.has(id),
    [openPanels],
  );

  const togglePanel = useCallback((id: PanelId) => {
    setOpenPanels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setPanelOpen = useCallback((id: PanelId, open: boolean) => {
    setOpenPanels((prev) => {
      const next = new Set(prev);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  return { openPanels, isPanelOpen, togglePanel, setPanelOpen };
}
