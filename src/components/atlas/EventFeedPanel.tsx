
import { useEffect, useRef, useState, useMemo } from "react";
import { format, isToday, parseISO } from "date-fns";
import { ChevronRight } from "lucide-react";
import type { MapEvent } from "@/data/index";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { YOUTUBE_CHANNELS } from "@/data/youtubeChannels";
import { useIsMobile } from "@/hooks/useIsMobile";
import { SidePanel } from "./SidePanel";

const TYPE_COLORS: Record<string, string> = {
  security_incident: "bg-amber-500",
  airstrike:         "bg-red-500",
  protest:           "bg-blue-500",
  humanitarian:      "bg-emerald-500",
  infrastructure:    "bg-purple-500",
  political:         "bg-indigo-500",
};

const LANGUAGE_LABEL: Record<string, string> = {
  english: "English",
  arabic:  "عربي",
  french:  "Français",
};

interface EventFeedPanelProps {
  /** Full filtered event list (not narrowed by timeline) */
  events: MapEvent[];
  /** If a specific timeline day is active, scroll the feed to that date header */
  activeDay: string | null;
  /** Controlled open state */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function groupByDate(events: MapEvent[]): { date: string; items: MapEvent[] }[] {
  const map = new Map<string, MapEvent[]>();
  const sorted = [...events].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  for (const e of sorted) {
    const bucket = map.get(e.date) ?? [];
    bucket.push(e);
    map.set(e.date, bucket);
  }
  return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
}

export function EventFeedPanel({ events, activeDay, open, onOpenChange }: EventFeedPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => groupByDate(events), [events]);
  const isMobile = useIsMobile();

  const [tab, setTab] = useState("events");
  const ytChannels = YOUTUBE_CHANNELS;
  const ytLoading = false;
  const ytError: string | null = null;

  // Group flat channel rows into { displayName → rows[] }
  const channelGroups = useMemo(() => {
    const map = new Map<string, typeof ytChannels>();
    for (const ch of ytChannels) {
      const bucket = map.get(ch.display_name) ?? [];
      bucket.push(ch);
      map.set(ch.display_name, bucket);
    }
    return Array.from(map.entries()).map(([name, streams]) => ({ name, streams }));
  }, [ytChannels]);

  const [selectedGroup, setSelectedGroup] = useState(-1);
  const [selectedStream, setSelectedStream] = useState(0);

  // Reset stream index when group changes
  function handleGroupChange(idx: number) {
    setSelectedGroup(idx);
    setSelectedStream(0);
  }

  const group = channelGroups[selectedGroup];
  const stream = group?.streams[selectedStream];
  const embedSrc = stream ? `https://www.youtube.com/embed/${stream.video_id}?autoplay=0` : null;

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
            onClick={() => onOpenChange(!open)}
            className={open || isMobile ? "" : "mx-auto"}
            aria-label={open ? "Close live feeds" : "Open live feeds"}
          >
            <ChevronRight
              className={`size-4 transition-transform duration-200 ${open || isMobile ? "" : "rotate-180"}`}
            />
          </Button>
          {(open || isMobile) && (
            <>
              <span className="text-sm font-semibold">Live Feeds</span>
              {tab === "events" && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {events.length} event{events.length !== 1 ? "s" : ""}
                </span>
              )}
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
      <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 min-h-0 gap-0">
        <TabsList variant="line" className="shrink-0 w-full border-b border-border h-auto p-0">
          <TabsTrigger value="events" className="flex-1 py-2 text-xs rounded-none">Events</TabsTrigger>
          <TabsTrigger value="youtube" className="flex-1 py-2 text-xs rounded-none">YouTube</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="flex-1 min-h-0">
          <div ref={scrollRef} className="h-full overflow-y-auto overscroll-contain">
            {groups.length === 0 && (
              <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
                No events match the current filters
              </div>
            )}
            {groups.map(({ date, items }) => {
              const parsedDate = parseISO(date);
              const today = isToday(parsedDate);
              return (
                <div key={date}>
                  <div
                    data-date-header={date}
                    className={`sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 border-b border-border bg-muted/80 text-2xs font-semibold uppercase tracking-wider text-muted-foreground ${activeDay === date ? "ring-1 ring-inset ring-primary" : ""}`}
                  >
                    {today ? "Today — " : ""}
                    {format(parsedDate, "d MMM yyyy")}
                  </div>
                  {items.map((event) => (
                    <EventRow
                      key={event.id}
                      event={event}
                      isToday={today}
                      isHighlighted={activeDay === date}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="youtube" className="flex-1 min-h-0 overflow-y-auto">
          <div className="flex flex-col gap-3 p-3">
            {ytLoading && (
              <div className="flex items-center justify-center h-16 text-xs text-muted-foreground">
                Loading channels…
              </div>
            )}

            {ytError && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                Failed to load channels: {ytError}
              </div>
            )}

            {!ytLoading && !ytError && channelGroups.length === 0 && (
              <div className="flex items-center justify-center h-16 text-xs text-muted-foreground">
                No active channels configured
              </div>
            )}

            {!ytLoading && channelGroups.length > 0 && (
              <>
                {/* Channel dropdown */}
                <div className="flex flex-col gap-1">
                  <label className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Channel
                  </label>
                  <Select
                    value={selectedGroup === -1 ? "" : String(selectedGroup)}
                    onValueChange={(v) => handleGroupChange(Number(v))}
                  >
                    <SelectTrigger className="w-full text-xs h-8">
                      <SelectValue placeholder="Select a channel…" />
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

                {selectedGroup === -1 && (
                  <p className="text-center text-xs text-muted-foreground py-4">
                    Select a channel above to watch
                  </p>
                )}

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
                        {LANGUAGE_LABEL[s.language] ?? s.language}
                      </Button>
                    ))}
                  </div>
                )}

                {embedSrc && stream && selectedGroup !== -1 && (
                  <>
                    <div className="w-full overflow-hidden rounded-md border border-border bg-black">
                      <div className="aspect-video">
                        <iframe
                          key={embedSrc}
                          src={embedSrc}
                          title={`${group.name} ${stream.language} live`}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="h-full w-full"
                        />
                      </div>
                    </div>
                    <p className="text-2xs text-muted-foreground text-center">
                      {group.name} · {LANGUAGE_LABEL[stream.language] ?? stream.language}
                    </p>
                  </>
                )}
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
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
  event: MapEvent;
  isToday: boolean;
  isHighlighted: boolean;
}) {
  const dot = TYPE_COLORS[event.event_type] ?? "bg-slate-500";

  return (
    <div
      className={`flex items-start gap-2.5 px-3 py-2.5 border-b border-border/50 hover:bg-muted/30 transition-colors cursor-default ${
        isHighlighted ? "bg-primary/5" : ""
      }`}
    >
      <div className="flex flex-col items-center gap-1 mt-0.5 shrink-0">
        <span className="text-base leading-none">{event.event_icon}</span>
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      </div>
      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-semibold truncate">
            {event.event_location.name}
          </span>
          <span className="shrink-0 rounded-full bg-red-500/90 px-1.5 py-0.5 text-2xs font-bold text-white leading-none">
            {event.event_count}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{event.event_label}</span>
      </div>
    </div>
  );
}
