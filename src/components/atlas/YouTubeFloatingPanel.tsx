import { useRef, useCallback, useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { useYoutubePlayer } from "@/hooks/useYoutubePlayer";

function StatusDot({ isLive }: { isLive: boolean }) {
  if (isLive) {
    return (
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
      </span>
    );
  }
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
    </span>
  );
}

interface YouTubeFloatingPanelProps {
  open: boolean;
  onClose: () => void;
  yt: ReturnType<typeof useYoutubePlayer>;
}

/** Border width (px) around the panel that acts as a drag handle */
const DRAG_BORDER = 6;

export function YouTubeFloatingPanel({ open, onClose, yt }: YouTubeFloatingPanelProps) {
  const isMobile = useIsMobile();
  const [pos, setPos] = useState({ x: 16, y: 80 });
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const outerRef = useRef<HTMLDivElement>(null);

  // Clamp position so panel stays within its parent (map area)
  const clampPos = useCallback((x: number, y: number) => {
    const el = outerRef.current;
    const parent = el?.parentElement;
    if (!el || !parent) return { x, y };
    const pw = parent.clientWidth;
    const ph = parent.clientHeight;
    const ew = el.offsetWidth;
    const eh = el.offsetHeight;
    return {
      x: Math.max(0, Math.min(x, pw - ew)),
      y: Math.max(0, Math.min(y, ph - eh)),
    };
  }, []);

  // Check if pointer is in the drag border zone or the header
  const isInDragZone = useCallback((e: React.PointerEvent) => {
    const el = outerRef.current;
    if (!el) return false;
    const header = el.querySelector("[data-drag-header]");
    if (header && header.contains(e.target as Node)) return true;
    const rect = el.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    return cx < DRAG_BORDER || cx > rect.width - DRAG_BORDER || cy < DRAG_BORDER || cy > rect.height - DRAG_BORDER;
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, select, iframe, [role=combobox], [role=listbox], [role=option]")) return;
    if (!isInDragZone(e)) return;
    dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }, [pos, isInDragZone]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    const clamped = clampPos(dragStart.current.px + dx, dragStart.current.py - dy);
    setPos(clamped);
  }, [clampPos]);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  useEffect(() => {
    const handleResize = () => setPos((p) => clampPos(p.x, p.y));
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampPos]);

  if (isMobile || !open) return null;

  const { channelGroups, selectedGroup, selectedStream, setSelectedStream, handleGroupChange, group, stream, embedSrc, countryFlag } = yt;

  return (
    <div
      ref={outerRef}
      className="absolute z-[60] w-[360px] flex flex-col overflow-hidden rounded-lg"
      style={{
        left: pos.x,
        bottom: pos.y,
        padding: DRAG_BORDER,
        cursor: "default",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="glass-panel flex flex-col overflow-hidden rounded-lg">
        {/* Header — always draggable */}
        <div
          data-drag-header
          className="flex items-center gap-2 px-3 py-2 border-b border-border cursor-grab active:cursor-grabbing select-none"
        >
          {group ? (
            <>
              <StatusDot isLive={group.isLive} />
              <span className="flex-1 text-xs font-semibold truncate">{group.name}</span>
            </>
          ) : (
            <span className="flex-1 text-xs text-muted-foreground">Select a channel</span>
          )}
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close YouTube panel">
            <X className="size-3.5" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-2 p-2">
          {/* Channel list */}
          {selectedGroup === -1 && (
            <div className="max-h-48 overflow-y-auto -mx-2">
              {channelGroups.map((g, i) => (
                <button
                  key={g.handle}
                  onClick={() => handleGroupChange(i)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-muted/40 ${
                    !g.isLive ? "opacity-50" : ""
                  }`}
                >
                  <span className="text-sm leading-none shrink-0">{g.name.split(" ")[0]}</span>
                  <span className="flex-1 text-left truncate">{g.streams[0].display_name}</span>
                  <StatusDot isLive={g.isLive} />
                </button>
              ))}
            </div>
          )}

          {/* Language variants */}
          {group && group.streams.length > 1 && (
            <div className="flex gap-1.5 flex-wrap">
              {group.streams.map((s, i) => (
                <Button
                  key={s.handle}
                  variant={selectedStream === i ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedStream(i)}
                  className="text-xs"
                >
                  {countryFlag(s.country)}
                </Button>
              ))}
            </div>
          )}

          {embedSrc && stream && selectedGroup !== -1 && (
            <div className="w-full overflow-hidden rounded-md border border-border bg-black">
              <div className="aspect-video">
                <iframe
                  key={embedSrc}
                  src={embedSrc}
                  title={`${group!.name} ${stream.language} live`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
