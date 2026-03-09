import { useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { Pause, Play, RotateCcw, X } from "lucide-react";
import { CollapsePanel } from "./FloatingPanel";
import { Button } from "@/components/ui/button";

const BASE_MS = 900;
const SPEEDS = [1, 2, 4] as const;
type Speed = (typeof SPEEDS)[number];

interface TimelineScrubberProps {
  dates: string[];
  activeDay: string | null;
  onChange: (day: string | null) => void;
  open: boolean;
  onToggle: () => void;
}

export function TimelineScrubber({ dates, activeDay, onChange, open, onToggle }: TimelineScrubberProps) {
  const idx = activeDay ? Math.max(0, dates.indexOf(activeDay)) : 0;
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [loop, setLoop] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    let current = activeDay ? Math.max(0, dates.indexOf(activeDay)) : 0;
    if (current >= dates.length - 1) {
      current = 0;
      onChange(dates[0]);
    }
    intervalRef.current = setInterval(() => {
      current += 1;
      if (current >= dates.length) {
        if (loop) {
          current = 0;
          onChange(dates[0]);
        } else {
          setPlaying(false);
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
        return;
      }
      onChange(dates[current]);
    }, BASE_MS / speed);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, loop]);

  useEffect(() => { setPlaying(false); }, [dates]);

  function togglePlay() {
    if (!activeDay) onChange(dates[0]);
    setPlaying((p) => {
      if (!p && !open) onToggle();
      return !p;
    });
  }

  function cycleSpeed() {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
  }

  const maxLabels = 9;
  const step = Math.max(1, Math.ceil(dates.length / maxLabels));

  return (
    <div className="absolute bottom-4 left-0 right-0 z-20 pointer-events-none flex justify-center">
      <div className="pointer-events-auto flex flex-col items-center gap-0 w-full" style={{ maxWidth: "40rem" }}>

        {/* Expanded panel — slides up from above the pill */}
        <CollapsePanel open={open} className="w-full">
          <div className="w-full">
            <div className="glass-panel mb-1.5 p-3">
              {/* Controls row */}
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={cycleSpeed}
                  aria-label={`Speed ${speed}x`}
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors border border-border rounded px-1.5 py-0.5"
                >
                  {speed}×
                </button>
                <button
                  onClick={() => setLoop((l) => !l)}
                  aria-label={loop ? "Loop on" : "Loop off"}
                  className={`flex items-center justify-center size-6 rounded border transition-colors ${loop ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"}`}
                >
                  <RotateCcw className="size-3.5" />
                </button>
                <span className="ml-auto text-xs text-muted-foreground">
                  {format(parseISO(dates[0]), "d MMM")}
                  &thinsp;–&thinsp;
                  {format(parseISO(dates[dates.length - 1]), "d MMM yyyy")}
                </span>
                {activeDay && (
                  <button
                    onClick={() => { setPlaying(false); onChange(null); }}
                    className="text-xs text-destructive/70 hover:text-destructive transition-colors"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={() => { setPlaying(false); onToggle(); }}
                  aria-label="Close timeline"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              {/* Slider + date labels */}
              <div className="px-2">
              <input
                type="range"
                min={0}
                max={dates.length - 1}
                value={idx}
                onChange={(e) => { setPlaying(false); onChange(dates[parseInt(e.target.value, 10)]); }}
                className="w-full accent-primary cursor-pointer"
                style={{ height: "16px" }}
              />
              {/* Date labels */}
              <div className="relative mt-2 h-5">
                {dates.map((date, i) => {
                  const show = i === 0 || i === dates.length - 1 || i % step === 0;
                  if (!show) return null;
                  const pct = (i / (dates.length - 1)) * 100;
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

        {/* Pill — always visible */}
        <div className="glass-panel flex items-center gap-2 px-2 py-1.5">
          <Button variant="default" size="icon-sm" className="rounded-full shrink-0" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5 translate-x-px" />}
          </Button>
        </div>

      </div>
    </div>
  );
}
