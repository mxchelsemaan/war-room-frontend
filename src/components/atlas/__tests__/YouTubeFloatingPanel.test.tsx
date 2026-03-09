import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { YouTubeFloatingPanel } from "../YouTubeFloatingPanel";
import { YOUTUBE_CHANNELS } from "@/data/youtubeChannels";

// Mock useIsMobile
vi.mock("@/hooks/useIsMobile", () => ({
  useIsMobile: () => false,
}));

function makeMockYt() {
  const channelGroups = [
    { name: "Al Jazeera Arabic", streams: [YOUTUBE_CHANNELS[0]] },
  ];
  return {
    channelGroups,
    selectedGroup: 0,
    selectedStream: 0,
    setSelectedStream: vi.fn(),
    handleGroupChange: vi.fn(),
    group: channelGroups[0],
    stream: YOUTUBE_CHANNELS[0],
    embedSrc: "https://www.youtube.com/embed/test?autoplay=0",
    LANGUAGE_LABEL: { english: "English", arabic: "عربي", french: "Français" },
  };
}

describe("YouTubeFloatingPanel", () => {
  it("renders when open", () => {
    render(
      <YouTubeFloatingPanel open={true} onClose={vi.fn()} yt={makeMockYt()} />
    );
    expect(screen.getAllByText("Al Jazeera Arabic").length).toBeGreaterThan(0);
  });

  it("does not render when closed", () => {
    const { container } = render(
      <YouTubeFloatingPanel open={false} onClose={vi.fn()} yt={makeMockYt()} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders close button", () => {
    render(
      <YouTubeFloatingPanel open={true} onClose={vi.fn()} yt={makeMockYt()} />
    );
    expect(screen.getByLabelText("Close YouTube panel")).toBeTruthy();
  });
});
