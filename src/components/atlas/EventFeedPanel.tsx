"use client";

import { useEffect, useRef } from "react";
import { format, isToday, parseISO } from "date-fns";
import { ChevronRight } from "lucide-react";
import type { MapEvent } from "@/data/index";

const TYPE_COLORS: Record<string, string> = {
  security_incident: "bg-amber-500",
  airstrike:         "bg-red-500",
  protest:           "bg-blue-500",
  humanitarian:      "bg-emerald-500",
  infrastructure:    "bg-purple-500",
  political:         "bg-indigo-500",
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
  const groups = groupByDate(events);

  useEffect(() => {
    if (!activeDay || !scrollRef.current) return;
    const el = scrollRef.current.querySelector<HTMLElement>(
      `[data-date-header="${activeDay}"]`
    );
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeDay]);

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-l border-border bg-card transition-all duration-200 ${
        open ? "w-72" : "w-14"
      }`}
    >
      {/* Header with toggle */}
      <div className="flex h-14 shrink-0 items-center border-b border-border px-3 gap-2">
        <button
          onClick={() => onOpenChange(!open)}
          className={`flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ${
            open ? "" : "mx-auto"
          }`}
          aria-label={open ? "Close event feed" : "Open event feed"}
        >
          <ChevronRight
            className={`h-4 w-4 transition-transform duration-200 ${open ? "" : "rotate-180"}`}
          />
        </button>
        {open && (
          <>
            <span className="text-sm font-semibold">Live Feed</span>
            <span className="ml-auto text-[11px] text-muted-foreground">
              {events.length} event{events.length !== 1 ? "s" : ""}
            </span>
          </>
        )}
      </div>

      {/* Collapsed: vertical label */}
      {!open && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4">
          <span
            className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground select-none"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            Live Feed
          </span>
        </div>
      )}

      {/* Scrollable list */}
      {open && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
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
                  className={`sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 border-b border-border bg-muted/80 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground ${activeDay === date ? "ring-1 ring-inset ring-primary" : ""}`}
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
      )}
    </aside>
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
          <span className="shrink-0 rounded-full bg-red-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
            {event.event_count}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">{event.event_label}</span>
      </div>
    </div>
  );
}
