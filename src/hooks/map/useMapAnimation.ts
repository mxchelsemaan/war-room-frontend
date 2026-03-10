import { useEffect, useRef } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type { LayerVisibility } from "@/components/atlas/MapLayerControls";
import { RIVER_DASH_SEQ } from "./useRiverLayers";

export function useMapAnimation(
  mapRef: React.RefObject<MapRef | null>,
  layersRef: React.RefObject<LayerVisibility>,
  mapLoaded: boolean,
) {
  const animRef   = useRef<number | null>(null);
  const riverStep = useRef(0);
  const lastRiver = useRef(0);
  const lastGlow  = useRef(0);
  const lastSky   = useRef(0);
  const lastPulse = useRef(0);

  useEffect(() => {
    if (!mapLoaded) return;

    function frame(ts: number) {
      const m = mapRef.current?.getMap();
      if (!m) { animRef.current = requestAnimationFrame(frame); return; }

      // River dash animation
      if (layersRef.current.rivers && ts - lastRiver.current > 80) {
        riverStep.current = (riverStep.current + 1) % RIVER_DASH_SEQ.length;
        const dash = RIVER_DASH_SEQ[riverStep.current];
        if (m.getLayer("river-flow"))     m.setPaintProperty("river-flow",     "line-dasharray", dash);
        if (m.getLayer("river-geo-flow")) m.setPaintProperty("river-geo-flow", "line-dasharray", dash);
        lastRiver.current = ts;
      }

      // Glow pulse animation (~30fps)
      if (ts - lastGlow.current > 33) {
        const glowT = Math.sin((ts / 1250) * Math.PI) * 0.5 + 0.5;
        if (layersRef.current.territory) {
          if (m.getLayer("tz-glow-outer")) m.setPaintProperty("tz-glow-outer", "line-opacity", 0.016 + glowT * 0.078);
          if (m.getLayer("tz-glow-inner")) m.setPaintProperty("tz-glow-inner", "line-opacity", 0.078 + glowT * 0.138);
        }
        if (layersRef.current.frontLines) {
          if (m.getLayer("fl-glow-outer")) m.setPaintProperty("fl-glow-outer", "line-opacity", 0.020 + glowT * 0.086);
          if (m.getLayer("fl-glow-inner")) m.setPaintProperty("fl-glow-inner", "line-opacity", 0.149 + glowT * 0.204);
        }
        lastGlow.current = ts;
      }

      // Event pulse animation — expanding ring (~30fps)
      // Uses symbol layer icon-size + icon-opacity (works on 3D terrain)
      if (ts - lastPulse.current > 33) {
        const t = (ts % 2000) / 2000;          // sawtooth 0→1 every 2s
        const zoom = m.getZoom();
        const zoomFade = zoom < 8 ? 1 : zoom > 12 ? 0 : 1 - (zoom - 8) / 4;
        if (m.getLayer("event-pulse")) {
          // ring image is 128px; scale so visual radius goes from ~6px to ~26px
          const iconSize = (6 + t * 20) / 64;  // 64 = half of 128px ring image
          m.setLayoutProperty("event-pulse", "icon-size", iconSize);
          m.setPaintProperty("event-pulse", "icon-opacity", (1 - t) * 0.8 * zoomFade);
        }
        lastPulse.current = ts;
      }

      // Sky cloud shimmer
      if (layersRef.current.terrain && ts - lastSky.current > 160) {
        const s1 = Math.sin((ts / 18000) * Math.PI * 2);
        const s2 = Math.sin((ts /  7300) * Math.PI * 2 + 1.4);
        const drift = (s1 * 0.6 + s2 * 0.4) * 0.5 + 0.5;
        const atmo = 0.38 + drift * 0.14;
        const hBright = Math.round(210 + drift * 12);
        const hColor = `rgb(${hBright},${Math.round(hBright * 0.98)},${Math.round(hBright * 0.96)})`;
        m.setSky({
          "sky-color":        "#9ab5c8",
          "horizon-color":    hColor,
          "fog-color":        "#cbbf9e",
          "fog-ground-blend": 0.22,
          "horizon-fog-blend":0.45,
          "sky-horizon-blend":0.38,
          "atmosphere-blend": atmo,
        });
        lastSky.current = ts;
      }

      animRef.current = requestAnimationFrame(frame);
    }

    animRef.current = requestAnimationFrame(frame);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps
}
