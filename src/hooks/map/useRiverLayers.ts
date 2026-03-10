import { useEffect } from "react";
import type { MapRef } from "react-map-gl/maplibre";

// River shimmer — animated dasharray sequence
export const RIVER_DASH_SEQ = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5],
  [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
  [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5],
  [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5],
];

export function useRiverLayers(
  mapRef: React.RefObject<MapRef | null>,
  riversEnabled: boolean,
  mapLoaded: number | boolean,
) {
  // ── Vector-tile rivers ──────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    const vtSrcId = Object.entries(map.getStyle().sources ?? {}).find(([, s]) => s.type === "vector")?.[0];
    if (!vtSrcId || map.getLayer("river-glow")) return;
    const rv = riversEnabled ? "visible" : "none";
    map.addLayer({ id: "river-glow", type: "line", source: vtSrcId, "source-layer": "waterway", minzoom: 9,
      layout: { visibility: rv, "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#0c3d6b", "line-width": ["interpolate", ["linear"], ["zoom"], 9, 6, 12, 12], "line-opacity": 0.6, "line-blur": 3 } });
    map.addLayer({ id: "river-main", type: "line", source: vtSrcId, "source-layer": "waterway", minzoom: 9,
      layout: { visibility: rv, "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#38bdf8", "line-width": ["interpolate", ["linear"], ["zoom"], 9, 2, 12, 5], "line-opacity": 0.85 } });
    map.addLayer({ id: "river-flow", type: "line", source: vtSrcId, "source-layer": "waterway", minzoom: 9,
      layout: { visibility: rv, "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#bae6fd", "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1, 12, 3], "line-opacity": 0.6, "line-dasharray": RIVER_DASH_SEQ[0] } });
    map.addLayer({ id: "river-vt-label", type: "symbol", source: vtSrcId, "source-layer": "waterway", minzoom: 9,
      layout: {
        visibility: rv,
        "symbol-placement": "line",
        "text-field": ["coalesce", ["get", "name_en"], ["get", "name"]],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 9, 10, 12, 13],
        "text-max-angle": 30,
        "text-letter-spacing": 0.06,
        "text-offset": [0, -1],
        "symbol-spacing": 200,
      },
      paint: { "text-color": "#7dd3fc", "text-halo-color": "#060e1a", "text-halo-width": 1.5, "text-opacity": 0.9 } });
  }, [mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── VT river visibility ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    const vis = riversEnabled ? "visible" : "none";
    if (map.getLayer("river-glow"))     map.setLayoutProperty("river-glow",     "visibility", vis);
    if (map.getLayer("river-main"))     map.setLayoutProperty("river-main",     "visibility", vis);
    if (map.getLayer("river-flow"))     map.setLayoutProperty("river-flow",     "visibility", vis);
    if (map.getLayer("river-vt-label")) map.setLayoutProperty("river-vt-label", "visibility", vis);
  }, [riversEnabled, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps
}
