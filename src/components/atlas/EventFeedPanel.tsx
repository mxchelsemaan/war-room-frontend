
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { format, isToday, parseISO } from "date-fns";
import { ChevronRight, ChevronDown, ChevronUp, Loader2, PictureInPicture2, X, Play, Maximize2, LocateFixed, Camera } from "lucide-react";
import type { EnrichedEvent } from "@/types/events";
import { getEventTypeMeta } from "@/config/eventTypes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/useIsMobile";
import { SidePanel } from "./SidePanel";
import type { useYoutubePlayer } from "@/hooks/useYoutubePlayer";
import { buildSourceUrl } from "@/lib/sourceUrl";
import { ChannelAvatar } from "@/components/ui/ChannelAvatar";
import { isThreatAlert, isEvacuationOrder } from "@/lib/threatUtils";


/** Detect media type from URL path extension */
function getMediaType(url: string): "video" | "image" {
  const path = url.split("?")[0];
  if (path.endsWith(".video") || path.endsWith(".mp4") || path.endsWith(".mov") || path.endsWith(".webm")) return "video";
  return "image";
}

const TITLE_CASE_MINOR = new Set(["a","an","the","and","but","or","nor","for","yet","so","in","on","at","to","by","of","up","as","is"]);
function toTitleCase(str: string): string {
  return str.replace(/\S+/g, (word, i) => {
    if (i > 0 && TITLE_CASE_MINOR.has(word.toLowerCase())) return word.toLowerCase();
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
}

function shortTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs < 24) return remMins > 0 ? `${hrs}h${remMins}m ago` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-600",
  major:    "bg-red-500",
  moderate: "bg-amber-500",
  minor:    "bg-slate-400",
};



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
          {!isLoading && groups.length === 0 && !error && (
            <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
              No events match the current filters
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

function EventRow({
  event,
  isHighlighted,
  isSelected,
  onFlyTo,
  onEventSelect,
}: {
  event: EnrichedEvent;
  isHighlighted: boolean;
  isSelected?: boolean;
  onFlyTo?: (lat: number, lng: number, eventId?: string) => void;
  onEventSelect?: (id: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const detailsRef = useRef<HTMLDivElement>(null);
  const meta = getEventTypeMeta(event.eventType);
  const severityDot = SEVERITY_COLORS[event.severity] ?? "bg-slate-500";
  const isThreat = isThreatAlert(event);
  const isEvac = isEvacuationOrder(event);

  const hasMedia = !!event.mediaUrl;
  const hasPendingMedia = !event.mediaUrl && !!event.mediaType && event.mediaType !== "sticker";
  const hasCasualties = (event.casualties.killed ?? 0) > 0 || (event.casualties.injured ?? 0) > 0;
  const sourceUrl = buildSourceUrl(event.sourceType, event.sourceChannel, event.sourceId);

  const toggle = useCallback(() => {
    const el = detailsRef.current;
    if (!el) { setExpanded(v => !v); return; }

    if (expanded) {
      // Collapse: animate from current height to 0
      el.style.height = `${el.scrollHeight}px`;
      requestAnimationFrame(() => {
        el.style.height = "0px";
        el.style.opacity = "0";
      });
    } else {
      // Expand: set to 0, then animate to scrollHeight
      el.style.height = "0px";
      el.style.opacity = "0";
      setExpanded(true);
      requestAnimationFrame(() => {
        el.style.height = `${el.scrollHeight}px`;
        el.style.opacity = "1";
      });
    }
  }, [expanded]);

  const handleTransitionEnd = useCallback(() => {
    const el = detailsRef.current;
    if (!el) return;
    if (expanded && el.style.height !== "0px") {
      el.style.height = "auto"; // allow content reflow after expand
    } else if (el.style.height === "0px") {
      setExpanded(false);
    }
  }, [expanded]);

  return (
    <div
      data-event-id={event.id}
      className={`relative border-b border-border/50 hover:bg-muted/30 transition-all cursor-pointer ${
        isHighlighted ? "bg-primary/5" : ""
      } ${expanded ? "bg-muted/20" : ""} ${isSelected ? "ring-1 ring-inset ring-primary bg-primary/10" : ""}`}
      onClick={toggle}
    >
      {/* Threat glow overlay — animate-pulse with random phase offset */}
      {isThreat && (
        <div
          className={`absolute inset-0 pointer-events-none animate-pulse ${
            isEvac ? "bg-red-500/40" : "bg-red-500/25"
          }`}
          style={{ animationDelay: `${-((event.id.charCodeAt(0) ?? 0) % 20) * 0.1}s` }}
        />
      )}
      {/* Collapsed row */}
      <div className="flex gap-2.5 px-3 py-2.5 relative z-[1]">
        {/* Left: avatar + event icon + severity */}
        <div className="flex flex-col items-center gap-1.5 mt-0.5 shrink-0">
          <ChannelAvatar sourceType={event.sourceType} sourceChannel={event.sourceChannel} className="size-6 shrink-0" />
          <span className="text-base leading-none">{meta.icon}</span>
          <span className={`h-1.5 w-1.5 rounded-full ${severityDot}`} />
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col gap-0.5 min-w-0">
          {/* Line 1: source handle + link (left) + time ago (right) + chevron */}
          <div className="flex items-center justify-between gap-1">
            {(() => {
              const handle = event.sourceChannel ? `@${event.sourceChannel}` : null;
              const inner = (
                <span className="inline-flex items-center gap-1 text-xs truncate min-w-0">
                  {handle && <span className="font-medium truncate">{handle}</span>}
                  {sourceUrl && <span className="text-muted-foreground/60 text-2xs">(link)</span>}
                </span>
              );
              return sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-foreground transition-colors truncate min-w-0"
                >
                  {inner}
                </a>
              ) : inner;
            })()}
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs text-muted-foreground">
                {event.dateTime ? shortTimeAgo(event.dateTime) : event.date}
              </span>
              <ChevronDown className={`size-3 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
            </div>
          </div>

          {/* Line 2: summary + media thumbnail hint */}
          <div className={`flex gap-2 ${expanded ? "" : ""}`}>
            <p className={`text-xs text-muted-foreground leading-relaxed flex-1 min-w-0 ${expanded ? "" : "line-clamp-2"}`}>
              {event.summary}
            </p>
            {!expanded && hasMedia && (
              <div className="shrink-0 w-10 h-10 rounded overflow-hidden border border-border/50 bg-muted relative">
                {getMediaType(event.mediaUrl!) === "video" ? (
                  <div className="w-full h-full flex items-center justify-center bg-black/60">
                    <Play className="size-4 text-white fill-white" />
                  </div>
                ) : (
                  <img
                    src={event.mediaUrl!}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
                  />
                )}
              </div>
            )}
            {!expanded && hasPendingMedia && (
              <div className="shrink-0 w-10 h-10 rounded overflow-hidden border border-border/50 bg-muted/50 flex items-center justify-center">
                <Camera className="size-3.5 text-muted-foreground/40" />
              </div>
            )}
          </div>

          {/* Chips — always visible */}
          <div className="flex flex-wrap items-center gap-1 mt-0.5">
            <Badge
              variant="ghost"
              className="px-1.5 py-0.5 text-2xs leading-none"
              style={{ background: meta.color + "22", color: meta.color }}
            >
              {meta.label}
            </Badge>
            {isThreat && (
              <Badge variant="destructive" className="px-1.5 py-0.5 text-2xs font-bold leading-none">
                ALERT
              </Badge>
            )}
            {hasCasualties && (
              <Badge variant="ghost" className="bg-red-500/15 text-red-400 px-1.5 py-0.5 text-2xs leading-none">
                {event.casualties.killed != null && event.casualties.killed > 0 && `${event.casualties.killed} killed`}
                {event.casualties.killed != null && event.casualties.killed > 0 && event.casualties.injured != null && event.casualties.injured > 0 && " · "}
                {event.casualties.injured != null && event.casualties.injured > 0 && `${event.casualties.injured} injured`}
              </Badge>
            )}
            {event.verificationStatus !== "reported" && event.verificationStatus !== "confirmed" && (
              <Badge variant="secondary" className="px-1.5 py-0.5 text-2xs leading-none">
                {toTitleCase(event.verificationStatus)}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          ref={detailsRef}
          onTransitionEnd={handleTransitionEnd}
          className="overflow-hidden transition-[height,opacity] duration-200 ease-out"
        >
        <div className="px-3 pb-3 flex flex-col gap-2 ml-[30px]">
          {/* Media — image or video */}
          {hasMedia && (() => {
            const isVideo = getMediaType(event.mediaUrl!);
            return isVideo === "video" ? (
              <div className="w-full overflow-hidden rounded-md border border-border/50 bg-black">
                <video
                  src={event.mediaUrl!}
                  controls
                  preload="metadata"
                  playsInline
                  className="w-full max-h-56 object-contain"
                  onError={(e) => { (e.target as HTMLVideoElement).style.display = "none"; }}
                />
              </div>
            ) : (
              <>
                <div
                  className="group relative w-full overflow-hidden rounded-md border border-border/50 cursor-zoom-in"
                  onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
                >
                  <img
                    src={event.mediaUrl!}
                    alt=""
                    loading="lazy"
                    className="w-full max-h-56 object-cover bg-muted"
                    onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
                    <Maximize2 className="size-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
                  <DialogContent
                    className="max-w-[90vw] max-h-[90vh] p-0 border-none bg-transparent shadow-none [&>button]:text-white [&>button]:bg-black/50 [&>button]:rounded-full [&>button]:size-8 [&>button]:top-2 [&>button]:right-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <img
                      src={event.mediaUrl!}
                      alt=""
                      className="w-full h-full max-h-[85vh] object-contain rounded-lg"
                    />
                  </DialogContent>
                </Dialog>
              </>
            );
          })()}

          {/* Pending media placeholder */}
          {!hasMedia && hasPendingMedia && (
            <div className="w-full h-24 rounded-md border border-dashed border-border/50 bg-muted/30 flex items-center justify-center gap-2">
              <Camera className="size-4 text-muted-foreground/50" />
              <span className="text-xs text-muted-foreground/50">Media loading…</span>
            </div>
          )}

          {/* Detail grid */}
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            {event.attacker && (
              <>
                <span className="text-muted-foreground">Attacker</span>
                <span className="text-foreground">{toTitleCase(event.attacker)}</span>
              </>
            )}
            {event.affectedParty && (
              <>
                <span className="text-muted-foreground">Target</span>
                <span className="text-foreground">{toTitleCase(event.affectedParty)}</span>
              </>
            )}
            {event.weaponSystem && (
              <>
                <span className="text-muted-foreground">Weapon</span>
                <span className="text-foreground">{toTitleCase(event.weaponSystem)}</span>
              </>
            )}
            {event.location.region && (
              <>
                <span className="text-muted-foreground">Region</span>
                <span className="text-foreground">{toTitleCase(event.location.region)}</span>
              </>
            )}
            {event.casualties.displaced != null && event.casualties.displaced > 0 && (
              <>
                <span className="text-muted-foreground">Displaced</span>
                <span className="text-foreground">{event.casualties.displaced.toLocaleString()}</span>
              </>
            )}
            <span className="text-muted-foreground">Date</span>
            <span className="text-foreground">
              {event.dateTime
                ? format(parseISO(event.dateTime), "EEE d MMM yyyy, h:mm a")
                : event.date}
            </span>
          </div>

          {/* Topics */}
          {event.topics.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {event.topics.map((t) => (
                <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-2xs text-muted-foreground">
                  {toTitleCase(t)}
                </span>
              ))}
            </div>
          )}

          {/* Source claim */}
          {event.sourceClaim && (
            <p className="text-2xs text-muted-foreground/70 italic">
              According to: {event.sourceClaim}
            </p>
          )}

          {/* Go to event */}
          {onFlyTo && event.location.lat != null && event.location.lng != null && (
            <Button
              variant="outline"
              size="sm"
              className="w-full h-7 text-2xs gap-1.5"
              onClick={(e) => { e.stopPropagation(); onFlyTo(event.location.lat!, event.location.lng!, event.id); onEventSelect?.(event.id); }}
            >
              <LocateFixed className="size-3" />
              Go to event
            </Button>
          )}
        </div>
        </div>
      )}
    </div>
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
