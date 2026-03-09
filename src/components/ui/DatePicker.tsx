
import { useState, useEffect } from "react";
import { format, parseISO, subHours, subDays, subWeeks, subMonths } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { DATE_PRESETS } from "@/lib/datePresets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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
  /** Optional label rendered at the start of the mode-toggle row. */
  label?: React.ReactNode;
  /** Optional formatted date label shown on its own row below the mode toggle. */
  dateLabel?: string | null;
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
  label,
  dateLabel,
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
      <div className="flex items-center justify-between gap-2">
        {label && <div className="shrink-0">{label}</div>}
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(v) => { if (v) setMode(v as DateMode); }}
          className="bg-muted rounded-md p-0.5"
        >
          <ToggleGroupItem value="single" className="text-xs px-2.5 py-0.5 h-auto rounded data-[state=on]:bg-card data-[state=on]:text-foreground">Single</ToggleGroupItem>
          <ToggleGroupItem value="range" className="text-xs px-2.5 py-0.5 h-auto rounded data-[state=on]:bg-card data-[state=on]:text-foreground">Range</ToggleGroupItem>
          <ToggleGroupItem value="dynamic" className="text-xs px-2.5 py-0.5 h-auto rounded data-[state=on]:bg-card data-[state=on]:text-foreground">Quick</ToggleGroupItem>
        </ToggleGroup>
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" className="h-auto px-1 py-0 text-xs text-muted-foreground hover:text-foreground" onClick={clearDates}>
            Clear dates
          </Button>
        )}
      </div>

      {/* Selected date display */}
      {dateLabel && (
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-primary font-medium">
            {dateLabel}
          </span>
          <button
            onClick={clearDates}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear dates"
          >×</button>
        </div>
      )}

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
          <div className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 transition-colors ${
            dynamicPreset === "custom"
              ? "border-primary bg-primary/5"
              : "border-border bg-background"
          }`}>
            <span className="text-xs font-medium text-foreground">Last</span>
            <Input
              type="number"
              min={1}
              max={9999}
              value={customN}
              onChange={(e) => {
                const n = Math.max(1, parseInt(e.target.value, 10) || 1);
                setCustomN(n);
                applyCustomRange(n, customUnit, customComplete);
              }}
              className="w-12 h-7 px-1.5 py-1 text-xs tabular-nums"
            />
            <label className="flex cursor-pointer items-center gap-1.5">
              <span className="text-xs text-muted-foreground">complete</span>
              <Checkbox
                checked={customComplete}
                onCheckedChange={(c) => {
                  const checked = !!c;
                  setCustomComplete(checked);
                  applyCustomRange(customN, customUnit, checked);
                }}
                className="size-3.5"
              />
            </label>
            <Select
              value={customUnit}
              onValueChange={(v) => {
                const unit = v as CustomUnit;
                setCustomUnit(unit);
                applyCustomRange(customN, unit, customComplete);
              }}
            >
              <SelectTrigger className="h-7 w-auto px-2 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hours">hours</SelectItem>
                <SelectItem value="days">days</SelectItem>
                <SelectItem value="weeks">weeks</SelectItem>
                <SelectItem value="months">months</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quick presets */}
          <div className={`grid gap-1.5`} style={{ gridTemplateColumns: `repeat(${presetColumns}, minmax(0, 1fr))` }}>
            {DATE_PRESETS.map((preset) => (
              <Button
                key={preset.key}
                variant={dynamicPreset === preset.key ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  const range = preset.getRange();
                  setDynamicPreset(preset.key);
                  onChange(range.from, range.to);
                }}
                className={`justify-start text-xs ${
                  dynamicPreset === preset.key
                    ? "bg-foreground text-background hover:bg-foreground/90"
                    : "bg-muted/50 hover:bg-muted"
                }`}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
