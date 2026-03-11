import { describe, it, expect } from "vitest";
import { isThreatAlert } from "../threatUtils";

describe("isThreatAlert", () => {
  it("matches dedicated threat type: evacuation_warning", () => {
    expect(isThreatAlert({ eventType: "evacuation_warning" })).toBe(true);
  });

  it("matches dedicated threat type: israeli_evacuation_order", () => {
    expect(isThreatAlert({ eventType: "israeli_evacuation_order" })).toBe(true);
  });

  it("matches cross-cutting: evacuation + attacker Israel", () => {
    expect(
      isThreatAlert({ eventType: "evacuation", attacker: "Israel" }),
    ).toBe(true);
  });

  it("matches cross-cutting: civil_defense_warning + attacker IDF", () => {
    expect(
      isThreatAlert({ eventType: "civil_defense_warning", attacker: "IDF" }),
    ).toBe(true);
  });

  it("matches cross-cutting: civil_defense_update + attacker Israeli Forces", () => {
    expect(
      isThreatAlert({
        eventType: "civil_defense_update",
        attacker: "Israeli Forces",
      }),
    ).toBe(true);
  });

  it("does NOT match airstrike + attacker Israel (not a context type)", () => {
    expect(
      isThreatAlert({ eventType: "airstrike", attacker: "Israel" }),
    ).toBe(false);
  });

  it("returns false when attacker is null", () => {
    expect(isThreatAlert({ eventType: "evacuation", attacker: null })).toBe(
      false,
    );
  });

  it("returns false when attacker is undefined", () => {
    expect(isThreatAlert({ eventType: "evacuation" })).toBe(false);
  });

  it("handles case-insensitive attacker matching", () => {
    expect(
      isThreatAlert({ eventType: "evacuation", attacker: "ISRAEL" }),
    ).toBe(true);
    expect(
      isThreatAlert({ eventType: "evacuation", attacker: "  idf  " }),
    ).toBe(true);
  });

  it("returns false for unknown event type without attacker", () => {
    expect(isThreatAlert({ eventType: "unknown_type" })).toBe(false);
  });
});
