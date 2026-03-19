import { describe, it, expect, vi, beforeEach } from "vitest";

const insertMock = vi.fn().mockResolvedValue({ error: null });
const fromMock = vi.fn(() => ({ insert: insertMock }));

vi.mock("../supabase", () => ({
  supabase: { from: fromMock },
}));

// Must import after mock setup
const { track } = await import("../analytics");

describe("track", () => {
  beforeEach(() => {
    fromMock.mockClear();
    insertMock.mockClear();
  });

  it("inserts an analytics event into supabase", () => {
    track("page_view", { path: "/" });

    expect(fromMock).toHaveBeenCalledWith("analytics");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "page_view",
        metadata: { path: "/" },
        session_id: expect.any(String),
      }),
    );
  });

  it("uses empty metadata when none provided", () => {
    track("panel_toggled");

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "panel_toggled",
        metadata: {},
      }),
    );
  });

  it("reuses the same session_id across calls", () => {
    track("a");
    track("b");

    const id1 = insertMock.mock.calls[0][0].session_id;
    const id2 = insertMock.mock.calls[1][0].session_id;
    expect(id1).toBe(id2);
  });
});
