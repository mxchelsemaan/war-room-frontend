import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { YouTubeFloatingPanel } from "../YouTubeFloatingPanel";
import type { YoutubeChannel } from "@/data/youtubeChannels";

// Mock useIsMobile
vi.mock("@/hooks/useIsMobile", () => ({
  useIsMobile: () => false,
}));

const MOCK_CHANNEL: YoutubeChannel = {
  handle: "aljazeera",
  active: true,
  display_name: "Al Jazeera Arabic",
  language: "arabic",
  country: "QA",
  video_id: "test123",
};

function makeMockYt() {
  const channelGroups = [
    { name: "Al Jazeera Arabic", handle: "aljazeera", country: "QA", streams: [MOCK_CHANNEL], isLive: true },
  ];
  return {
    channelGroups,
    selectedGroup: 0,
    selectedStream: 0,
    setSelectedStream: vi.fn(),
    handleGroupChange: vi.fn(),
    group: channelGroups[0],
    stream: MOCK_CHANNEL,
    embedSrc: "https://www.youtube.com/embed/test?autoplay=0",
    countryFlag: (code: string) => code,
    statusMap: { aljazeera: { isLive: true, videoId: "test123" } },
    liveLoading: false,
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
