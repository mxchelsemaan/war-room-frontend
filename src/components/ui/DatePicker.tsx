"use client";

import { useState, useEffect } from "react";
import { format, parseISO, subHours, subDays, subWeeks, subMonths } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { DATE_PRESETS } from "@/lib/datePresets";

type DateMode = "single" | "range" | "dynamic";
type CustomUnit = "hours" | "days" | "weeks" | "months";

export interface DatePickerProps {
  dateFrom: string;
  dateTo: string;
  onChange: (from: string, to: string) => void;
  /** Columns for the quick-preset grid. Default 3. */
  presetColumns?: number;
  /** Number of months to show in range mode. Default 1. */
  numberOfMonths?: number;
}

function toDate(iso: string): Date | undefined {
  return iso ? parseISO(iso) : undefined;
}

function fmt(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

const today = new Date();
today.setHours(23, 59, 59, 999);

export function DatePicker({
  dateFrom,
  dateTo,
  onChange,
  presetColumns = 3,
  numberOfMonths = 1,
}: DatePickerProps) {
  const [mode, setMode] = useState<DateMode>("range");
  const [singleDate, setSingleDate] = useState<Date | undefined>(undefined);
  const [customN, setCustomN] = useState(7);
  const [customUnit, setCustomUnit] = useState<CustomUnit>("days");
  const [customComplete, setCustomComplete] = useState(false);
  const [dynamicPreset, setDynamicPreset] = useState("");
  const [pendingSlot, setPendingSlot] = useState<"from" | "to" | null>(null);

  const from = toDate(dateFrom);
  const to = toDate(dateTo);
  const rangeSelected: DateRange = { from, to };

  function handleRangeSelect(range: DateRange | undefined) {
    if (!range) { onChange("", ""); return; }
    // If one slot was cleared, fill only that slot with the clicked date
    if (pendingSlot) {
      const clicked = range.from ?? range.to;
      if (clicked) {
        if (pendingSlot === "from") {
          onChange(fmt(clicked), dateTo);
        } else {
          onChange(dateFrom, fmt(clicked));
        }
      }
      setPendingSlot(null);
      return;
    }
    let { from: f, to: t } = range;
    // auto-swap if end before start
    if (f && t && t < f) { const tmp = f; f = t; t = tmp; }
    // no zero-length ranges → drop the end to make it open-ended
    if (f && t && fmt(f) === fmt(t)) t = undefined;
    setDynamicPreset("");
    onChange(f ? fmt(f) : "", t ? fmt(t) : "");
  }

  function applyCustomRange(n: number, unit: CustomUnit, complete: boolean) {
    const now = new Date();
    const start =
      unit === "hours"  ? subHours(now, n)
      : unit === "days"   ? subDays(now, n)
      : unit === "weeks"  ? subWeeks(now, n)
      : subMonths(now, n);
    const end = complete ? subDays(now, 1) : now;
    setDynamicPreset("custom");
    onChange(fmt(start), fmt(end));
  }

  function clearDates() {
    setDynamicPreset("");
    setPendingSlot(null);
    onChange("", "");
  }

  const modeBtn = (m: DateMode, label: string) => (
    <button
      onClick={() => setMode(m)}
      className={`text-xs px-2.5 py-0.5 rounded transition-colors ${
        mode === m
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );

  useEffect(() => {
    // keep singleDate in sync when dateFrom changes externally
    if (mode === "single") {
      setSingleDate(from);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom]);

  return (
    <div className="flex flex-col gap-2">
      {/* Mode toggle + clear */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-muted rounded-md p-0.5">
          {modeBtn("single", "Single")}
          {modeBtn("range", "Range")}
          {modeBtn("dynamic", "Quick")}
        </div>
        {(dateFrom || dateTo) && (
          <button
            onClick={clearDates}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear dates
          </button>
        )}
      </div>

      {/* Single — exact date match */}
      {mode === "single" && (
        <Calendar
          mode="single"
          selected={singleDate}
          onSelect={(day) => {
            setSingleDate(day);
            setDynamicPreset("");
            // store as dateFrom only; dateTo empty signals "= X" exact match
            onChange(day ? fmt(day) : "", "");
          }}
          disabled={{ after: today }}
          numberOfMonths={numberOfMonths}
          classNames={{ root: "w-full" }}
        />
      )}

      {/* Range — open-ended supported, hover preview built-in */}
      {mode === "range" && (
        <>
          {/* From / To chips */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">From</span>
            {dateFrom ? (
              <span className="flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-primary-foreground">
                {format(parseISO(dateFrom), "d MMM yyyy")}
                <button
                  onClick={() => { onChange("", dateTo); setPendingSlot("from"); }}
                  className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                  aria-label="Clear start date"
                >×</button>
              </span>
            ) : (
              <span className={`italic px-2 py-0.5 rounded-md border transition-colors ${
                pendingSlot === "from" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
              }`}>pick date…</span>
            )}
            <span className="text-muted-foreground">→</span>
            <span className="text-muted-foreground">To</span>
            {dateTo ? (
              <span className="flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-primary-foreground">
                {format(parseISO(dateTo), "d MMM yyyy")}
                <button
                  onClick={() => { onChange(dateFrom, ""); setPendingSlot("to"); }}
                  className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                  aria-label="Clear end date"
                >×</button>
              </span>
            ) : (
              <span className={`italic px-2 py-0.5 rounded-md border transition-colors ${
                pendingSlot === "to" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
              }`}>pick date…</span>
            )}
          </div>
          <Calendar
            mode="range"
            selected={rangeSelected}
            onSelect={handleRangeSelect}
            disabled={{ after: today }}
            numberOfMonths={numberOfMonths}
            classNames={{
              root: "w-full",
              // suppress the right-half gradient when there's no end date yet
              ...(!rangeSelected.to ? { range_start: "" } : {}),
            }}
          />
        </>
      )}

      {/* Quick */}
      {mode === "dynamic" && (
        <div className="flex flex-col gap-3">
          {/* Custom relative row: Last [N] complete [☐] [unit ▼] */}
          <div className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors ${
            dynamicPreset === "custom"
              ? "border-primary bg-primary/5"
              : "border-border bg-background"
          }`}>
            <span className="text-xs font-medium text-foreground">Last</span>
            <input
              type="number"
              min={1}
              max={9999}
              value={customN}
              onChange={(e) => {
                const n = Math.max(1, parseInt(e.target.value, 10) || 1);
                setCustomN(n);
                applyCustomRange(n, customUnit, customComplete);
              }}
              className="w-14 rounded-md border border-border bg-background px-2 py-1 text-xs tabular-nums text-foreground outline-none focus:ring-2 focus:ring-ring transition-colors"
            />
            <label className="flex cursor-pointer items-center gap-1.5">
              <span className="text-xs text-muted-foreground">complete</span>
              <input
                type="checkbox"
                checked={customComplete}
                onChange={(e) => {
                  const c = e.target.checked;
                  setCustomComplete(c);
                  applyCustomRange(customN, customUnit, c);
                }}
                className="h-3.5 w-3.5 accent-primary"
              />
            </label>
            <select
              value={customUnit}
              onChange={(e) => {
                const unit = e.target.value as CustomUnit;
                setCustomUnit(unit);
                applyCustomRange(customN, unit, customComplete);
              }}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring transition-colors"
            >
              <option value="hours">hours</option>
              <option value="days">days</option>
              <option value="weeks">weeks</option>
              <option value="months">months</option>
            </select>
          </div>

          {/* Quick presets */}
          <div className={`grid gap-1.5`} style={{ gridTemplateColumns: `repeat(${presetColumns}, minmax(0, 1fr))` }}>
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.key}
                onClick={() => {
                  const range = preset.getRange();
                  setDynamicPreset(preset.key);
                  onChange(range.from, range.to);
                }}
                className={`rounded-md border px-2 py-1.5 text-xs text-left transition-colors ${
                  dynamicPreset === preset.key
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-foreground hover:bg-muted"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
