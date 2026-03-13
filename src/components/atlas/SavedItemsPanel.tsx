import { useEffect, useRef, useState } from "react";
import {
  Trash2, MapPin, Spline, MoveRight, Pentagon, GripVertical,
} from "lucide-react";
import { useAnnotationListContext, useDrawingContext } from "@/context/AnnotationContext";
import { useUnitPlacementContext } from "@/context/UnitPlacementContext";
import { natoMiniSVG } from "@/lib/natoSymbols";
import type { Annotation, AnnotationType } from "@/hooks/useDrawing";
import type { PlacedUnit, UnitPath } from "@/types/units";

/* ── Selection sync type ─────────────────────────────────── */

export type SelectionSync =
  | {
      kind: "ann";
      ann: Annotation;
      setColor: (c: string) => void;
      setWidth: (w: number) => void;
      toggleGlow: () => void;
      toggleDash: () => void;
      toggleFloat: () => void;
      rename: (label: string) => void;
    }
  | {
      kind: "unit";
      unit: PlacedUnit;
      path: UnitPath | undefined;
      setColor: (c: string) => void;
      updateUnit: (changes: Partial<Pick<PlacedUnit, "label" | "color" | "effect" | "bearing" | "target" | "groundCircle" | "animating" | "loopMs">>) => void;
      startPathDrawing: () => void;
      finishPathDrawing: () => void;
      cancelPathDrawing: () => void;
      deletePath: () => void;
    }
  | null;

const TYPE_ICON: Record<AnnotationType, React.ReactNode> = {
  pin:   <MapPin    className="size-3.5" />,
  line:  <Spline    className="size-3.5" />,
  arrow: <MoveRight className="size-3.5" />,
  area:  <Pentagon  className="size-3.5" />,
};

const TYPE_LABEL: Record<AnnotationType, string> = {
  pin: "Pin", line: "Line", arrow: "Arrow", area: "Area",
};

/* ── List item ───────────────────────────────────────────── */

interface ListItemProps {
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

/* ── SavedItemsContent (flat list, pushes SelectionSync up) ── */

type SelectedItem = { kind: "ann"; id: string } | { kind: "unit"; id: string } | null;

export function SavedItemsContent({ onSelectionChange }: { onSelectionChange?: (sel: SelectionSync) => void }) {
  const ann = useAnnotationListContext();
  const drawing = useDrawingContext();
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

  // Find the selected item
  const selectedAnn = selected?.kind === "ann" ? ann.annotations.find(a => a.id === selected.id) : null;
  const selectedUnit = selected?.kind === "unit" ? up.units.find(u => u.id === selected.id) : null;
  const selectedUnitPath = selectedUnit?.pathId ? up.paths.find(p => p.id === selectedUnit.pathId) : undefined;

  // Push selection sync up to parent
  useEffect(() => {
    if (!onSelectionChange) return;
    if (selectedAnn) {
      onSelectionChange({
        kind: "ann",
        ann: selectedAnn,
        setColor: (c) => ann.setAnnotationColor(selectedAnn.id, c),
        setWidth: (w) => ann.setAnnotationWidth(selectedAnn.id, w),
        toggleGlow: () => ann.toggleGlow(selectedAnn.id),
        toggleDash: () => ann.toggleDash(selectedAnn.id),
        toggleFloat: () => ann.toggleAnnotationFloat(selectedAnn.id),
        rename: (label) => ann.renameAnnotation(selectedAnn.id, label),
      });
    } else if (selectedUnit) {
      onSelectionChange({
        kind: "unit",
        unit: selectedUnit,
        path: selectedUnitPath,
        setColor: (c) => up.updateUnit(selectedUnit.id, { color: c }),
        updateUnit: (changes) => up.updateUnit(selectedUnit.id, changes),
        startPathDrawing: () => { drawing.cancel(); up.startPathDrawing(selectedUnit.id); },
        finishPathDrawing: () => up.finishPathDrawing(),
        cancelPathDrawing: () => up.cancelPathDrawing(),
        deletePath: () => up.deletePath(selectedUnit.id),
      });
    } else {
      onSelectionChange(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAnn?.id, selectedAnn?.color, selectedAnn?.width, selectedAnn?.glow, selectedAnn?.dash, selectedAnn?.float,
      selectedUnit?.id, selectedUnit?.color, selectedUnit?.effect, selectedUnit?.target, selectedUnit?.groundCircle,
      selectedUnit?.animating, selectedUnit?.pathId, selectedUnitPath?.id]);

  function handleAnnDragOver(e: React.DragEvent) { e.preventDefault(); }
  function handleAnnDrop(toIndex: number) {
    if (dragAnnIdx.current !== -1 && dragAnnIdx.current !== toIndex) {
      ann.reorderAnnotation(ann.annotations[dragAnnIdx.current].id, toIndex);
    }
    dragAnnIdx.current = -1;
  }

  function handleUnitDragOver(e: React.DragEvent) { e.preventDefault(); }
  function handleUnitDrop(toIndex: number) {
    if (dragUnitIdx.current !== -1 && dragUnitIdx.current !== toIndex) {
      up.reorderUnit(up.units[dragUnitIdx.current].id, toIndex);
    }
    dragUnitIdx.current = -1;
  }

  return (
    <div className="flex flex-col gap-0.5 overflow-y-auto" style={{ maxHeight: "calc(50vh - 6rem)" }}>
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
  );
}
