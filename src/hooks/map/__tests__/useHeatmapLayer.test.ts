import { describe, it, expect } from "vitest";
import { severityToWeight } from "../useHeatmapLayer";

describe("severityToWeight", () => {
  it("maps critical to 1.0", () => {
    expect(severityToWeight("critical")).toBe(1.0);
  });

  it("maps major to 0.7", () => {
    expect(severityToWeight("major")).toBe(0.7);
  });

  it("maps moderate to 0.4", () => {
    expect(severityToWeight("moderate")).toBe(0.4);
  });

  it("maps minor to 0.15", () => {
    expect(severityToWeight("minor")).toBe(0.15);
  });

  it("defaults to 0.3 for unknown severity", () => {
    expect(severityToWeight("unknown")).toBe(0.3);
  });

  it("defaults to 0.3 for undefined", () => {
    expect(severityToWeight(undefined)).toBe(0.3);
  });
});
