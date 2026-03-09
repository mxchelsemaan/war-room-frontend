import { useEffect } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import { TERRAIN_CONFIG } from "@/config/map";

export function useTerrainLayer(
  mapRef: React.RefObject<MapRef | null>,
  terrainEnabled: boolean,
  hillshadeEnabled: boolean,
  mapLoaded: boolean,
) {
  // ── Terrain ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (!map.getSource("terrain-dem")) {
      map.addSource("terrain-dem", {
        type: "raster-dem",
        tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
        tileSize: 256, encoding: "terrarium",
      });
    }
    if (terrainEnabled) {
      map.setTerrain({ source: "terrain-dem", exaggeration: TERRAIN_CONFIG.exaggeration });
      map.easeTo({ pitch: TERRAIN_CONFIG.pitch3d, duration: 600 });
      map.setSky({
        "sky-color":        "#9ab5c8",
        "horizon-color":    "#d4dfe6",
        "fog-color":        "#cbbf9e",
        "fog-ground-blend": 0.22,
        "horizon-fog-blend":0.45,
        "sky-horizon-blend":0.38,
        "atmosphere-blend": 0.45,
      });
    } else {
      map.setTerrain(null);
      map.easeTo({ pitch: 0, duration: 600 });
      map.setSky(null as unknown as maplibregl.SkySpecification);
    }
  }, [terrainEnabled, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Terrain camera collision prevention ─────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    function maxZoomForPitch(pitch: number): number {
      if (pitch < 30) return 14;
      if (pitch < 45) return 13;
      if (pitch < 60) return 12;
      if (pitch < 75) return 11;
      return 10;
    }

    function applyZoomLimit() {
      const maxZ = maxZoomForPitch(map!.getPitch());
      map!.setMaxZoom(maxZ);
      if (map!.getZoom() > maxZ) map!.easeTo({ zoom: maxZ, duration: 200 });
    }

    if (terrainEnabled) {
      applyZoomLimit();
      map.on("pitch", applyZoomLimit);
      return () => { map.off("pitch", applyZoomLimit); };
    } else {
      map.setMaxZoom(14);
    }
  }, [terrainEnabled, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Hillshade ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (!map.getSource("hillshade-dem")) {
      map.addSource("hillshade-dem", {
        type: "raster-dem",
        tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
        tileSize: 256, encoding: "terrarium",
      });
    }
    if (!map.getLayer("hillshade-layer")) {
      const firstLayerId = map.getStyle().layers?.[0]?.id;
      map.addLayer({
        id: "hillshade-layer", type: "hillshade", source: "hillshade-dem",
        paint: {
          "hillshade-exaggeration": 0.8,
          "hillshade-illumination-direction": 315,
          "hillshade-shadow-color": "#0a0a1a",
          "hillshade-highlight-color": "#d4c8a0",
          "hillshade-accent-color": "#2a1f0a",
        },
        layout: { visibility: hillshadeEnabled ? "visible" : "none" },
      }, firstLayerId);
    } else {
      map.setLayoutProperty("hillshade-layer", "visibility", hillshadeEnabled ? "visible" : "none");
    }
  }, [hillshadeEnabled, mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps
}
