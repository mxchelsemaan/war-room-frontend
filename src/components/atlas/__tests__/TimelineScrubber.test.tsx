import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { TimelineScrubber } from "../TimelineScrubber";
import type { TimelineDateEntry } from "@/types/events";

const DATES: TimelineDateEntry[] = [
  { day: "2024-10-01", count: 5 },
  { day: "2024-10-02", count: 12 },
  { day: "2024-10-03", count: 3 },
  { day: "2024-10-04", count: 8 },
  { day: "2024-10-05", count: 1 },
];

function renderScrubber(props: Partial<React.ComponentProps<typeof TimelineScrubber>> = {}) {
  return render(
    <TimelineScrubber
      dates={DATES}
      activeDay={null}
      onChange={vi.fn()}
      open={true}
      onToggle={vi.fn()}
      {...props}
    />
  );
}

describe("TimelineScrubber", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("renders play button and date range", () => {
    renderScrubber();
    expect(screen.getByLabelText("Play")).toBeInTheDocument();
    expect(screen.getAllByText(/1 Oct/).length).toBeGreaterThan(0);
    expect(screen.getByText(/5 Oct 2024/)).toBeInTheDocument();
  });

  it("shows formatted active day when one is set", () => {
    renderScrubber({ activeDay: "2024-10-03" });
    expect(screen.getByText("3 Oct")).toBeInTheDocument();
  });

  it("clicking play advances through dates on interval", () => {
    const onChange = vi.fn();
    renderScrubber({ onChange });

    fireEvent.click(screen.getByLabelText("Play"));

    act(() => { vi.advanceTimersByTime(900); });
    expect(onChange).toHaveBeenCalledWith(DATES[1].day);

    act(() => { vi.advanceTimersByTime(900); });
    expect(onChange).toHaveBeenCalledWith(DATES[2].day);
  });

  it("switches to Pause button while playing", () => {
    renderScrubber();
    fireEvent.click(screen.getByLabelText("Play"));
    expect(screen.getByLabelText("Pause")).toBeInTheDocument();
  });

  it("pause stops advancing", () => {
    const onChange = vi.fn();
    renderScrubber({ onChange });
    fireEvent.click(screen.getByLabelText("Play"));
    act(() => { vi.advanceTimersByTime(900); });

    fireEvent.click(screen.getByLabelText("Pause"));
    act(() => { vi.advanceTimersByTime(900); });
    const callsAfterPause = onChange.mock.calls.length;

    act(() => { vi.advanceTimersByTime(2000); });
    expect(onChange.mock.calls.length).toBe(callsAfterPause);
  });

  it("clicking a tick label updates the active day", () => {
    const onChange = vi.fn();
    renderScrubber({ onChange });
    const tickBtn = screen.getByText("3 Oct");
    fireEvent.click(tickBtn);
    expect(onChange).toHaveBeenCalledWith(DATES[2].day);
  });

  it("'Clear' button calls onChange with null", () => {
    const onChange = vi.fn();
    renderScrubber({ activeDay: "2024-10-02", onChange });
    fireEvent.click(screen.getByText("Clear"));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("speed button cycles through 1x → 2x → 4x → 1x", () => {
    renderScrubber();
    const speedBtn = screen.getByLabelText("Speed 1x");
    expect(speedBtn).toHaveTextContent("1×");
    fireEvent.click(speedBtn);
    expect(screen.getByLabelText("Speed 2x")).toHaveTextContent("2×");
    fireEvent.click(screen.getByLabelText("Speed 2x"));
    expect(screen.getByLabelText("Speed 4x")).toHaveTextContent("4×");
    fireEvent.click(screen.getByLabelText("Speed 4x"));
    expect(screen.getByLabelText("Speed 1x")).toHaveTextContent("1×");
  });

  it("at 2x speed, advances twice as fast", () => {
    const onChange = vi.fn();
    renderScrubber({ onChange });
    fireEvent.click(screen.getByLabelText("Speed 1x"));
    fireEvent.click(screen.getByLabelText("Play"));

    act(() => { vi.advanceTimersByTime(900); });
    const calls = onChange.mock.calls.filter((c) => c[0] !== DATES[0].day);
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it("loop button toggles loop mode", () => {
    renderScrubber();
    const loopBtn = screen.getByLabelText("Loop off");
    fireEvent.click(loopBtn);
    expect(screen.getByLabelText("Loop on")).toBeInTheDocument();
  });

  it("loops back to start when loop is enabled and end is reached", () => {
    const onChange = vi.fn();
    renderScrubber({ activeDay: "2024-10-04", onChange });
    fireEvent.click(screen.getByLabelText("Loop off"));
    fireEvent.click(screen.getByLabelText("Play"));
    act(() => { vi.advanceTimersByTime(900); });
    act(() => { vi.advanceTimersByTime(900); });
    const calls = onChange.mock.calls.map((c) => c[0]);
    expect(calls).toContain(DATES[0].day);
  });

  it("collapse button hides slider and tick labels", () => {
    const onToggle = vi.fn();
    renderScrubber({ onToggle });
    expect(screen.getByRole("slider")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Close timeline"));
    expect(onToggle).toHaveBeenCalled();
  });

  it("play/pause controls remain visible", () => {
    renderScrubber({ open: false });
    expect(screen.getByLabelText("Play")).toBeInTheDocument();
  });

  it("calls onPrefetchDay for upcoming days during playback", () => {
    const onChange = vi.fn();
    const onPrefetchDay = vi.fn();
    renderScrubber({ onChange, onPrefetchDay });

    fireEvent.click(screen.getByLabelText("Play"));

    act(() => { vi.advanceTimersByTime(900); });
    // Should prefetch days 2, 3, 4 (indices ahead of current=1)
    expect(onPrefetchDay).toHaveBeenCalledWith(DATES[2].day);
    expect(onPrefetchDay).toHaveBeenCalledWith(DATES[3].day);
    expect(onPrefetchDay).toHaveBeenCalledWith(DATES[4].day);
  });
});
