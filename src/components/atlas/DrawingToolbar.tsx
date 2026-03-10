import { useCallback, useEffect, useState } from "react";
import {
  Pencil, MapPin, Spline, Pentagon, MoveRight, Crosshair, X, Minus,
  Map as MapIcon, Layers, Sparkles, ArrowUpDown, Target, Circle,
  Route, Play, Pause,
} from "lucide-react";
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
import { useAnnotationContext } from "@/context/AnnotationContext";
import { useUnitPlacementContext } from "@/context/UnitPlacementContext";
import { SavedItemsContent } from "./SavedItemsPanel";
import type { SelectionSync } from "./SavedItemsPanel";

interface DrawingToolbarProps {
  open: boolean;
  onToggle: () => void;
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

export function DrawingToolbar({ open, onToggle, showLabels }: DrawingToolbarProps) {
  const ann = useAnnotationContext();
  const up = useUnitPlacementContext();
  const isMobile = useIsMobile();
  const drawTypes = (isMobile ? ["pin"] : ["pin", "line", "arrow", "area"]) as AnnotationType[];

  const { mode, color, drawWidth, drawArrowStyle, drawGlow, drawDash, drawFloat } = ann;
  const { placementMode, pendingColor, pathDrawingUnitId } = up;

  // Selection from saved items list
  const [selection, setSelection] = useState<SelectionSync>(null);

  const handleSelectionChange = useCallback((sel: SelectionSync) => {
    setSelection(sel);
  }, []);

  // Derive active values — selection overrides creation defaults
  const hasSel = selection !== null;
  const activeColor = hasSel
    ? (selection.kind === "ann" ? selection.ann.color : selection.unit.color)
    : (placementMode ? pendingColor : color);

  const activeWidth = hasSel && selection.kind === "ann"
    ? selection.ann.width
    : drawWidth;

  const activeGlow = hasSel && selection.kind === "ann" ? selection.ann.glow : drawGlow;
  const activeDash = hasSel && selection.kind === "ann" ? selection.ann.dash : drawDash;
  const activeFloat = hasSel && selection.kind === "ann" ? selection.ann.float : drawFloat;

  // Is this a pin context (creation or selected pin)?
  const isPinContext = hasSel && selection.kind === "ann"
    ? selection.ann.type === "pin"
    : mode === "pin";

  // Should we show width/toggles? Not for unit selection or pin mode
  const showWidthSlider = !(hasSel && selection.kind === "unit") && !placementMode && !isPinContext;
  const showToggleStrip = !(hasSel && selection.kind === "unit") && !placementMode;

  function setActiveColor(c: string) {
    if (hasSel) {
      selection.setColor(c);
    } else if (placementMode) {
      up.setPendingColor(c);
    } else {
      ann.setColor(c);
    }
  }

  function setActiveWidth(w: number) {
    if (hasSel && selection.kind === "ann") {
      selection.setWidth(w);
    } else {
      ann.setDrawWidth(w);
    }
  }

  function toggleActiveGlow() {
    if (hasSel && selection.kind === "ann") selection.toggleGlow();
    else ann.setDrawGlow(!drawGlow);
  }

  function toggleActiveDash() {
    if (hasSel && selection.kind === "ann") selection.toggleDash();
    else ann.setDrawDash(!drawDash);
  }

  function toggleActiveFloat() {
    if (hasSel && selection.kind === "ann") selection.toggleFloat();
    else ann.setDrawFloat(!drawFloat);
  }

  function handleModeBtn(m: AnnotationType) {
    if (mode === m) ann.cancel();
    else ann.startDrawing(m);
  }

  function handleStartPlacement(type: NATOUnitType) {
    ann.cancel();
    up.startPlacement(type);
  }

  const isActive = mode !== null || placementMode !== null || pathDrawingUnitId !== null;

  // ── Context section: name editor ──
  const [editName, setEditName] = useState("");
  useEffect(() => {
    if (selection?.kind === "ann") setEditName(selection.ann.label);
    else if (selection?.kind === "unit") setEditName(selection.unit.label);
    else setEditName("");
  }, [selection?.kind === "ann" ? selection.ann.id : null, selection?.kind === "unit" ? selection.unit.id : null]);

  function commitName() {
    const trimmed = editName.trim();
    if (selection?.kind === "ann") {
      selection.rename(trimmed || selection.ann.label);
    } else if (selection?.kind === "unit") {
      selection.updateUnit({ label: trimmed || selection.unit.label });
    }
  }

  const trigger = (
    <FloatingTriggerBtn
      onClick={onToggle}
      aria-label={open ? "Close annotate tools" : "Open annotate tools"}
      className={isActive ? "text-primary" : undefined}
      showLabels={showLabels}
      open={open}
      panelSide="left"
    >
      {placementMode
        ? <Crosshair className="size-3.5" />
        : mode ? TYPE_ICON[mode] : <Pencil className="size-3.5" />}
      {"Annotate"}
    </FloatingTriggerBtn>
  );

  const panel = (
    <div className={`absolute top-1/2 -translate-y-1/2 right-full mr-2 w-96${open ? "" : " pointer-events-none"}`}>
      <CollapsePanel open={open} direction="left">
        <div className="glass-panel p-3 flex flex-col gap-3 max-h-[calc(100vh-14rem)] overflow-y-auto">

        {/* ── [A] Tool Picker: Shapes + Units ── */}
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
                    onClick={() => placementMode === type ? up.cancelPlacement() : handleStartPlacement(type)}
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
                    onClick={() => placementMode === type ? up.cancelPlacement() : handleStartPlacement(type)}
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

        {/* ── [B] Unified Style: Color + Width + Toggles ── */}
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

          {/* Width slider */}
          {showWidthSlider && (
            <>
              <hr className="border-border/30" />
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Width</span>
                  <span className="text-[11px] font-medium text-foreground tabular-nums">{activeWidth}</span>
                </div>
                <Slider
                  min={1}
                  max={12}
                  step={1}
                  value={[activeWidth]}
                  onValueChange={([v]) => setActiveWidth(v)}
                />
              </div>
            </>
          )}
        </div>

        {/* ── Toggle strip (annotations only) ── */}
        {showToggleStrip && (
          <div className="flex items-stretch rounded-lg border border-border overflow-hidden">
            {!isPinContext && (
              <ToggleChip
                active={activeFloat}
                onClick={toggleActiveFloat}
                activeClass="text-violet-300 bg-violet-400/10"
                icon={activeFloat ? <Layers className="size-3" /> : <MapIcon className="size-3" />}
                label={activeFloat ? "Float" : "Map"}
                title={activeFloat ? "Switch to on-map (drapes terrain)" : "Switch to float (SVG overlay)"}
              />
            )}
            <ToggleChip
              active={activeGlow}
              onClick={toggleActiveGlow}
              activeClass="text-yellow-300 bg-yellow-400/10"
              icon={<Sparkles className="size-3" />}
              label="Glow"
              title="Toggle glow effect"
            />
            {!isPinContext && (
              <ToggleChip
                active={activeDash}
                onClick={toggleActiveDash}
                activeClass="text-sky-300 bg-sky-400/10"
                icon={<Minus className="size-3" />}
                label="Dash"
                title="Toggle dashed"
              />
            )}
          </div>
        )}

        {/* ── Arrow style toggle ── */}
        {mode === "arrow" && !hasSel && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Arrow style</span>
            <SegmentedToggle
              value={drawArrowStyle}
              onChange={ann.setDrawArrowStyle}
              options={[
                { value: "simple" as ArrowStyle, label: "Simple →" },
                { value: "jagged" as ArrowStyle, label: "Jagged ⟹" },
              ]}
            />
          </div>
        )}

        {/* ── [C] Context Section (selected item details) ── */}
        {selection && (
          <div className="rounded-lg border border-border/30 p-2.5 flex flex-col gap-3">
            {/* Name input */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Name</span>
              <input
                value={editName}
                placeholder={selection.kind === "unit" ? "Unit name" : "unnamed"}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commitName(); }}
                onBlur={commitName}
                className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Unit-specific controls */}
            {selection.kind === "unit" && (
              <>
                {/* Bearing */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Bearing</span>
                    <span className="text-[11px] font-medium tabular-nums">{selection.unit.bearing}°</span>
                  </div>
                  {up.rotatingUnitId === selection.unit.id ? (
                    <div className="rounded-lg bg-amber-400/10 border border-amber-400/20 px-3 py-2 flex items-start gap-2">
                      <span className="size-1.5 rounded-full bg-amber-400 animate-pulse mt-1 shrink-0" />
                      <p className="text-[11px] leading-snug text-amber-400/90">
                        Point mouse to aim · Click to confirm · Esc to cancel
                      </p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground/60">Right-click unit on map to rotate</p>
                  )}
                </div>

                {/* Effects strip */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Effects</span>
                  <div className="flex items-stretch rounded-lg border border-border overflow-hidden flex-wrap">
                    <ToggleChip
                      active={selection.unit.effect === "glow"}
                      onClick={() => selection.updateUnit({ effect: selection.unit.effect === "glow" ? "none" : "glow" })}
                      activeClass="text-yellow-300 bg-yellow-400/10"
                      icon={<Sparkles className="size-3" />}
                      label="Glow"
                      title="Toggle glow"
                    />
                    <ToggleChip
                      active={selection.unit.effect === "hover"}
                      onClick={() => selection.updateUnit({ effect: selection.unit.effect === "hover" ? "none" : "hover" })}
                      activeClass="text-violet-300 bg-violet-400/10"
                      icon={<ArrowUpDown className="size-3" />}
                      label="Hover"
                      title="Toggle hover bob"
                    />
                    <ToggleChip
                      active={selection.unit.target}
                      onClick={() => selection.updateUnit({ target: !selection.unit.target })}
                      activeClass="text-red-300 bg-red-400/10"
                      icon={<Target className="size-3" />}
                      label="Target"
                      title="Toggle target indicator"
                    />
                    <ToggleChip
                      active={selection.unit.groundCircle}
                      onClick={() => selection.updateUnit({ groundCircle: !selection.unit.groundCircle })}
                      activeClass="text-emerald-300 bg-emerald-400/10"
                      icon={<Circle className="size-3" />}
                      label="Ground"
                      title="Toggle ground circle"
                    />
                  </div>
                </div>

                {/* Path controls */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Path</span>
                  <div className="flex items-stretch rounded-lg border border-border overflow-hidden">
                    {pathDrawingUnitId === selection.unit.id ? (
                      <>
                        <ToggleChip
                          active={true}
                          onClick={selection.finishPathDrawing}
                          activeClass="text-emerald-300 bg-emerald-400/10"
                          icon={<Route className="size-3" />}
                          label="Done"
                          title="Finish path"
                        />
                        <ToggleChip
                          active={false}
                          onClick={selection.cancelPathDrawing}
                          activeClass=""
                          icon={<X className="size-3" />}
                          label="Cancel"
                          title="Cancel path drawing"
                        />
                      </>
                    ) : selection.path ? (
                      <>
                        <ToggleChip
                          active={false}
                          onClick={selection.startPathDrawing}
                          activeClass=""
                          icon={<Route className="size-3" />}
                          label="Repath"
                          title="Draw new path"
                        />
                        <ToggleChip
                          active={false}
                          onClick={selection.deletePath}
                          activeClass=""
                          icon={<X className="size-3" />}
                          label="Clear"
                          title="Clear path"
                        />
                        <ToggleChip
                          active={selection.unit.animating}
                          onClick={() => selection.updateUnit({ animating: !selection.unit.animating })}
                          activeClass="text-sky-300 bg-sky-400/10"
                          icon={selection.unit.animating ? <Pause className="size-3" /> : <Play className="size-3" />}
                          label={selection.unit.animating ? "Stop" : "Play"}
                          title={selection.unit.animating ? "Stop animation" : "Animate along path"}
                        />
                      </>
                    ) : (
                      <ToggleChip
                        active={false}
                        onClick={selection.startPathDrawing}
                        activeClass=""
                        icon={<Route className="size-3" />}
                        label="Path"
                        title="Draw movement path"
                      />
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── [D] Status hints ── */}
        {mode && (
          <div className="rounded-lg bg-amber-400/10 border border-amber-400/20 px-3 py-2 flex items-start gap-2">
            <span className="size-1.5 rounded-full bg-amber-400 animate-pulse mt-1 shrink-0" />
            <p className="text-[11px] leading-snug text-amber-400/90">{MODE_STATUS[mode]}</p>
          </div>
        )}
        {placementMode && (
          <div className="rounded-lg bg-amber-400/10 border border-amber-400/20 px-3 py-2 flex items-start gap-2">
            <span className="size-1.5 rounded-full bg-amber-400 animate-pulse mt-1 shrink-0" />
            <p className="text-[11px] leading-snug text-amber-400/90">
              Click map to place {UNIT_FULL_LABELS[placementMode]}
              {" "}
              <button
                className="underline text-amber-300 hover:text-amber-200"
                onClick={up.cancelPlacement}
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
        {(mode || placementMode) && (
          <button
            onClick={() => { if (mode) ann.cancel(); else up.cancelPlacement(); }}
            className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors py-1"
          >
            <X className="size-3" /> Cancel active tool
          </button>
        )}

        {/* ── [E] Saved Items: flat list ── */}
        <div className="border-t border-border/30 pt-2">
          <SavedItemsContent onSelectionChange={handleSelectionChange} />
        </div>
        </div>
      </CollapsePanel>
    </div>
  );

  return (
    <div className="relative flex items-start">
      {panel}
      {trigger}
    </div>
  );
}
