import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { ChannelAvatar } from "../ChannelAvatar";

describe("ChannelAvatar", () => {
  it("renders an img with the correct telegram avatar URL", () => {
    const { container } = render(<ChannelAvatar sourceType="telegram" sourceChannel="test_channel" />);
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img!.getAttribute("src")).toBe("https://unavatar.io/telegram/test_channel");
  });

  it("renders an img with the correct x_post avatar URL", () => {
    const { container } = render(<ChannelAvatar sourceType="x_post" sourceChannel="test_handle" />);
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img!.getAttribute("src")).toBe("https://unavatar.io/x/test_handle");
  });

  it("falls back to SourceIcon when sourceChannel is null", () => {
    const { container } = render(<ChannelAvatar sourceType="telegram" sourceChannel={null} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("falls back to SourceIcon on image error", () => {
    const { container } = render(<ChannelAvatar sourceType="telegram" sourceChannel="test_channel" />);
    const img = container.querySelector("img")!;
    expect(img).toBeTruthy();
    fireEvent.error(img);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).toBeTruthy();
  });
});
