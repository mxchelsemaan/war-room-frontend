import { useState } from "react";
import { Crosshair, Trash2, Sparkles, Play, Pause, Route, X } from "lucide-react";
import { CollapsePanel, FloatingTriggerBtn } from "./FloatingPanel";
import { ColorPickerButton } from "./ColorPickerPopover";
import { Button } from "@/components/ui/button";
import { ToggleChip } from "@/components/ui/ToggleChip";
import { natoMiniSVG } from "@/lib/natoSymbols";
import type { NATOUnitType, PlacedUnit, UnitPath } from "@/types/units";
import { DRAW_COLOR_PRESETS } from "@/hooks/useDrawing";

const UNIT_SHORT_LABELS: Record<NATOUnitType, string> = {
  infantry: "Inf", armor: "Arm", artillery: "Art", mechanized: "Mec", hq: "HQ",
  fighter: "Ftr", helicopter: "Hel", warship: "War", submarine: "Sub",
};

const UNIT_FULL_LABELS: Record<NATOUnitType, string> = {
  infantry: "Infantry", armor: "Armor", artillery: "Artillery", mechanized: "Mechanized", hq: "HQ",
  fighter: "Fighter", helicopter: "Helicopter", warship: "Warship", submarine: "Submarine",
};

const NATO_TYPES: NATOUnitType[] = ["infantry", "armor", "artillery", "mechanized", "hq"];

/* ── UnitRow ───────────────────────────────────────────────── */

interface UnitRowProps {
  unit: PlacedUnit;
  path: UnitPath | undefined;
  pathDrawingUnitId: string | null;
  onUpdateUnit: (id: string, changes: Partial<Pick<PlacedUnit, "label" | "color" | "glow" | "animating" | "loopMs">>) => void;
  onDeleteUnit: (id: string) => void;
  onStartPathDrawing: (unitId: string) => void;
  onFinishPathDrawing: () => void;
  onCancelPathDrawing: () => void;
  onDeletePath: (unitId: string) => void;
}

function UnitRow({
  unit, path, pathDrawingUnitId,
  onUpdateUnit, onDeleteUnit,
  onStartPathDrawing, onFinishPathDrawing, onCancelPathDrawing, onDeletePath,
}: UnitRowProps) {
  const [editingLabel, setEditingLabel] = useState(false);
  const [editValue, setEditValue] = useState(unit.label);
  const [colorOpen, setColorOpen] = useState(false);

  const isDrawingPath = pathDrawingUnitId === unit.id;
  const hasPath = !!unit.pathId && !!path;

  function commitLabel() {
    onUpdateUnit(unit.id, { label: editValue.trim() || unit.label });
    setEditingLabel(false);
  }

  return (
    <div className={`flex flex-col rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border overflow-hidden ${colorOpen ? "border-primary/60" : "border-border/40"}`}>
      {/* Name row */}
      <div className="flex items-center gap-2 px-2.5 pt-2 pb-1">
        {/* Color dot */}
        <button
          className={`size-3.5 rounded-full shrink-0 ring-1 hover:scale-125 transition-transform ${colorOpen ? "ring-primary" : "ring-white/20"}`}
          style={{ background: unit.color }}
          onClick={() => setColorOpen(prev => !prev)}
          title="Edit color"
        />

        {/* NATO mini icon */}
        <span
          className="shrink-0"
          dangerouslySetInnerHTML={{ __html: natoMiniSVG(unit.unitType, unit.color) }}
        />

        {/* Label / edit */}
        {editingLabel ? (
          <input
            autoFocus
            value={editValue}
            placeholder="Unit name"
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitLabel();
              if (e.key === "Escape") { setEditingLabel(false); setEditValue(unit.label); }
            }}
            onBlur={commitLabel}
            className="w-0 flex-1 rounded border border-border bg-background px-1.5 py-0.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        ) : (
          <button
            className="text-xs truncate flex-1 text-left hover:text-primary transition-colors"
            onClick={() => { setEditingLabel(true); setEditValue(unit.label); }}
            title="Click to rename"
          >
            {unit.label}
          </button>
        )}

        {/* Delete */}
        <button
          onClick={() => onDeleteUnit(unit.id)}
          className="shrink-0 text-muted-foreground/40 hover:text-red-400 transition-colors p-0.5 rounded"
          title="Delete unit"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {/* Inline color editor */}
      {colorOpen && (
        <div className="flex flex-col gap-2 px-2.5 py-2 border-t border-border/30 bg-muted/20">
          <div className="flex items-center gap-2 flex-wrap">
            {DRAW_COLOR_PRESETS.map((c) => (
              <button
                key={c}
                onClick={() => onUpdateUnit(unit.id, { color: c })}
                style={{
                  background: c,
                  outline: unit.color === c ? `2px solid ${c}` : undefined,
                  outlineOffset: unit.color === c ? "2px" : undefined,
                  opacity: unit.color === c ? 1 : 0.55,
                }}
                className="size-4.5 rounded-full transition-all hover:opacity-100 hover:scale-110"
                title={c}
              />
            ))}
            <ColorPickerButton color={unit.color} onChange={(c) => onUpdateUnit(unit.id, { color: c })} />
          </div>
        </div>
      )}

      {/* Action strip */}
      <div className="flex items-stretch border-t border-border/30">
        <ToggleChip
          active={unit.glow}
          onClick={() => onUpdateUnit(unit.id, { glow: !unit.glow })}
          activeClass="text-yellow-300 bg-yellow-400/10"
          icon={<Sparkles className="size-3" />}
          label="Glow"
          title={unit.glow ? "Remove glow" : "Add pulsing glow"}
        />

        {/* Path chip: drawing in progress vs has path vs no path */}
        {isDrawingPath ? (
          <>
            <ToggleChip
              active={true}
              onClick={onFinishPathDrawing}
              activeClass="text-emerald-300 bg-emerald-400/10"
              icon={<Route className="size-3" />}
              label="Done"
              title="Finish path (or double-click map)"
            />
            <ToggleChip
              active={false}
              onClick={onCancelPathDrawing}
              activeClass=""
              icon={<X className="size-3" />}
              label="Cancel"
              title="Cancel path drawing"
            />
          </>
        ) : hasPath ? (
          <>
            <ToggleChip
              active={false}
              onClick={() => onStartPathDrawing(unit.id)}
              activeClass=""
              icon={<Route className="size-3" />}
              label="Repath"
              title="Draw new path"
            />
            <ToggleChip
              active={false}
              onClick={() => onDeletePath(unit.id)}
              activeClass=""
              icon={<X className="size-3" />}
              label="Clear"
              title="Clear path"
            />
          </>
        ) : (
          <ToggleChip
            active={false}
            onClick={() => onStartPathDrawing(unit.id)}
            activeClass=""
            icon={<Route className="size-3" />}
            label="Path"
            title="Draw movement path"
          />
        )}

        {/* Play/Pause — only show when unit has a path */}
        {hasPath && !isDrawingPath && (
          <ToggleChip
            active={unit.animating}
            onClick={() => onUpdateUnit(unit.id, { animating: !unit.animating })}
            activeClass="text-sky-300 bg-sky-400/10"
            icon={unit.animating ? <Pause className="size-3" /> : <Play className="size-3" />}
            label={unit.animating ? "Stop" : "Play"}
            title={unit.animating ? "Stop animation" : "Animate along path"}
          />
        )}
      </div>
    </div>
  );
}

/* ── UnitPalette ───────────────────────────────────────────── */

interface UnitPaletteProps {
  units: PlacedUnit[];
  paths: UnitPath[];
  placementMode: NATOUnitType | null;
  pendingColor: string;
  pathDrawingUnitId: string | null;
  open: boolean;
  onToggle: () => void;
  onStartPlacement: (type: NATOUnitType) => void;
  onCancelPlacement: () => void;
  onSetPendingColor: (color: string) => void;
  onUpdateUnit: (id: string, changes: Partial<Pick<PlacedUnit, "label" | "color" | "glow" | "animating" | "loopMs">>) => void;
  onDeleteUnit: (id: string) => void;
  onStartPathDrawing: (unitId: string) => void;
  onFinishPathDrawing: () => void;
  onCancelPathDrawing: () => void;
  onDeletePath: (unitId: string) => void;
  showLabels?: boolean;
}

export function UnitPalette({
  units, paths, placementMode, pendingColor, pathDrawingUnitId,
  open, onToggle,
  onStartPlacement, onCancelPlacement, onSetPendingColor,
  onUpdateUnit, onDeleteUnit,
  onStartPathDrawing, onFinishPathDrawing, onCancelPathDrawing, onDeletePath,
  showLabels,
}: UnitPaletteProps) {
  const pathMap = new Map(paths.map(p => [p.id, p]));

  const isActive = placementMode !== null || pathDrawingUnitId !== null;

  const trigger = (
    <FloatingTriggerBtn
      onClick={onToggle}
      aria-label={open ? "Close unit palette" : "Open unit palette"}
      className={isActive ? "text-primary" : undefined}
      showLabels={showLabels}
    >
      <Crosshair className="size-3.5" />
      {placementMode ? UNIT_FULL_LABELS[placementMode] : pathDrawingUnitId ? "Drawing Path" : "Units"}
      {units.length > 0 && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground leading-none">
          {units.length}
        </span>
      )}
    </FloatingTriggerBtn>
  );

  const panel = (
    <CollapsePanel open={open} direction="down">
      <div className="glass-panel p-3 w-[calc(100vw-1.5rem)] md:w-72 flex flex-col gap-3 mb-1">

        {/* ── NATO type grid ── */}
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Unit Type</span>
          <div className="grid grid-cols-5 gap-1.5">
            {NATO_TYPES.map((type) => (
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

        {/* ── Color row ── */}
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">Color</span>
          <div className="flex items-center gap-2 flex-wrap">
            {DRAW_COLOR_PRESETS.map((c) => (
              <button
                key={c}
                onClick={() => onSetPendingColor(c)}
                style={{
                  background: c,
                  outline: pendingColor === c ? `2px solid ${c}` : undefined,
                  outlineOffset: pendingColor === c ? "2px" : undefined,
                  opacity: pendingColor === c ? 1 : 0.55,
                }}
                className="size-5 rounded-full transition-all hover:opacity-100 hover:scale-110"
                title={c}
              />
            ))}
            <ColorPickerButton color={pendingColor} onChange={onSetPendingColor} />
          </div>
        </div>

        {/* ── Active mode status bar ── */}
        {placementMode && (
          <div className="rounded-lg bg-amber-400/10 border border-amber-400/20 px-3 py-2 flex items-start gap-2">
            <span className="size-1.5 rounded-full bg-amber-400 animate-pulse mt-1 shrink-0" />
            <p className="text-[11px] leading-snug text-amber-400/90">
              Click map to place {UNIT_FULL_LABELS[placementMode]} · Esc to cancel
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

        {/* ── Placed units list ── */}
        {units.length > 0 && (
          <>
            <div className="border-t border-border" />
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Placed Units
                </span>
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-medium text-muted-foreground leading-none">
                  {units.length}
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto flex flex-col gap-1.5">
                {units.map((unit) => (
                  <UnitRow
                    key={unit.id}
                    unit={unit}
                    path={unit.pathId ? pathMap.get(unit.pathId) : undefined}
                    pathDrawingUnitId={pathDrawingUnitId}
                    onUpdateUnit={onUpdateUnit}
                    onDeleteUnit={onDeleteUnit}
                    onStartPathDrawing={onStartPathDrawing}
                    onFinishPathDrawing={onFinishPathDrawing}
                    onCancelPathDrawing={onCancelPathDrawing}
                    onDeletePath={onDeletePath}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </CollapsePanel>
  );

  return (
    <div className="flex flex-col items-end gap-1">
      {trigger}
      {panel}
    </div>
  );
}
