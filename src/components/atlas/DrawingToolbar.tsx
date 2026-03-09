import { useState } from "react";
import { Pencil, MapPin, Spline, Pentagon, MoveRight, Crosshair, X, Minus, Map as MapIcon, Layers } from "lucide-react";
import { Sparkles } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { CollapsePanel, FloatingTriggerBtn } from "./FloatingPanel";
import { ColorPickerButton } from "./ColorPickerPopover";
import { Button } from "@/components/ui/button";
import type { AnnotationType, ArrowStyle } from "@/hooks/useDrawing";
import { DRAW_COLOR_PRESETS } from "@/hooks/useDrawing";
import { Slider } from "@/components/ui/slider";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { ToggleChip } from "@/components/ui/ToggleChip";
import { natoMiniSVG } from "@/lib/natoSymbols";
import type { NATOUnitType } from "@/types/units";
import { SavedItemsContent } from "./SavedItemsPanel";

interface DrawingToolbarProps {
  mode: AnnotationType | null;
  color: string;
  drawWidth: number;
  drawArrowStyle: ArrowStyle;
  open: boolean;
  onToggle: () => void;
  onStartDrawing: (mode: AnnotationType) => void;
  onSetColor: (color: string) => void;
  onSetWidth: (width: number) => void;
  onSetArrowStyle: (style: ArrowStyle) => void;
  onCancel: () => void;
  drawGlow: boolean;
  drawDash: boolean;
  drawFloat: boolean;
  onSetDrawGlow: (v: boolean) => void;
  onSetDrawDash: (v: boolean) => void;
  onSetDrawFloat: (v: boolean) => void;
  // Unit placement
  placementMode: NATOUnitType | null;
  pendingColor: string;
  pathDrawingUnitId: string | null;
  onStartPlacement: (type: NATOUnitType) => void;
  onCancelPlacement: () => void;
  onSetPendingColor: (color: string) => void;
  showLabels?: boolean;
}

const MODE_STATUS: Record<AnnotationType, string> = {
  pin:   "Click map to place pin",
  line:  "Click to add points · double-click to finish",
  arrow: "Click to add points · double-click to finish",
  area:  "Click to add points · double-click to close",
};

const MODE_LABEL: Record<AnnotationType, string> = {
  pin: "Pin", line: "Line", arrow: "Arrow", area: "Area",
};

const TYPE_ICON: Record<AnnotationType, React.ReactNode> = {
  pin:   <MapPin    className="size-4" />,
  line:  <Spline    className="size-4" />,
  arrow: <MoveRight className="size-4" />,
  area:  <Pentagon  className="size-4" />,
};

const GROUND_TYPES: NATOUnitType[] = ["infantry", "armor", "artillery", "mechanized", "hq"];
const AIR_SEA_TYPES: NATOUnitType[] = ["fighter", "helicopter", "warship", "submarine"];

const UNIT_SHORT_LABELS: Record<NATOUnitType, string> = {
  infantry: "Inf", armor: "Arm", artillery: "Art", mechanized: "Mec", hq: "HQ",
  fighter: "Ftr", helicopter: "Hel", warship: "War", submarine: "Sub",
};
const UNIT_FULL_LABELS: Record<NATOUnitType, string> = {
  infantry: "Infantry", armor: "Armor", artillery: "Artillery", mechanized: "Mechanized", hq: "HQ",
  fighter: "Fighter", helicopter: "Helicopter", warship: "Warship", submarine: "Submarine",
};

/* ── Main component ────────────────────────────────────────── */

export function DrawingToolbar({
  mode, color, drawWidth, drawArrowStyle, open, onToggle,
  onStartDrawing, onSetColor, onSetWidth, onSetArrowStyle, onCancel,
  drawGlow, drawDash, drawFloat,
  onSetDrawGlow, onSetDrawDash, onSetDrawFloat,
  placementMode, pendingColor, pathDrawingUnitId,
  onStartPlacement, onCancelPlacement, onSetPendingColor,
  showLabels,
}: DrawingToolbarProps) {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<'tools' | 'saved'>('tools');
  const drawTypes = (isMobile ? ["pin"] : ["pin", "line", "arrow", "area"]) as AnnotationType[];

  const activeColor = placementMode ? pendingColor : color;
  const isPinContext = mode === "pin";

  function setActiveColor(c: string) {
    if (placementMode) onSetPendingColor(c);
    else onSetColor(c);
  }

  function handleModeBtn(m: AnnotationType) {
    if (mode === m) onCancel();
    else onStartDrawing(m);
  }

  const isActive = mode !== null || placementMode !== null || pathDrawingUnitId !== null;

  const trigger = (
    <FloatingTriggerBtn
      onClick={onToggle}
      aria-label={open ? "Close annotate tools" : "Open annotate tools"}
      className={isActive ? "text-primary" : undefined}
      showLabels={showLabels}
    >
      {placementMode
        ? <Crosshair className="size-3.5" />
        : mode ? TYPE_ICON[mode] : <Pencil className="size-3.5" />}
      {"Annotate"}
    </FloatingTriggerBtn>
  );

  const panel = (
    <CollapsePanel open={open} direction="left">
      <div className="glass-panel p-3 w-80 flex flex-col gap-3 mr-1 max-h-[calc(100vh-80px)] overflow-y-auto">

        {/* ── Tab bar ── */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setActiveTab('tools')}
            className={`flex-1 py-1.5 text-[11px] font-semibold transition-colors ${
              activeTab === 'tools'
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Tools
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`flex-1 py-1.5 text-[11px] font-semibold transition-colors border-l border-border ${
              activeTab === 'saved'
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Saved
          </button>
        </div>

        {activeTab === 'saved' ? (
          /* ── Saved tab ── */
          <SavedItemsContent />
        ) : (
          /* ── Tools tab ── */
          <>
            {/* Panel 1 — Tools: Shapes + Units stacked */}
            <div className="rounded-lg border border-border/30 p-2.5 flex flex-col gap-2">
              {/* Shapes */}
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Shapes</span>
                <div className={`grid gap-1 ${drawTypes.length >= 4 ? "grid-cols-4" : "grid-cols-2"}`}>
                  {drawTypes.map((m) => (
                    <Button
                      key={m}
                      variant="ghost"
                      onClick={() => handleModeBtn(m)}
                      title={MODE_LABEL[m]}
                      className={`flex flex-col items-center justify-center gap-1.5 h-auto py-2.5 text-[10px] font-medium ${
                        mode === m
                          ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                          : "text-muted-foreground"
                      }`}
                    >
                      {TYPE_ICON[m]}
                      <span>{MODE_LABEL[m]}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <hr className="border-border/30" />

              {/* Units */}
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Units</span>
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Ground</span>
                  <div className="grid grid-cols-5 gap-1">
                    {GROUND_TYPES.map((type) => (
                      <Button
                        key={type}
                        variant="ghost"
                        onClick={() => placementMode === type ? onCancelPlacement() : onStartPlacement(type)}
                        title={UNIT_FULL_LABELS[type]}
                        className={`flex flex-col items-center justify-center gap-1 h-auto py-2 text-[10px] font-medium ${
                          placementMode === type
                            ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                            : "text-muted-foreground"
                        }`}
                      >
                        <span dangerouslySetInnerHTML={{ __html: natoMiniSVG(type, placementMode === type ? "#60a5fa" : "#000000", placementMode === type ? "#1a1a2e" : "#ffffff") }} />
                        <span>{UNIT_SHORT_LABELS[type]}</span>
                      </Button>
                    ))}
                  </div>
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mt-1">Air &amp; Sea</span>
                  <div className="grid grid-cols-4 gap-1">
                    {AIR_SEA_TYPES.map((type) => (
                      <Button
                        key={type}
                        variant="ghost"
                        onClick={() => placementMode === type ? onCancelPlacement() : onStartPlacement(type)}
                        title={UNIT_FULL_LABELS[type]}
                        className={`flex flex-col items-center justify-center gap-1 h-auto py-2 text-[10px] font-medium ${
                          placementMode === type
                            ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                            : "text-muted-foreground"
                        }`}
                      >
                        <span dangerouslySetInnerHTML={{ __html: natoMiniSVG(type, placementMode === type ? "#60a5fa" : "#000000", placementMode === type ? "#1a1a2e" : "#ffffff") }} />
                        <span>{UNIT_SHORT_LABELS[type]}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Panel 2 — Style: Color + Width stacked */}
            <div className="rounded-lg border border-border/30 p-2.5 flex flex-col gap-2">
              {/* Color */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Color</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {DRAW_COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setActiveColor(c)}
                      style={{
                        background: c,
                        outline: activeColor === c ? `2px solid ${c}` : undefined,
                        outlineOffset: activeColor === c ? "2px" : undefined,
                        opacity: activeColor === c ? 1 : 0.55,
                      }}
                      className="size-5 rounded-full transition-all hover:opacity-100 hover:scale-110"
                      title={c}
                    />
                  ))}
                  <ColorPickerButton color={activeColor} onChange={setActiveColor} />
                </div>
              </div>

              {/* Width slider — not for pins or unit placement */}
              {!isPinContext && !placementMode && (
                <>
                  <hr className="border-border/30" />
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Width</span>
                      <span className="text-[11px] font-medium text-foreground tabular-nums">{drawWidth}</span>
                    </div>
                    <Slider
                      min={1}
                      max={12}
                      step={1}
                      value={[drawWidth]}
                      onValueChange={([v]) => onSetWidth(v)}
                    />
                  </div>
                </>
              )}
            </div>

            {/* ── Toggle strip ── */}
            {!placementMode && (
              <div className="flex items-stretch rounded-lg border border-border overflow-hidden">
                {!isPinContext && (
                  <ToggleChip
                    active={drawFloat}
                    onClick={() => onSetDrawFloat(!drawFloat)}
                    activeClass="text-violet-300 bg-violet-400/10"
                    icon={drawFloat ? <Layers className="size-3" /> : <MapIcon className="size-3" />}
                    label={drawFloat ? "Float" : "Map"}
                    title={drawFloat ? "Switch to on-map (drapes terrain)" : "Switch to float (SVG overlay)"}
                  />
                )}
                <ToggleChip
                  active={drawGlow}
                  onClick={() => onSetDrawGlow(!drawGlow)}
                  activeClass="text-yellow-300 bg-yellow-400/10"
                  icon={<Sparkles className="size-3" />}
                  label="Glow"
                  title="Toggle glow effect"
                />
                {!isPinContext && (
                  <ToggleChip
                    active={drawDash}
                    onClick={() => onSetDrawDash(!drawDash)}
                    activeClass="text-sky-300 bg-sky-400/10"
                    icon={<Minus className="size-3" />}
                    label="Dash"
                    title="Toggle dashed"
                  />
                )}
              </div>
            )}

            {/* ── Arrow style toggle ── */}
            {mode === "arrow" && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Arrow style</span>
                <SegmentedToggle
                  value={drawArrowStyle}
                  onChange={onSetArrowStyle}
                  options={[
                    { value: "simple" as const, label: "Simple →" },
                    { value: "jagged" as const, label: "Jagged ⟹" },
                  ]}
                />
              </div>
            )}

            {/* ── Active draw hint ── */}
            {mode && (
              <div className="rounded-lg bg-amber-400/10 border border-amber-400/20 px-3 py-2 flex items-start gap-2">
                <span className="size-1.5 rounded-full bg-amber-400 animate-pulse mt-1 shrink-0" />
                <p className="text-[11px] leading-snug text-amber-400/90">{MODE_STATUS[mode]}</p>
              </div>
            )}

            {/* ── Active unit/path hints ── */}
            {placementMode && (
              <div className="rounded-lg bg-amber-400/10 border border-amber-400/20 px-3 py-2 flex items-start gap-2">
                <span className="size-1.5 rounded-full bg-amber-400 animate-pulse mt-1 shrink-0" />
                <p className="text-[11px] leading-snug text-amber-400/90">
                  Click map to place {UNIT_FULL_LABELS[placementMode]}
                  {" "}
                  <button
                    className="underline text-amber-300 hover:text-amber-200"
                    onClick={onCancelPlacement}
                  >
                    Cancel
                  </button>
                </p>
              </div>
            )}
            {pathDrawingUnitId && (
              <div className="rounded-lg bg-amber-400/10 border border-amber-400/20 px-3 py-2 flex items-start gap-2">
                <span className="size-1.5 rounded-full bg-amber-400 animate-pulse mt-1 shrink-0" />
                <p className="text-[11px] leading-snug text-amber-400/90">
                  Click map to add waypoints · Double-click or Esc to finish
                </p>
              </div>
            )}

            {/* ── Cancel / X hint ── */}
            {(mode || placementMode) && (
              <button
                onClick={() => { if (mode) onCancel(); else onCancelPlacement(); }}
                className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors py-1"
              >
                <X className="size-3" /> Cancel active tool
              </button>
            )}
          </>
        )}
      </div>
    </CollapsePanel>
  );

  return (
    <div className="flex flex-row-reverse items-start gap-1">
      {trigger}
      {panel}
    </div>
  );
}
