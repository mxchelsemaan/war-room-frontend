import { useEffect, useState } from "react";
import {
  BookMarked, Trash2, Sparkles, Minus, Layers, Map as MapIcon,
  Route, Play, Pause, X, MapPin, Spline, MoveRight, Pentagon,
} from "lucide-react";
import { CollapsePanel, FloatingTriggerBtn } from "./FloatingPanel";
import { ColorPickerButton } from "./ColorPickerPopover";
import { ToggleChip } from "@/components/ui/ToggleChip";
import { Slider } from "@/components/ui/slider";
import { useAnnotationContext } from "@/context/AnnotationContext";
import { useUnitPlacementContext } from "@/context/UnitPlacementContext";
import { DRAW_COLOR_PRESETS } from "@/hooks/useDrawing";
import { natoMiniSVG } from "@/lib/natoSymbols";
import type { Annotation, AnnotationType } from "@/hooks/useDrawing";
import type { PlacedUnit, UnitPath } from "@/types/units";

const TYPE_ICON: Record<AnnotationType, React.ReactNode> = {
  pin:   <MapPin    className="size-3.5" />,
  line:  <Spline    className="size-3.5" />,
  arrow: <MoveRight className="size-3.5" />,
  area:  <Pentagon  className="size-3.5" />,
};

/* ── Section header ─────────────────────────────────────────── */

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 px-1 py-1">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{label}</span>
      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-medium text-muted-foreground leading-none">
        {count}
      </span>
    </div>
  );
}

/* ── Annotation item row ────────────────────────────────────── */

interface AnnItemRowProps {
  ann: Annotation;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onRename: (label: string) => void;
  onSetColor: (c: string) => void;
  onSetWidth: (w: number) => void;
  onToggleGlow: () => void;
  onToggleDash: () => void;
  onToggleFloat: () => void;
}

function AnnItemRow({
  ann, expanded, onToggle, onDelete, onRename,
  onSetColor, onSetWidth, onToggleGlow, onToggleDash, onToggleFloat,
}: AnnItemRowProps) {
  const [editingLabel, setEditingLabel] = useState(false);
  const [editValue, setEditValue] = useState(ann.label);
  const isPinType = ann.type === "pin";

  function commitLabel() {
    onRename(editValue.trim() || ann.label);
    setEditingLabel(false);
  }

  return (
    <div className={`flex flex-col rounded-lg border overflow-hidden mb-1 transition-colors ${
      expanded ? "border-primary/40 bg-primary/5" : "border-border/40 bg-muted/30 hover:bg-muted/50"
    }`}>
      {/* Main row */}
      <div className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer" onClick={onToggle}>
        <span
          className="size-3 rounded-full shrink-0 ring-1 ring-white/20"
          style={{ background: ann.color }}
        />
        <span className="shrink-0 text-muted-foreground/60">{TYPE_ICON[ann.type]}</span>
        {editingLabel ? (
          <input
            autoFocus
            value={editValue}
            placeholder="Name (optional)"
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitLabel();
              if (e.key === "Escape") { setEditingLabel(false); setEditValue(ann.label); }
            }}
            onBlur={commitLabel}
            onClick={(e) => e.stopPropagation()}
            className="w-0 flex-1 rounded border border-border bg-background px-1.5 py-0.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        ) : (
          <button
            className="text-xs truncate flex-1 text-left hover:text-primary transition-colors"
            style={{ color: ann.label ? undefined : "var(--color-muted-foreground)", fontStyle: ann.label ? undefined : "italic" }}
            onClick={(e) => { e.stopPropagation(); setEditingLabel(true); setEditValue(ann.label); }}
            title="Click to rename"
          >
            {ann.label || "unnamed"}
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="shrink-0 text-muted-foreground/40 hover:text-red-400 transition-colors p-0.5 rounded"
          title="Delete"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="flex flex-col gap-2 px-2.5 py-2 border-t border-border/30 bg-muted/20">
          {/* Color swatches */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {DRAW_COLOR_PRESETS.map((c) => (
              <button
                key={c}
                onClick={() => onSetColor(c)}
                style={{
                  background: c,
                  outline: ann.color === c ? `2px solid ${c}` : undefined,
                  outlineOffset: ann.color === c ? "2px" : undefined,
                  opacity: ann.color === c ? 1 : 0.55,
                }}
                className="size-4 rounded-full transition-all hover:opacity-100 hover:scale-110"
                title={c}
              />
            ))}
            <ColorPickerButton color={ann.color} onChange={onSetColor} />
          </div>

          {/* Width slider — not for pins */}
          {!isPinType && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Width</span>
                <span className="text-[11px] font-medium tabular-nums">{ann.width}</span>
              </div>
              <Slider
                min={1}
                max={12}
                step={1}
                value={[ann.width]}
                onValueChange={([v]) => onSetWidth(v)}
              />
            </div>
          )}

          {/* Toggle strip */}
          <div className="flex items-stretch rounded-lg border border-border overflow-hidden">
            {!isPinType && (
              <ToggleChip
                active={ann.float}
                onClick={onToggleFloat}
                activeClass="text-violet-300 bg-violet-400/10"
                icon={ann.float ? <Layers className="size-3" /> : <MapIcon className="size-3" />}
                label={ann.float ? "Float" : "Map"}
                title={ann.float ? "Switch to on-map" : "Switch to float"}
              />
            )}
            <ToggleChip
              active={ann.glow}
              onClick={onToggleGlow}
              activeClass="text-yellow-300 bg-yellow-400/10"
              icon={<Sparkles className="size-3" />}
              label="Glow"
              title="Toggle glow"
            />
            {!isPinType && (
              <ToggleChip
                active={ann.dash}
                onClick={onToggleDash}
                activeClass="text-sky-300 bg-sky-400/10"
                icon={<Minus className="size-3" />}
                label="Dash"
                title="Toggle dashed"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Unit item row ──────────────────────────────────────────── */

interface UnitItemRowProps {
  unit: PlacedUnit;
  path: UnitPath | undefined;
  expanded: boolean;
  onToggle: () => void;
  pathDrawingUnitId: string | null;
  onUpdateUnit: (id: string, changes: Partial<Pick<PlacedUnit, "label" | "color" | "glow" | "animating" | "loopMs">>) => void;
  onDeleteUnit: (id: string) => void;
  onStartPathDrawing: (unitId: string) => void;
  onFinishPathDrawing: () => void;
  onCancelPathDrawing: () => void;
  onDeletePath: (unitId: string) => void;
}

function UnitItemRow({
  unit, path, expanded, onToggle, pathDrawingUnitId,
  onUpdateUnit, onDeleteUnit,
  onStartPathDrawing, onFinishPathDrawing, onCancelPathDrawing, onDeletePath,
}: UnitItemRowProps) {
  const [editingLabel, setEditingLabel] = useState(false);
  const [editValue, setEditValue] = useState(unit.label);
  const isDrawingPath = pathDrawingUnitId === unit.id;
  const hasPath = !!unit.pathId && !!path;

  function commitLabel() {
    onUpdateUnit(unit.id, { label: editValue.trim() || unit.label });
    setEditingLabel(false);
  }

  return (
    <div className={`flex flex-col rounded-lg border overflow-hidden mb-1 transition-colors ${
      expanded ? "border-primary/40 bg-primary/5" : "border-border/40 bg-muted/30 hover:bg-muted/50"
    }`}>
      {/* Main row */}
      <div className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer" onClick={onToggle}>
        <span
          className="size-3 rounded-full shrink-0 ring-1 ring-white/20"
          style={{ background: unit.color }}
        />
        <span
          className="shrink-0"
          dangerouslySetInnerHTML={{ __html: natoMiniSVG(unit.unitType, unit.color) }}
        />
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
            onClick={(e) => e.stopPropagation()}
            className="w-0 flex-1 rounded border border-border bg-background px-1.5 py-0.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        ) : (
          <button
            className="text-xs truncate flex-1 text-left hover:text-primary transition-colors"
            onClick={(e) => { e.stopPropagation(); setEditingLabel(true); setEditValue(unit.label); }}
            title="Click to rename"
          >
            {unit.label}
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDeleteUnit(unit.id); }}
          className="shrink-0 text-muted-foreground/40 hover:text-red-400 transition-colors p-0.5 rounded"
          title="Delete unit"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="flex flex-col gap-2 px-2.5 py-2 border-t border-border/30 bg-muted/20">
          {/* Color swatches */}
          <div className="flex items-center gap-1.5 flex-wrap">
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
                className="size-4 rounded-full transition-all hover:opacity-100 hover:scale-110"
                title={c}
              />
            ))}
            <ColorPickerButton color={unit.color} onChange={(c) => onUpdateUnit(unit.id, { color: c })} />
          </div>

          {/* Controls */}
          <div className="flex items-stretch rounded-lg border border-border overflow-hidden">
            <ToggleChip
              active={unit.glow}
              onClick={() => onUpdateUnit(unit.id, { glow: !unit.glow })}
              activeClass="text-yellow-300 bg-yellow-400/10"
              icon={<Sparkles className="size-3" />}
              label="Glow"
              title={unit.glow ? "Remove glow" : "Add pulsing glow"}
            />
            {isDrawingPath ? (
              <>
                <ToggleChip
                  active={true}
                  onClick={onFinishPathDrawing}
                  activeClass="text-emerald-300 bg-emerald-400/10"
                  icon={<Route className="size-3" />}
                  label="Done"
                  title="Finish path"
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
      )}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────── */

interface SavedItemsPanelProps {
  open: boolean;
  onToggle: () => void;
  showLabels?: boolean;
}

export function SavedItemsPanel({ open, onToggle, showLabels }: SavedItemsPanelProps) {
  const ann = useAnnotationContext();
  const up = useUnitPlacementContext();
  const [expandedAnnId, setExpandedAnnId] = useState<string | null>(null);
  const [expandedUnitId, setExpandedUnitId] = useState<string | null>(null);

  const total = ann.annotations.length + up.units.length;

  // Auto-expand when an annotation is selected externally (e.g. click on map)
  useEffect(() => {
    if (ann.selectedAnnotationId) {
      setExpandedAnnId(ann.selectedAnnotationId);
    }
  }, [ann.selectedAnnotationId]);

  function handleStartPathDrawing(unitId: string) {
    ann.cancel();
    up.startPathDrawing(unitId);
  }

  return (
    <>
      <FloatingTriggerBtn
        onClick={onToggle}
        aria-label={open ? "Close saved items" : "Open saved items"}
        showLabels={showLabels}
      >
        <BookMarked className="size-3.5" />
        Items
        {total > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground leading-none">
            {total}
          </span>
        )}
      </FloatingTriggerBtn>

      <CollapsePanel open={open} direction="down">
        <div className="glass-panel p-2 w-64 max-h-[calc(60vh-3rem)] overflow-y-auto mt-1">
          {/* Empty state */}
          {total === 0 && (
            <p className="text-[11px] text-muted-foreground/40 italic text-center py-4">
              No shapes or units yet
            </p>
          )}

          {/* Shapes section */}
          {ann.annotations.length > 0 && (
            <>
              <SectionHeader label="Shapes" count={ann.annotations.length} />
              {ann.annotations.map((a) => (
                <AnnItemRow
                  key={a.id}
                  ann={a}
                  expanded={expandedAnnId === a.id}
                  onToggle={() => setExpandedAnnId(expandedAnnId === a.id ? null : a.id)}
                  onDelete={() => ann.deleteAnnotation(a.id)}
                  onRename={(label) => ann.renameAnnotation(a.id, label)}
                  onSetColor={(c) => ann.setAnnotationColor(a.id, c)}
                  onSetWidth={(w) => ann.setAnnotationWidth(a.id, w)}
                  onToggleGlow={() => ann.toggleGlow(a.id)}
                  onToggleDash={() => ann.toggleDash(a.id)}
                  onToggleFloat={() => ann.toggleAnnotationFloat(a.id)}
                />
              ))}
            </>
          )}

          {/* Divider between sections */}
          {ann.annotations.length > 0 && up.units.length > 0 && (
            <div className="border-t border-border/40 my-2" />
          )}

          {/* Units section */}
          {up.units.length > 0 && (
            <>
              <SectionHeader label="Units" count={up.units.length} />
              {up.units.map((u) => (
                <UnitItemRow
                  key={u.id}
                  unit={u}
                  path={up.paths.find((p) => p.id === u.pathId)}
                  expanded={expandedUnitId === u.id}
                  onToggle={() => setExpandedUnitId(expandedUnitId === u.id ? null : u.id)}
                  pathDrawingUnitId={up.pathDrawingUnitId}
                  onUpdateUnit={up.updateUnit}
                  onDeleteUnit={up.deleteUnit}
                  onStartPathDrawing={handleStartPathDrawing}
                  onFinishPathDrawing={up.finishPathDrawing}
                  onCancelPathDrawing={up.cancelPathDrawing}
                  onDeletePath={up.deletePath}
                />
              ))}
            </>
          )}
        </div>
      </CollapsePanel>
    </>
  );
}
