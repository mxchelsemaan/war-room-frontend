import { useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { Pause, Play, RotateCcw, X } from "lucide-react";
import { CollapsePanel } from "./FloatingPanel";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { TimelineDateEntry } from "@/types/events";

const BASE_MS = 900;
const SPEEDS = [1, 2, 4] as const;
type Speed = (typeof SPEEDS)[number];

interface TimelineScrubberProps {
  dates: TimelineDateEntry[];
  activeDay: string | null;
  onChange: (day: string | null) => void;
  onPrefetchDay?: (day: string) => void;
  open: boolean;
  onToggle: () => void;
}

export function TimelineScrubber({ dates, activeDay, onChange, onPrefetchDay, open, onToggle }: TimelineScrubberProps) {
  const days = dates.map((d) => d.day);
  const maxCount = Math.max(1, ...dates.map((d) => d.count));
  const idx = activeDay ? Math.max(0, days.indexOf(activeDay)) : 0;
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [loop, setLoop] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    let current = activeDay ? Math.max(0, days.indexOf(activeDay)) : 0;
    if (current >= days.length - 1) {
      current = 0;
      onChange(days[0]);
    }
    intervalRef.current = setInterval(() => {
      current += 1;
      if (current >= days.length) {
        if (loop) {
          current = 0;
          onChange(days[0]);
        } else {
          setPlaying(false);
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
        return;
      }
      onChange(days[current]);
      // Pre-fetch next 2-3 days ahead during playback
      if (onPrefetchDay) {
        for (let ahead = 1; ahead <= 3; ahead++) {
          const futureIdx = current + ahead;
          if (futureIdx < days.length) {
            onPrefetchDay(days[futureIdx]);
          }
        }
      }
    }, BASE_MS / speed);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, loop]);

  useEffect(() => { setPlaying(false); }, [dates]);

  function togglePlay() {
    if (!activeDay) onChange(days[0]);
    setPlaying((p) => {
      if (!p && !open) onToggle();
      return !p;
    });
  }

  function cycleSpeed() {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
  }

  const maxLabels = isMobile ? 5 : 9;
  const step = Math.max(1, Math.ceil(days.length / maxLabels));

  return (
    <div className="absolute bottom-6 left-0 right-0 z-20 pointer-events-none flex justify-center px-3 md:px-0">
      <div className={`pointer-events-auto flex flex-col items-center gap-0 w-full max-w-[calc(100vw-1.5rem)] md:max-w-[40rem]`}>

        {/* Expanded panel — slides up from above the button */}
        <CollapsePanel open={open} className="w-full">
          <div className="w-full">
            <div className="glass-panel mb-1.5 p-3">
              {/* Controls row */}
              <div className="flex items-center gap-2 mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cycleSpeed}
                  aria-label={`Speed ${speed}x`}
                  className="h-6 px-1.5 text-xs font-semibold"
                >
                  {speed}×
                </Button>
                <Button
                  variant={loop ? "default" : "outline"}
                  size="icon"
                  onClick={() => setLoop((l) => !l)}
                  aria-label={loop ? "Loop on" : "Loop off"}
                  className={`size-6 ${loop ? "border-primary text-primary-foreground" : ""}`}
                >
                  <RotateCcw className="size-3.5" />
                </Button>
                <span className="ml-auto text-xs text-muted-foreground">
                  {format(parseISO(days[0]), "d MMM")}
                  &thinsp;–&thinsp;
                  {format(parseISO(days[days.length - 1]), "d MMM yyyy")}
                </span>
                {activeDay && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setPlaying(false); onChange(null); }}
                    className="h-auto px-1 py-0 text-xs text-destructive/70 hover:text-destructive"
                  >
                    Clear
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setPlaying(false); onToggle(); }}
                  aria-label="Close timeline"
                  className="size-6"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
              {/* Density bars + slider */}
              <div className="px-2">
              {/* Density visualization */}
              <div className="flex items-end gap-px h-6 mb-1">
                {dates.map((entry, i) => {
                  const height = Math.max(2, (entry.count / maxCount) * 24);
                  const isActive = entry.day === activeDay;
                  return (
                    <div
                      key={entry.day}
                      className={`flex-1 rounded-t-sm transition-colors ${
                        isActive ? "bg-primary" : "bg-muted-foreground/30"
                      }`}
                      style={{ height: `${height}px`, minWidth: 1 }}
                      title={`${entry.day}: ${entry.count} events`}
                      onClick={() => { setPlaying(false); onChange(days[i]); }}
                    />
                  );
                })}
              </div>
              <Slider
                min={0}
                max={days.length - 1}
                step={1}
                value={[idx]}
                onValueChange={([v]) => { setPlaying(false); onChange(days[v]); }}
                className={`w-full ${isMobile ? "h-11" : ""}`}
              />
              {/* Date labels */}
              <div className="relative mt-2 h-5">
                {days.map((date, i) => {
                  const show = i === 0 || i === days.length - 1 || i % step === 0;
                  if (!show) return null;
                  const pct = (i / (days.length - 1)) * 100;
                  const isActive = date === activeDay;
                  return (
                    <button
                      key={date}
                      onClick={() => { setPlaying(false); onChange(date); }}
                      style={{ position: "absolute", left: `calc(${pct}% + ${8 - pct / 100 * 16}px)`, transform: "translateX(-50%)" }}
                      className={`text-2xs whitespace-nowrap transition-colors leading-none ${
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
          </div>
        </CollapsePanel>

        {/* Play button — no wrapper, just the button */}
        <Button variant="default" size="icon" className="size-10 rounded-full shrink-0" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
        </Button>

      </div>
    </div>
  );
}
