import { useEffect } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type { LayerVisibility } from "@/components/atlas/MapLayerControls";

export function useKeyboardCamera(
  mapRef: React.RefObject<MapRef | null>,
  layersRef: React.RefObject<LayerVisibility>,
) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      const map = mapRef.current?.getMap();
      if (!map) return;

      const fine = e.shiftKey;
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          map.easeTo({ bearing: map.getBearing() - (fine ? 5 : 15), duration: 200 });
          break;
        case "ArrowRight":
          e.preventDefault();
          map.easeTo({ bearing: map.getBearing() + (fine ? 5 : 15), duration: 200 });
          break;
        case "ArrowUp":
          e.preventDefault();
          map.easeTo({ pitch: Math.min(85, map.getPitch() + (fine ? 5 : 10)), duration: 200 });
          break;
        case "ArrowDown":
          e.preventDefault();
          map.easeTo({ pitch: Math.max(0, map.getPitch() - (fine ? 5 : 10)), duration: 200 });
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
