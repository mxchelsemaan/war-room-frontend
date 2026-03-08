"use client";

import { useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { Pause, Play } from "lucide-react";

const AUTOPLAY_MS = 900;

interface TimelineScrubberProps {
  /** Sorted unique ISO date strings (yyyy-MM-dd) — length ≥ 2 guaranteed by parent */
  dates: string[];
  /** Currently displayed day. null = show all days in range */
  activeDay: string | null;
  onChange: (day: string | null) => void;
}

export function TimelineScrubber({ dates, activeDay, onChange }: TimelineScrubberProps) {
  const idx = activeDay ? Math.max(0, dates.indexOf(activeDay)) : 0;
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    let current = activeDay ? Math.max(0, dates.indexOf(activeDay)) : 0;
    // If already at the last day, restart from beginning
    if (current >= dates.length - 1) {
      current = 0;
      onChange(dates[0]);
    }
    intervalRef.current = setInterval(() => {
      current += 1;
      if (current >= dates.length) {
        setPlaying(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }
      onChange(dates[current]);
    }, AUTOPLAY_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // Stop if the set of dates changes (filter change)
  useEffect(() => { setPlaying(false); }, [dates]);

  function togglePlay() {
    if (!activeDay) onChange(dates[0]);
    setPlaying((p) => !p);
  }

  // How many tick labels to show (avoid overcrowding)
  const maxLabels = 9;
  const step = Math.max(1, Math.ceil(dates.length / maxLabels));

  return (
    <div className="absolute bottom-4 left-4 right-4 z-[1001] pointer-events-none flex justify-center">
      <div className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-border bg-background/90 backdrop-blur-md shadow-xl px-5 pt-3 pb-2">

        {/* Header row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {/* Play / Pause */}
            <button
              onClick={togglePlay}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-80 transition-opacity shrink-0"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 translate-x-px" />}
            </button>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Timeline
            </span>
            {activeDay ? (
              <span className="rounded-md bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                {format(parseISO(activeDay), "d MMMM yyyy")}
              </span>
            ) : (
              <span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">
                All {dates.length} days
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {format(parseISO(dates[0]), "d MMM")}
              &thinsp;–&thinsp;
              {format(parseISO(dates[dates.length - 1]), "d MMM yyyy")}
            </span>
            {activeDay && (
              <button
                onClick={() => { setPlaying(false); onChange(null); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Show all
              </button>
            )}
          </div>
        </div>

        {/* Slider */}
        <input
          type="range"
          min={0}
          max={dates.length - 1}
          value={idx}
          onChange={(e) => { setPlaying(false); onChange(dates[parseInt(e.target.value, 10)]); }}
          className="w-full accent-primary cursor-pointer"
          style={{ height: "4px" }}
        />

        {/* Tick labels */}
        <div className="relative mt-1 h-5">
          {dates.map((date, i) => {
            const show = i === 0 || i === dates.length - 1 || i % step === 0;
            if (!show) return null;
            const pct = (i / (dates.length - 1)) * 100;
            const isActive = date === activeDay;
            return (
              <button
                key={date}
                onClick={() => { setPlaying(false); onChange(date); }}
                style={{ position: "absolute", left: `${pct}%`, transform: "translateX(-50%)" }}
                className={`text-[10px] whitespace-nowrap transition-colors leading-none ${
                  isActive ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {format(parseISO(date), "d MMM")}
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}
