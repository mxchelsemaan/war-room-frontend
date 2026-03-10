import { useEffect, useRef, useState } from "react";
import {
  BookMarked, Trash2, Sparkles, Minus, Layers, Map as MapIcon,
  Route, Play, Pause, X, MapPin, Spline, MoveRight, Pentagon, GripVertical,
  ArrowUpDown, Target, Circle,
} from "lucide-react";
import { CollapsePanel, FloatingTriggerBtn } from "./FloatingPanel";
import { ToggleChip } from "@/components/ui/ToggleChip";
import { Slider } from "@/components/ui/slider";
import { useAnnotationContext } from "@/context/AnnotationContext";
import { useUnitPlacementContext } from "@/context/UnitPlacementContext";
import { natoMiniSVG } from "@/lib/natoSymbols";
import type { Annotation, AnnotationType } from "@/hooks/useDrawing";
import type { PlacedUnit, UnitPath } from "@/types/units";

const TYPE_ICON: Record<AnnotationType, React.ReactNode> = {
  pin:   <MapPin    className="size-3.5" />,
  line:  <Spline    className="size-3.5" />,
  arrow: <MoveRight className="size-3.5" />,
  area:  <Pentagon  className="size-3.5" />,
};

const TYPE_LABEL: Record<AnnotationType, string> = {
  pin: "Pin", line: "Line", arrow: "Arrow", area: "Area",
};

/* ── List item (compact, for left column) ──────────────────── */

interface ListItemProps {
  id: string;
  icon: React.ReactNode;
  colorDot: string;
  label: string;
  typeLabel: string;
  selected: boolean;
  index: number;
  onClick: () => void;
  onDelete: () => void;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (index: number) => void;
}

function ListItem({
  icon, colorDot, label, typeLabel, selected, index,
  onClick, onDelete, onDragStart, onDragOver, onDrop,
}: ListItemProps) {
  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors group ${
        selected ? "bg-primary/15 ring-1 ring-primary/30" : "hover:bg-muted/50"
      }`}
      onClick={onClick}
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={() => onDrop(index)}
    >
      <span className="shrink-0 text-muted-foreground/30 cursor-grab active:cursor-grabbing">
        <GripVertical className="size-3" />
      </span>
      <span
        className="size-2.5 rounded-full shrink-0 ring-1 ring-white/20"
        style={{ background: colorDot }}
      />
      <span className="shrink-0 text-muted-foreground/60">{icon}</span>
      <span className="text-[11px] truncate flex-1">{label || <span className="italic text-muted-foreground/40">unnamed</span>}</span>
      <span className="text-[9px] text-muted-foreground/40 uppercase tracking-wider shrink-0">{typeLabel}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="shrink-0 text-muted-foreground/20 hover:text-red-400 transition-colors p-0.5 rounded opacity-0 group-hover:opacity-100"
        title="Delete"
      >
        <Trash2 className="size-3" />
      </button>
    </div>
  );
}

/* ── Annotation detail panel (right column) ────────────────── */

function AnnDetailPanel({ ann, onRename, onSetWidth, onToggleGlow, onToggleDash, onToggleFloat }: {
  ann: Annotation;
  onRename: (label: string) => void;
  onSetWidth: (w: number) => void;
  onToggleGlow: () => void;
  onToggleDash: () => void;
  onToggleFloat: () => void;
}) {
  const [editValue, setEditValue] = useState(ann.label);
  const isPinType = ann.type === "pin";

  useEffect(() => { setEditValue(ann.label); }, [ann.label]);

  function commitLabel() {
    onRename(editValue.trim() || ann.label);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Name */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Name</span>
        <input
          value={editValue}
          placeholder="unnamed"
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commitLabel(); }}
          onBlur={commitLabel}
          className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary"
        />
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
  );
}

/* ── Unit detail panel (right column) ──────────────────────── */

function UnitDetailPanel({ unit, path, pathDrawingUnitId, onUpdateUnit, onStartPathDrawing, onFinishPathDrawing, onCancelPathDrawing, onDeletePath }: {
  unit: PlacedUnit;
  path: UnitPath | undefined;
  pathDrawingUnitId: string | null;
  onUpdateUnit: (id: string, changes: Partial<Pick<PlacedUnit, "label" | "color" | "effect" | "bearing" | "target" | "groundCircle" | "animating" | "loopMs">>) => void;
  onStartPathDrawing: (unitId: string) => void;
  onFinishPathDrawing: () => void;
  onCancelPathDrawing: () => void;
  onDeletePath: (unitId: string) => void;
}) {
  const [editValue, setEditValue] = useState(unit.label);
  const isDrawingPath = pathDrawingUnitId === unit.id;
  const hasPath = !!unit.pathId && !!path;

  useEffect(() => { setEditValue(unit.label); }, [unit.label]);

  function commitLabel() {
    onUpdateUnit(unit.id, { label: editValue.trim() || unit.label });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Name */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Name</span>
        <input
          value={editValue}
          placeholder="Unit name"
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commitLabel(); }}
          onBlur={commitLabel}
          className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Bearing slider */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Bearing</span>
          <span className="text-[11px] font-medium tabular-nums">{unit.bearing}°</span>
        </div>
        <Slider
          min={0}
          max={360}
          step={5}
          value={[unit.bearing]}
          onValueChange={([v]) => onUpdateUnit(unit.id, { bearing: v })}
        />
      </div>

      {/* Effect + feature toggles */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Effects</span>
        <div className="flex items-stretch rounded-lg border border-border overflow-hidden flex-wrap">
          <ToggleChip
            active={unit.effect === "glow"}
            onClick={() => onUpdateUnit(unit.id, { effect: unit.effect === "glow" ? "none" : "glow" })}
            activeClass="text-yellow-300 bg-yellow-400/10"
            icon={<Sparkles className="size-3" />}
            label="Glow"
            title={unit.effect === "glow" ? "Remove glow" : "Add pulsing glow"}
          />
          <ToggleChip
            active={unit.effect === "hover"}
            onClick={() => onUpdateUnit(unit.id, { effect: unit.effect === "hover" ? "none" : "hover" })}
            activeClass="text-violet-300 bg-violet-400/10"
            icon={<ArrowUpDown className="size-3" />}
            label="Hover"
            title={unit.effect === "hover" ? "Remove hover" : "Add hover bob"}
          />
          <ToggleChip
            active={unit.target}
            onClick={() => onUpdateUnit(unit.id, { target: !unit.target })}
            activeClass="text-red-300 bg-red-400/10"
            icon={<Target className="size-3" />}
            label="Target"
            title={unit.target ? "Remove target" : "Add target indicator"}
          />
          <ToggleChip
            active={unit.groundCircle}
            onClick={() => onUpdateUnit(unit.id, { groundCircle: !unit.groundCircle })}
            activeClass="text-emerald-300 bg-emerald-400/10"
            icon={<Circle className="size-3" />}
            label="Ground"
            title={unit.groundCircle ? "Remove ground circle" : "Add ground circle"}
          />
        </div>
      </div>

      {/* Path controls */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Path</span>
        <div className="flex items-stretch rounded-lg border border-border overflow-hidden">
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
              <ToggleChip
                active={unit.animating}
                onClick={() => onUpdateUnit(unit.id, { animating: !unit.animating })}
                activeClass="text-sky-300 bg-sky-400/10"
                icon={unit.animating ? <Pause className="size-3" /> : <Play className="size-3" />}
                label={unit.animating ? "Stop" : "Play"}
                title={unit.animating ? "Stop animation" : "Animate along path"}
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
        </div>
      </div>
    </div>
  );
}

/* ── SavedItemsContent (reusable, reads from context) ───────── */

type SelectedItem = { kind: "ann"; id: string } | { kind: "unit"; id: string } | null;

export function SavedItemsContent({ onSelectionColor }: { onSelectionColor?: (color: string | null, setColor: ((c: string) => void) | null) => void }) {
  const ann = useAnnotationContext();
  const up = useUnitPlacementContext();
  const [selected, setSelected] = useState<SelectedItem>(null);

  const dragAnnIdx = useRef<number>(-1);
  const dragUnitIdx = useRef<number>(-1);

  const total = ann.annotations.length + up.units.length;

  // Sync annotation selection from map clicks
  useEffect(() => {
    if (ann.selectedAnnotationId) {
      setSelected({ kind: "ann", id: ann.selectedAnnotationId });
    }
  }, [ann.selectedAnnotationId]);

  function handleStartPathDrawing(unitId: string) {
    ann.cancel();
    up.startPathDrawing(unitId);
  }

  function handleAnnDragOver(e: React.DragEvent, _index: number) {
    e.preventDefault();
  }

  function handleAnnDrop(toIndex: number) {
    if (dragAnnIdx.current !== -1 && dragAnnIdx.current !== toIndex) {
      ann.reorderAnnotation(ann.annotations[dragAnnIdx.current].id, toIndex);
    }
    dragAnnIdx.current = -1;
  }

  function handleUnitDragOver(e: React.DragEvent, _index: number) {
    e.preventDefault();
  }

  function handleUnitDrop(toIndex: number) {
    if (dragUnitIdx.current !== -1 && dragUnitIdx.current !== toIndex) {
      up.reorderUnit(up.units[dragUnitIdx.current].id, toIndex);
    }
    dragUnitIdx.current = -1;
  }

  // Find the selected item
  const selectedAnn = selected?.kind === "ann" ? ann.annotations.find(a => a.id === selected.id) : null;
  const selectedUnit = selected?.kind === "unit" ? up.units.find(u => u.id === selected.id) : null;
  const selectedUnitPath = selectedUnit?.pathId ? up.paths.find(p => p.id === selectedUnit.pathId) : undefined;
  const hasSelection = selectedAnn || selectedUnit;

  // Push selected item's color up to parent for unified color bar
  useEffect(() => {
    if (!onSelectionColor) return;
    if (selectedAnn) {
      onSelectionColor(selectedAnn.color, (c) => ann.setAnnotationColor(selectedAnn.id, c));
    } else if (selectedUnit) {
      onSelectionColor(selectedUnit.color, (c) => up.updateUnit(selectedUnit.id, { color: c }));
    } else {
      onSelectionColor(null, null);
    }
  }, [selectedAnn?.id, selectedAnn?.color, selectedUnit?.id, selectedUnit?.color, onSelectionColor]);

  return (
    <div className="flex gap-2 min-h-0" style={{ minHeight: 120 }}>
      {/* ── LEFT: scrollable item list ── */}
      <div className={`flex flex-col gap-0.5 overflow-y-auto pr-1 ${hasSelection ? "w-[45%] shrink-0" : "flex-1"}`} style={{ maxHeight: "calc(60vh - 6rem)" }}>
        {total === 0 && (
          <p className="text-[11px] text-muted-foreground/40 italic text-center py-6">
            No shapes or units yet
          </p>
        )}

        {ann.annotations.length > 0 && (
          <>
            <div className="flex items-center gap-1.5 px-1 py-1">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50">Shapes</span>
              <span className="text-[9px] text-muted-foreground/30">{ann.annotations.length}</span>
            </div>
            {ann.annotations.map((a, i) => (
              <ListItem
                key={a.id}
                id={a.id}
                icon={TYPE_ICON[a.type]}
                colorDot={a.color}
                label={a.label}
                typeLabel={TYPE_LABEL[a.type]}
                selected={selected?.kind === "ann" && selected.id === a.id}
                index={i}
                onClick={() => setSelected(selected?.kind === "ann" && selected.id === a.id ? null : { kind: "ann", id: a.id })}
                onDelete={() => {
                  ann.deleteAnnotation(a.id);
                  if (selected?.kind === "ann" && selected.id === a.id) setSelected(null);
                }}
                onDragStart={(idx) => { dragAnnIdx.current = idx; }}
                onDragOver={handleAnnDragOver}
                onDrop={handleAnnDrop}
              />
            ))}
          </>
        )}

        {ann.annotations.length > 0 && up.units.length > 0 && (
          <div className="border-t border-border/30 my-1" />
        )}

        {up.units.length > 0 && (
          <>
            <div className="flex items-center gap-1.5 px-1 py-1">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50">Units</span>
              <span className="text-[9px] text-muted-foreground/30">{up.units.length}</span>
            </div>
            {up.units.map((u, i) => (
              <ListItem
                key={u.id}
                id={u.id}
                icon={<span className="shrink-0" dangerouslySetInnerHTML={{ __html: natoMiniSVG(u.unitType, u.color) }} />}
                colorDot={u.color}
                label={u.label}
                typeLabel={u.unitType.slice(0, 3)}
                selected={selected?.kind === "unit" && selected.id === u.id}
                index={i}
                onClick={() => setSelected(selected?.kind === "unit" && selected.id === u.id ? null : { kind: "unit", id: u.id })}
                onDelete={() => {
                  up.deleteUnit(u.id);
                  if (selected?.kind === "unit" && selected.id === u.id) setSelected(null);
                }}
                onDragStart={(idx) => { dragUnitIdx.current = idx; }}
                onDragOver={handleUnitDragOver}
                onDrop={handleUnitDrop}
              />
            ))}
          </>
        )}
      </div>

      {/* ── RIGHT: detail / visualization options ── */}
      {hasSelection && (
        <div className="flex-1 border-l border-border/30 pl-2.5 overflow-y-auto" style={{ maxHeight: "calc(60vh - 6rem)" }}>
          {selectedAnn && (
            <AnnDetailPanel
              ann={selectedAnn}
              onRename={(label) => ann.renameAnnotation(selectedAnn.id, label)}
              onSetWidth={(w) => ann.setAnnotationWidth(selectedAnn.id, w)}
              onToggleGlow={() => ann.toggleGlow(selectedAnn.id)}
              onToggleDash={() => ann.toggleDash(selectedAnn.id)}
              onToggleFloat={() => ann.toggleAnnotationFloat(selectedAnn.id)}
            />
          )}
          {selectedUnit && (
            <UnitDetailPanel
              unit={selectedUnit}
              path={selectedUnitPath}
              pathDrawingUnitId={up.pathDrawingUnitId}
              onUpdateUnit={up.updateUnit}
              onStartPathDrawing={handleStartPathDrawing}
              onFinishPathDrawing={up.finishPathDrawing}
              onCancelPathDrawing={up.cancelPathDrawing}
              onDeletePath={up.deletePath}
            />
          )}
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
  const total = ann.annotations.length + up.units.length;

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
        <div className="glass-panel p-2 w-96 max-h-[calc(100vh-8rem)] overflow-y-auto mt-1">
          <SavedItemsContent />
        </div>
      </CollapsePanel>
    </>
  );
}
