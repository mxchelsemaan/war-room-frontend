
import { useEffect, useRef, useState, useMemo } from "react";
import { format, isToday, parseISO } from "date-fns";
import { ChevronRight, ChevronDown, ChevronUp, Loader2, PictureInPicture2, X } from "lucide-react";
import type { EnrichedEvent } from "@/types/events";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/useIsMobile";
import { SidePanel } from "./SidePanel";
import type { useYoutubePlayer } from "@/hooks/useYoutubePlayer";
import { EventRow } from "./EventRow";


function groupByDate(events: EnrichedEvent[]): { date: string; items: EnrichedEvent[] }[] {
  const map = new Map<string, EnrichedEvent[]>();
  const sorted = [...events].sort((a, b) => {
    const dc = b.date.localeCompare(a.date);
    if (dc !== 0) return dc;
    return (b.dateTime ?? "").localeCompare(a.dateTime ?? "");
  });
  for (const e of sorted) {
    const bucket = map.get(e.date) ?? [];
    bucket.push(e);
    map.set(e.date, bucket);
  }
  return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
}

interface EventFeedPanelProps {
  events: EnrichedEvent[];
  activeDay: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading?: boolean;
  isLoadingMore?: boolean;
  error?: string | null;
  hasMore?: boolean;
  onLoadMore?: () => void;
  yt: ReturnType<typeof useYoutubePlayer>;
  /** Whether YouTube is currently in the floating PiP panel */
  youtubePopped?: boolean;
  onPopOutYouTube?: () => void;
  onDockYouTube?: () => void;
  onFlyToEvent?: (lat: number, lng: number, eventId?: string) => void;
  selectedEventId?: string | null;
  onEventSelect?: (id: string | null) => void;
}

export function EventFeedPanel({
  events, activeDay, open, onOpenChange,
  isLoading, isLoadingMore, error,
  hasMore, onLoadMore,
  yt, youtubePopped, onPopOutYouTube, onDockYouTube,
  onFlyToEvent,
  selectedEventId, onEventSelect,
}: EventFeedPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const groups = useMemo(() => groupByDate(events), [events]);

  function handleToggle() {
    onOpenChange(!open);
  }

  const [ytCollapsed] = useState(false);
  const [ytDropdownOpen, setYtDropdownOpen] = useState(false);
  const ytDropdownRef = useRef<HTMLDivElement>(null);
  const { channelGroups, selectedGroup, handleGroupChange, group, stream, embedSrc } = yt;
  // Show inline YouTube player when a channel is selected and not popped out
  const showInlineYt = !youtubePopped && selectedGroup !== -1 && !isMobile;

  // Close dropdown on outside click
  useEffect(() => {
    if (!ytDropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (ytDropdownRef.current && !ytDropdownRef.current.contains(e.target as Node)) setYtDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [ytDropdownOpen]);

  useEffect(() => {
    if (!activeDay || !scrollRef.current) return;
    const el = scrollRef.current.querySelector<HTMLElement>(
      `[data-date-header="${activeDay}"]`
    );
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeDay]);

  // Scroll to and briefly highlight the selected event (from map pin click)
  useEffect(() => {
    if (!selectedEventId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector<HTMLElement>(
      `[data-event-id="${selectedEventId}"]`
    );
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedEventId]);

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      width="w-96"
      header={
        <div className="flex h-9 shrink-0 items-center border-b border-border px-3 gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleToggle}
            className={open || isMobile ? "" : "mx-auto"}
            aria-label={open ? "Close live feeds" : "Open live feeds"}
          >
            <ChevronRight
              className={`size-4 transition-transform duration-200 ${
                !open && !isMobile ? "rotate-180" : ""
              }`}
            />
          </Button>
          {(open || isMobile) && (
            <span className="text-sm font-semibold">Live Feeds</span>
          )}
        </div>
      }
      collapsedContent={
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4">
          <span
            className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground select-none [writing-mode:vertical-rl] rotate-180"
          >
            Live Feeds
          </span>
        </div>
      }
    >
      <div className="flex flex-col flex-1 min-h-0">
        {/* YouTube channel selector + inline player */}
        {!youtubePopped && !isMobile && channelGroups.length > 0 && (
          <div ref={ytDropdownRef} className="shrink-0 border-b border-border relative">
            {/* Header bar — shows selected channel or summary */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/40">
              {group ? (
                <>
                  <StatusDot isLive={group.isLive} />
                  <span className="flex-1 text-xs font-semibold truncate">{group.name}</span>
                </>
              ) : (
                <>
                  {channelGroups.some(g => g.isLive) && <StatusDot isLive={true} />}
                  <span className="flex-1 text-xs text-muted-foreground truncate">
                    {(() => {
                      const liveChannels = channelGroups.filter(g => g.isLive);
                      if (liveChannels.length === 0) return `${channelGroups.length} channels`;
                      const names = liveChannels.slice(0, 2).map(g => g.streams[0].display_name);
                      const rest = liveChannels.length - names.length;
                      return rest > 0 ? `${names.join(", ")} +${rest} more live` : `${names.join(" & ")} live`;
                    })()}
                  </span>
                </>
              )}
              {showInlineYt && !isMobile && onPopOutYouTube && (
                <Button variant="ghost" size="icon-sm" onClick={onPopOutYouTube} aria-label="Pop out to floating player" title="Pop out">
                  <PictureInPicture2 className="size-3" />
                </Button>
              )}
              {selectedGroup !== -1 && (
                <Button variant="ghost" size="icon-sm" onClick={() => handleGroupChange(-1)} aria-label="Close player" title="Close player">
                  <X className="size-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setYtDropdownOpen(v => !v)}
                aria-label={ytDropdownOpen ? "Close channel list" : "Open channel list"}
              >
                {ytDropdownOpen ? <ChevronUp className="size-3 text-muted-foreground" /> : <ChevronDown className="size-3 text-muted-foreground" />}
              </Button>
            </div>

            {/* Video embed — collapsible, only when channel selected */}
            {showInlineYt && embedSrc && stream && !ytCollapsed && (
              <div className="aspect-video bg-black relative z-0">
                <iframe
                  key={embedSrc}
                  src={embedSrc}
                  title={`${group!.name} ${stream.language} live`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
            )}

            {/* Dropdown list — rendered after video so z-50 stacks on top */}
            {ytDropdownOpen && (
              <div className="absolute left-0 right-0 top-8 z-50 bg-background border border-border rounded-b-lg shadow-lg max-h-52 overflow-y-auto">
                {channelGroups.map((g, i) => {
                  const active = selectedGroup === i;
                  return (
                    <button
                      key={g.handle}
                      onClick={() => { handleGroupChange(i); setYtDropdownOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-muted/40 ${
                        active ? "bg-muted/60 font-semibold" : ""
                      } ${!g.isLive ? "opacity-50" : ""}`}
                    >
                      <span className="text-sm leading-none shrink-0">{g.name.split(" ")[0]}</span>
                      <span className="flex-1 text-left truncate">{g.streams[0].display_name}</span>
                      <StatusDot isLive={g.isLive} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Popped-out indicator — click to dock back */}
        {youtubePopped && !isMobile && (
          <div className="shrink-0 border-b border-border px-3 py-1.5 flex items-center gap-2 bg-muted/30">
            <StatusDot isLive={group?.isLive ?? false} />
            <span className="text-2xs text-muted-foreground flex-1 truncate">
              {group ? group.name : "YouTube"} — floating
            </span>
            {onDockYouTube && (
              <Button variant="ghost" size="icon-sm" onClick={onDockYouTube} aria-label="Dock player back to sidebar" title="Dock back">
                <PictureInPicture2 className="size-3" />
              </Button>
            )}
          </div>
        )}

        {/* Events list */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {isLoading && (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {error && !isLoading && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 mx-3 mt-3 text-xs text-destructive">
              {error}
            </div>
          )}
          {!isLoading && groups.map(({ date, items }) => {
            const parsedDate = parseISO(date);
            const today = isToday(parsedDate);
            return (
              <div key={date}>
                <div
                  data-date-header={date}
                  className={`sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 border-b border-border bg-muted/80 section-heading ${activeDay === date ? "ring-1 ring-inset ring-primary" : ""}`}
                >
                  {today ? "Today \u2014 " : ""}
                  {format(parsedDate, "d MMM yyyy")}
                </div>
                {items.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    isHighlighted={activeDay === date}
                    isSelected={selectedEventId === event.id}
                    onFlyTo={onFlyToEvent}
                    onEventSelect={onEventSelect}
                  />
                ))}
              </div>
            );
          })}
          {/* Infinite scroll sentinel */}
          {!isLoading && hasMore && onLoadMore && (
            <InfiniteScrollSentinel onIntersect={onLoadMore} />
          )}
          {isLoadingMore && (
            <div className="flex items-center justify-center h-12">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </div>
    </SidePanel>
  );
}

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

/** Sentinel element that triggers `onIntersect` when scrolled into view */
function InfiniteScrollSentinel({ onIntersect }: { onIntersect: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const onIntersectRef = useRef(onIntersect);
  onIntersectRef.current = onIntersect;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onIntersectRef.current();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} className="h-1" />;
}
