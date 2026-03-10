import { describe, it, expect } from "vitest";
import { useClusterLayer } from "../useClusterLayer";

describe("useClusterLayer", () => {
  it("should be a function", () => {
    expect(typeof useClusterLayer).toBe("function");
  });
});
