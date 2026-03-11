
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { format, isToday, parseISO } from "date-fns";
import { ChevronRight, ChevronDown, ChevronUp, Loader2, PictureInPicture2, X, Play, Maximize2, LocateFixed } from "lucide-react";
import type { EnrichedEvent } from "@/types/events";
import { getEventTypeMeta } from "@/config/eventTypes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/useIsMobile";
import { SidePanel } from "./SidePanel";
import type { useYoutubePlayer } from "@/hooks/useYoutubePlayer";
import { buildSourceUrl, SourceIcon } from "@/lib/sourceUrl";

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

/** Event types classified as "news" (statements, political, updates) — everything else is "events" */
const NEWS_TYPES = new Set([
  "military_statement", "political_statement", "diplomatic_meeting",
  "government_formation", "legislation", "judicial_proceedings",
  "trade_disruption", "economic_crisis", "civil_defense_update",
  "civil_defense_warning", "all_clear", "humanitarian",
]);


/** Map country name → [ISO 2-letter code, flag emoji] */
const COUNTRY_META: Record<string, [code: string, flag: string]> = {
  lebanon:              ["LB", "\uD83C\uDDF1\uD83C\uDDE7"],
  syria:                ["SY", "\uD83C\uDDF8\uD83C\uDDFE"],
  israel:               ["IL", "\uD83C\uDDEE\uD83C\uDDF1"],
  palestine:            ["PS", "\uD83C\uDDF5\uD83C\uDDF8"],
  iran:                 ["IR", "\uD83C\uDDEE\uD83C\uDDF7"],
  iraq:                 ["IQ", "\uD83C\uDDEE\uD83C\uDDF6"],
  jordan:               ["JO", "\uD83C\uDDEF\uD83C\uDDF4"],
  turkey:               ["TR", "\uD83C\uDDF9\uD83C\uDDF7"],
  egypt:                ["EG", "\uD83C\uDDEA\uD83C\uDDEC"],
  "united states":      ["US", "\uD83C\uDDFA\uD83C\uDDF8"],
  usa:                  ["US", "\uD83C\uDDFA\uD83C\uDDF8"],
  russia:               ["RU", "\uD83C\uDDF7\uD83C\uDDFA"],
  ukraine:              ["UA", "\uD83C\uDDFA\uD83C\uDDE6"],
  yemen:                ["YE", "\uD83C\uDDFE\uD83C\uDDEA"],
  "saudi arabia":       ["SA", "\uD83C\uDDF8\uD83C\uDDE6"],
  "united arab emirates": ["AE", "\uD83C\uDDE6\uD83C\uDDEA"],
  uae:                  ["AE", "\uD83C\uDDE6\uD83C\uDDEA"],
  qatar:                ["QA", "\uD83C\uDDF6\uD83C\uDDE6"],
  bahrain:              ["BH", "\uD83C\uDDE7\uD83C\uDDED"],
  kuwait:               ["KW", "\uD83C\uDDF0\uD83C\uDDFC"],
  oman:                 ["OM", "\uD83C\uDDF4\uD83C\uDDF2"],
  libya:                ["LY", "\uD83C\uDDF1\uD83C\uDDFE"],
  tunisia:              ["TN", "\uD83C\uDDF9\uD83C\uDDF3"],
  algeria:              ["DZ", "\uD83C\uDDE9\uD83C\uDDFF"],
  morocco:              ["MA", "\uD83C\uDDF2\uD83C\uDDE6"],
  sudan:                ["SD", "\uD83C\uDDF8\uD83C\uDDE9"],
  somalia:              ["SO", "\uD83C\uDDF8\uD83C\uDDF4"],
  afghanistan:          ["AF", "\uD83C\uDDE6\uD83C\uDDEB"],
  pakistan:              ["PK", "\uD83C\uDDF5\uD83C\uDDF0"],
  "united kingdom":     ["GB", "\uD83C\uDDEC\uD83C\uDDE7"],
  uk:                   ["GB", "\uD83C\uDDEC\uD83C\uDDE7"],
  france:               ["FR", "\uD83C\uDDEB\uD83C\uDDF7"],
  germany:              ["DE", "\uD83C\uDDE9\uD83C\uDDEA"],
  china:                ["CN", "\uD83C\uDDE8\uD83C\uDDF3"],
};

function getCountryPill(country: string | null): { code: string; flag: string } | null {
  if (!country) return null;
  const meta = COUNTRY_META[country.toLowerCase().trim()];
  if (meta) return { code: meta[0], flag: meta[1] };
  // Fallback: generate flag from first two chars if it looks like an ISO code
  if (country.length === 2) {
    const upper = country.toUpperCase();
    const flag = String.fromCodePoint(
      ...upper.split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
    );
    return { code: upper, flag };
  }
  return null;
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
  onFlyToEvent?: (lat: number, lng: number) => void;
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
}: EventFeedPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [showEvents, setShowEvents] = useState(true);
  const [showNews, setShowNews] = useState(true);

  const filteredEvents = useMemo(() => {
    if (showEvents && showNews) return events;
    return events.filter((e) => {
      const isNews = NEWS_TYPES.has(e.eventType);
      return isNews ? showNews : showEvents;
    });
  }, [events, showEvents, showNews]);
  const groups = useMemo(() => groupByDate(filteredEvents), [filteredEvents]);

  function handleToggle() {
    onOpenChange(!open);
  }

  const [ytCollapsed, setYtCollapsed] = useState(false);
  const [ytDropdownOpen, setYtDropdownOpen] = useState(false);
  const ytDropdownRef = useRef<HTMLDivElement>(null);
  const { channelGroups, selectedGroup, selectedStream, setSelectedStream, handleGroupChange, group, stream, embedSrc } = yt;
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

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      width="w-80"
      header={
        <div className="flex h-14 shrink-0 items-center border-b border-border px-3 gap-2">
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
            <>
              <span className="text-sm font-semibold">Live Feeds</span>
              <div className="flex items-center gap-2 ml-auto">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showEvents}
                    onChange={(e) => setShowEvents(e.target.checked)}
                    className="size-3 accent-red-500 cursor-pointer"
                  />
                  <span className="text-2xs text-muted-foreground">Events</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showNews}
                    onChange={(e) => setShowNews(e.target.checked)}
                    className="size-3 accent-purple-500 cursor-pointer"
                  />
                  <span className="text-2xs text-muted-foreground">News</span>
                </label>
              </div>
            </>
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
                  className={`sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 border-b border-border bg-muted/80 text-2xs font-semibold uppercase tracking-wider text-muted-foreground ${activeDay === date ? "ring-1 ring-inset ring-primary" : ""}`}
                >
                  {today ? "Today \u2014 " : ""}
                  {format(parsedDate, "d MMM yyyy")}
                </div>
                {items.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    isHighlighted={activeDay === date}
                    onFlyTo={onFlyToEvent}
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
  onFlyTo,
}: {
  event: EnrichedEvent;
  isHighlighted: boolean;
  onFlyTo?: (lat: number, lng: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const detailsRef = useRef<HTMLDivElement>(null);
  const meta = getEventTypeMeta(event.eventType);
  const severityDot = SEVERITY_COLORS[event.severity] ?? "bg-slate-500";
  const hasMedia = !!event.mediaUrl;
  const hasCasualties = (event.casualties.killed ?? 0) > 0 || (event.casualties.injured ?? 0) > 0;
  const countryPill = getCountryPill(event.location.country);
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
      className={`border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer ${
        isHighlighted ? "bg-primary/5" : ""
      } ${expanded ? "bg-muted/20" : ""}`}
      onClick={toggle}
    >
      {/* Collapsed row */}
      <div className="flex gap-2.5 px-3 py-2.5">
        {/* Left: severity bar + icon */}
        <div className="flex flex-col items-center gap-1 mt-0.5 shrink-0">
          <span className="text-base leading-none">{meta.icon}</span>
          <span className={`h-1.5 w-1.5 rounded-full ${severityDot}`} />
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col gap-1 min-w-0">
          {/* Line 1: location + time + chevron */}
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-semibold truncate">
              {toTitleCase(event.location.name)}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title={`View on ${event.sourceType === "telegram" ? "Telegram" : "X"}`}
                >
                  <SourceIcon sourceType={event.sourceType} className="size-3" />
                </a>
              )}
              <span className="text-2xs text-muted-foreground">
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
          </div>

          {/* Chips — always visible */}
          <div className="flex flex-wrap items-center gap-1 mt-0.5">
            <span
              className="rounded-full px-1.5 py-0.5 text-2xs font-medium leading-none"
              style={{ background: meta.color + "22", color: meta.color }}
            >
              {meta.label}
            </span>
            {hasCasualties && (
              <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-2xs font-medium text-red-400 leading-none">
                {event.casualties.killed != null && event.casualties.killed > 0 && `${event.casualties.killed} killed`}
                {event.casualties.killed != null && event.casualties.killed > 0 && event.casualties.injured != null && event.casualties.injured > 0 && " · "}
                {event.casualties.injured != null && event.casualties.injured > 0 && `${event.casualties.injured} injured`}
              </span>
            )}
            {event.verificationStatus !== "reported" && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground leading-none">
                {toTitleCase(event.verificationStatus)}
              </span>
            )}
            {countryPill && (
              <Badge variant="outline" className="px-2 py-0.5 text-xs font-medium gap-1">
                <span className="text-sm leading-none">{countryPill.flag}</span>
                {countryPill.code}
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
            {event.location.country && (
              <>
                <span className="text-muted-foreground">Country</span>
                <span className="text-foreground">
                  {countryPill && <span className="mr-1">{countryPill.flag}</span>}
                  {toTitleCase(event.location.country)}
                </span>
              </>
            )}
            {event.casualties.displaced != null && event.casualties.displaced > 0 && (
              <>
                <span className="text-muted-foreground">Displaced</span>
                <span className="text-foreground">{event.casualties.displaced.toLocaleString()}</span>
              </>
            )}
            <span className="text-muted-foreground">Source</span>
            <span className="text-foreground">
              {sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  <SourceIcon sourceType={event.sourceType} className="size-3" />
                  {event.sourceChannel ? `@${event.sourceChannel}` : (event.sourceType === "telegram" ? "Telegram" : "X")}
                </a>
              ) : (
                <>
                  {event.sourceType === "telegram" ? "Telegram" : event.sourceType === "x_post" ? "X (Twitter)" : event.sourceType}
                  {event.sourceChannel && ` · ${event.sourceChannel}`}
                </>
              )}
            </span>
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
              onClick={(e) => { e.stopPropagation(); onFlyTo(event.location.lat!, event.location.lng!); }}
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
