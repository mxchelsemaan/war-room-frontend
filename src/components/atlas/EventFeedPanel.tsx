
import { useEffect, useRef, useState, useMemo } from "react";
import { format, isToday, parseISO } from "date-fns";
import { ChevronRight, ChevronDown, Loader2, PictureInPicture2, X } from "lucide-react";
import type { EnrichedEvent } from "@/types/events";
import { getEventTypeMeta } from "@/config/eventTypes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/useIsMobile";
import { SidePanel } from "./SidePanel";
import type { useYoutubePlayer } from "@/hooks/useYoutubePlayer";

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
  error?: string | null;
  yt: ReturnType<typeof useYoutubePlayer>;
  /** Whether YouTube is currently in the floating PiP panel */
  youtubePopped?: boolean;
  onPopOutYouTube?: () => void;
  onDockYouTube?: () => void;
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
  isLoading, error,
  yt, youtubePopped, onPopOutYouTube, onDockYouTube,
}: EventFeedPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => groupByDate(events), [events]);
  const isMobile = useIsMobile();

  function handleToggle() {
    onOpenChange(!open);
  }

  const [ytCollapsed, setYtCollapsed] = useState(false);
  const { channelGroups, selectedGroup, selectedStream, setSelectedStream, handleGroupChange, group, stream, embedSrc } = yt;
  // Show inline YouTube player when a channel is selected and not popped out
  const showInlineYt = !youtubePopped && selectedGroup !== -1 && !isMobile;

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
              <span className="ml-auto text-xs text-muted-foreground">
                {events.length} event{events.length !== 1 ? "s" : ""}
              </span>
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
        {/* Inline YouTube player — stacked above events */}
        {showInlineYt && embedSrc && stream && (
          <div className="shrink-0 border-b border-border">
            {/* Header bar */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/40">
              <Select
                value={String(selectedGroup)}
                onValueChange={(v) => handleGroupChange(Number(v))}
              >
                <SelectTrigger className="flex-1 text-xs h-6 border-none bg-transparent shadow-none px-0 gap-1 font-semibold [&>svg:last-child]:hidden">
                  <span className="flex items-center gap-2">
                    <LiveDot />
                    <SelectValue />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {channelGroups.map((g, i) => (
                    <SelectItem key={g.name} value={String(i)}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isMobile && onPopOutYouTube && (
                <Button variant="ghost" size="icon-sm" onClick={onPopOutYouTube} aria-label="Pop out to floating player" title="Pop out">
                  <PictureInPicture2 className="size-3" />
                </Button>
              )}
              <Button variant="ghost" size="icon-sm" onClick={() => setYtCollapsed(v => !v)} aria-label={ytCollapsed ? "Expand player" : "Collapse player"}>
                <ChevronDown className={`size-3 transition-transform ${ytCollapsed ? "" : "rotate-180"}`} />
              </Button>
            </div>
            {/* Video embed — collapsible */}
            {!ytCollapsed && (
              <div className="aspect-video bg-black">
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
          </div>
        )}

        {/* Channel selector — show when no channel selected and not popped out */}
        {!youtubePopped && selectedGroup === -1 && !isMobile && channelGroups.length > 0 && (
          <div className="shrink-0 border-b border-border px-3 py-2">
            <Select
              value=""
              onValueChange={(v) => handleGroupChange(Number(v))}
            >
              <SelectTrigger className="w-full text-xs h-7">
                <SelectValue placeholder="Watch live TV…" />
              </SelectTrigger>
              <SelectContent>
                {channelGroups.map((g, i) => (
                  <SelectItem key={g.name} value={String(i)}>
                    <span className="flex items-center gap-2">
                      <LiveDot />
                      {g.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Popped-out indicator — click to dock back */}
        {youtubePopped && !isMobile && (
          <div className="shrink-0 border-b border-border px-3 py-1.5 flex items-center gap-2 bg-muted/30">
            <LiveDot />
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
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </SidePanel>
  );
}

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
    </span>
  );
}

function EventRow({
  event,
  isHighlighted,
}: {
  event: EnrichedEvent;
  isHighlighted: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = getEventTypeMeta(event.eventType);
  const severityDot = SEVERITY_COLORS[event.severity] ?? "bg-slate-500";
  const hasMedia = !!event.mediaUrl;
  const hasCasualties = (event.casualties.killed ?? 0) > 0 || (event.casualties.injured ?? 0) > 0;
  const countryPill = getCountryPill(event.location.country);

  return (
    <div
      className={`border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer ${
        isHighlighted ? "bg-primary/5" : ""
      } ${expanded ? "bg-muted/20" : ""}`}
      onClick={() => setExpanded((v) => !v)}
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
          {/* Line 1: location + source */}
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-semibold truncate">
              {event.location.name}
            </span>
            <span className="shrink-0 text-2xs text-muted-foreground">
              {event.dateTime ? shortTimeAgo(event.dateTime) : event.date}
            </span>
          </div>

          {/* Line 2: summary (clamped when collapsed, full when expanded) */}
          <p className={`text-xs text-muted-foreground leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
            {event.summary}
          </p>

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
                {event.verificationStatus}
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
        <div className="px-3 pb-3 flex flex-col gap-2 ml-[30px]">
          {/* Media — full width, larger */}
          {hasMedia && (
            <div className="w-full overflow-hidden rounded-md border border-border/50">
              <img
                src={event.mediaUrl!}
                alt=""
                loading="lazy"
                className="w-full max-h-56 object-cover bg-muted"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          )}

          {/* Detail grid */}
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            {event.attacker && (
              <>
                <span className="text-muted-foreground">Attacker</span>
                <span className="text-foreground">{event.attacker}</span>
              </>
            )}
            {event.affectedParty && (
              <>
                <span className="text-muted-foreground">Target</span>
                <span className="text-foreground">{event.affectedParty}</span>
              </>
            )}
            {event.weaponSystem && (
              <>
                <span className="text-muted-foreground">Weapon</span>
                <span className="text-foreground">{event.weaponSystem}</span>
              </>
            )}
            {event.location.region && (
              <>
                <span className="text-muted-foreground">Region</span>
                <span className="text-foreground">{event.location.region}</span>
              </>
            )}
            {event.location.country && (
              <>
                <span className="text-muted-foreground">Country</span>
                <span className="text-foreground">
                  {countryPill && <span className="mr-1">{countryPill.flag}</span>}
                  {event.location.country}
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
              {event.sourceType === "telegram" ? "Telegram" : event.sourceType === "x_post" ? "X (Twitter)" : event.sourceType}
              {event.sourceChannel && ` · ${event.sourceChannel}`}
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
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Source claim */}
          {event.sourceClaim && (
            <p className="text-2xs text-muted-foreground/70 italic">
              Source: {event.sourceClaim}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
