import { describe, it, expect } from "vitest";
import { frontLines, territoryZones } from "@/data/overlays";

describe("frontLines", () => {
  it("is a valid GeoJSON FeatureCollection", () => {
    expect(frontLines.type).toBe("FeatureCollection");
    expect(Array.isArray(frontLines.features)).toBe(true);
  });

  it("has at least one LineString feature", () => {
    expect(frontLines.features.length).toBeGreaterThan(0);
    frontLines.features.forEach((f) => {
      expect(f.geometry.type).toBe("LineString");
      expect(f.geometry.coordinates.length).toBeGreaterThan(1);
    });
  });

  it("Blue Line feature has required properties", () => {
    const blue = frontLines.features.find((f) => f.properties?.name === "Blue Line");
    expect(blue).toBeDefined();
    expect(blue!.properties!.status).toBe("active");
  });

  it("all coordinates are within Lebanon bounding box", () => {
    // Lebanon rough bbox: lon 35.1–36.6, lat 33.0–34.7
    frontLines.features.forEach((f) => {
      f.geometry.coordinates.forEach(([lon, lat]) => {
        expect(lon).toBeGreaterThanOrEqual(35.0);
        expect(lon).toBeLessThanOrEqual(36.7);
        expect(lat).toBeGreaterThanOrEqual(33.0);
        expect(lat).toBeLessThanOrEqual(34.7);
      });
    });
  });
});

describe("territoryZones", () => {
  it("is a valid GeoJSON FeatureCollection", () => {
    expect(territoryZones.type).toBe("FeatureCollection");
    expect(territoryZones.features.length).toBeGreaterThan(0);
  });

  it("all features are Polygons", () => {
    territoryZones.features.forEach((f) => {
      expect(f.geometry.type).toBe("Polygon");
    });
  });

  it("each zone has required faction properties", () => {
    const factions = new Set(territoryZones.features.map((f) => f.properties.faction));
    expect(factions.has("idf")).toBe(true);
    expect(factions.has("hezbollah")).toBe(true);
    expect(factions.has("idf") || factions.has("hezbollah")).toBe(true);
  });

  it("each zone has a valid hex color", () => {
    territoryZones.features.forEach((f) => {
      expect(f.properties.color).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  it("each zone has opacity between 0 and 1", () => {
    territoryZones.features.forEach((f) => {
      expect(f.properties.opacity).toBeGreaterThan(0);
      expect(f.properties.opacity).toBeLessThanOrEqual(1);
    });
  });
});
