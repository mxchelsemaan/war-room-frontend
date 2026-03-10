import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClusterPopup } from "../ClusterPopup";
import type { ClusterPopupData } from "../ClusterPopup";

// Mock react-map-gl Popup
vi.mock("react-map-gl/maplibre", () => ({
  Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="popup">{children}</div>,
}));

const mockData: ClusterPopupData = {
  lngLat: [35.5, 33.9],
  events: [
    {
      id: "1",
      event_type: "airstrike",
      event_icon: "💥",
      event_label: "Airstrike near Beirut",
      event_location: { name: "Beirut", lat: 33.9, lng: 35.5 },
      event_count: 1,
      date: "2026-03-10",
      severity: "critical",
    },
    {
      id: "2",
      event_type: "explosion",
      event_icon: "🔥",
      event_label: "Explosion reported",
      event_location: { name: "Beirut", lat: 33.91, lng: 35.51 },
      event_count: 1,
      date: "2026-03-09",
    },
  ],
};

describe("ClusterPopup", () => {
  it("renders event count and event labels", () => {
    render(
      <ClusterPopup
        data={mockData}
        onClose={vi.fn()}
        onSelectEvent={vi.fn()}
      />,
    );

    expect(screen.getByText("2 events in this area")).toBeTruthy();
    expect(screen.getByText("Airstrike near Beirut")).toBeTruthy();
    expect(screen.getByText("Explosion reported")).toBeTruthy();
  });
});
