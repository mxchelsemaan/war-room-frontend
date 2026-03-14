import { useCallback, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { DRAW_COLOR_PRESETS } from "@/config/colors";

/* ── Color conversion helpers ─────────────────────────────── */

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsv(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}

const HEX_RE = /^#?([0-9a-fA-F]{6})$/;

/* ── Saturation-Value area ────────────────────────────────── */

function SatValArea({
  hue, sat, val, onChange,
}: {
  hue: number; sat: number; val: number;
  onChange: (s: number, v: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [moving, setMoving] = useState(false);

  const update = useCallback((e: { clientX: number; clientY: number }) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    onChange(s, v);
  }, [onChange]);

  useEffect(() => {
    if (!moving) return;
    const onMove = (e: PointerEvent) => update(e);
    const onUp = () => setMoving(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [moving, update]);

  return (
    <div
      ref={ref}
      className={`relative h-32 w-full rounded-lg select-none touch-none ${moving ? "cursor-grabbing" : "cursor-crosshair"}`}
      style={{
        background: `hsl(${hue}, 100%, 50%)`,
      }}
      onPointerDown={(e) => { setMoving(true); update(e); }}
    >
      {/* white → transparent (saturation) */}
      <div className="absolute inset-0 rounded-lg" style={{ background: "linear-gradient(to right, #fff, transparent)" }} />
      {/* transparent → black (value) */}
      <div className="absolute inset-0 rounded-lg" style={{ background: "linear-gradient(to top, #000, transparent)" }} />
      {/* thumb */}
      <div
        className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)] pointer-events-none transition-[width,height] duration-100 ${moving ? "size-4.5" : "size-3.5"}`}
        style={{ left: `${sat * 100}%`, top: `${(1 - val) * 100}%` }}
      />
    </div>
  );
}

/* ── Hue strip ────────────────────────────────────────────── */

function HueStrip({ hue, onChange }: { hue: number; onChange: (h: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [moving, setMoving] = useState(false);

  const update = useCallback((e: { clientX: number }) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const h = Math.max(0, Math.min(360, ((e.clientX - rect.left) / rect.width) * 360));
    onChange(h);
  }, [onChange]);

  useEffect(() => {
    if (!moving) return;
    const onMove = (e: PointerEvent) => update(e);
    const onUp = () => setMoving(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [moving, update]);

  return (
    <div
      ref={ref}
      className={`relative h-3 w-full rounded-full select-none touch-none ${moving ? "cursor-grabbing" : "cursor-pointer"}`}
      style={{
        background: "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
      }}
      onPointerDown={(e) => { setMoving(true); update(e); }}
    >
      <div
        className={`absolute -translate-x-1/2 -translate-y-[2px] rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)] pointer-events-none transition-[width,height] duration-100 ${moving ? "size-5" : "size-4"}`}
        style={{ left: `${(hue / 360) * 100}%`, background: `hsl(${hue}, 100%, 50%)` }}
      />
    </div>
  );
}

/* ── ColorPickerPopover ───────────────────────────────────── */

interface ColorPickerPopoverProps {
  color: string;
  onChange: (color: string) => void;
  children: React.ReactNode;
  side?: "left" | "top";
}

export function ColorPickerPopover({ color, onChange, children, side = "left" }: ColorPickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState<[number, number, number]>(() => hexToHsv(color));
  const [hex, setHex] = useState(color.replace("#", ""));

  // Sync state when popover opens
  function handleOpenChange(o: boolean) {
    setOpen(o);
    if (o) {
      setHsv(hexToHsv(color));
      setHex(color.replace("#", ""));
    }
  }

  function applyHsv(h: number, s: number, v: number) {
    setHsv([h, s, v]);
    const newHex = hsvToHex(h, s, v);
    setHex(newHex.replace("#", ""));
    onChange(newHex);
  }

  function commitHex(val: string) {
    const m = val.match(HEX_RE);
    if (m) {
      const normalized = `#${m[1].toLowerCase()}`;
      onChange(normalized);
      setHsv(hexToHsv(normalized));
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side={side} sideOffset={8} className="w-auto p-3">
        <div className="flex flex-col gap-3 w-48">
          {/* Preset swatches */}
          <div className="grid grid-cols-6 gap-1.5">
            {DRAW_COLOR_PRESETS.map((c) => (
              <button
                key={c}
                onClick={() => {
                  onChange(c);
                  setHsv(hexToHsv(c));
                  setHex(c.replace("#", ""));
                  setOpen(false);
                }}
                style={{ background: c }}
                className={`size-6 rounded-full transition-all ${
                  color === c
                    ? "ring-2 ring-offset-2 ring-offset-card ring-white/80"
                    : "hover:scale-110"
                }`}
              />
            ))}
          </div>

          <div className="border-t border-border" />

          {/* SV area */}
          <SatValArea
            hue={hsv[0]}
            sat={hsv[1]}
            val={hsv[2]}
            onChange={(s, v) => applyHsv(hsv[0], s, v)}
          />

          {/* Hue strip */}
          <HueStrip
            hue={hsv[0]}
            onChange={(h) => applyHsv(h, hsv[1], hsv[2])}
          />

          {/* Hex input row */}
          <div className="flex items-center gap-2">
            <span
              className="size-6 rounded-md shrink-0 border border-border"
              style={{ background: `#${hex}` }}
            />
            <div className="flex items-center gap-1 flex-1">
              <span className="text-xs text-muted-foreground">#</span>
              <input
                value={hex}
                onChange={(e) => setHex(e.target.value.replace("#", "").slice(0, 6))}
                onKeyDown={(e) => { if (e.key === "Enter") { commitHex(hex); setOpen(false); } }}
                onBlur={() => commitHex(hex)}
                className="font-mono text-xs w-full bg-background border border-border rounded px-1.5 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="ff0000"
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ── ColorPickerButton (+ icon for toolbar) ───────────────── */

export function ColorPickerButton({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  return (
    <ColorPickerPopover color={color} onChange={onChange} side="top">
      <button
        className="size-5 rounded-full border border-dashed border-muted-foreground/40 flex items-center justify-center hover:border-foreground transition-colors"
        title="Custom color"
      >
        <Plus className="size-3 text-muted-foreground" />
      </button>
    </ColorPickerPopover>
  );
}
