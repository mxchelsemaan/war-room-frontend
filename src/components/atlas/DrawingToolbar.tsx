import { useState } from "react";
import { Pencil, MapPin, Spline, Pentagon, MoveRight, Sparkles, Trash2, Eye, EyeOff, Map, Layers, Minus, Palette } from "lucide-react";
import { CollapsePanel, FloatingTriggerBtn } from "./FloatingPanel";
import { ColorPickerButton } from "./ColorPickerPopover";
import type { Annotation, AnnotationType, ArrowStyle } from "@/hooks/useDrawing";
import { DRAW_COLOR_PRESETS } from "@/hooks/useDrawing";

interface DrawingToolbarProps {
  mode: AnnotationType | null;
  color: string;
  drawWidth: number;
  drawArrowStyle: ArrowStyle;
  annotations: Annotation[];
  open: boolean;
  onToggle: () => void;
  onStartDrawing: (mode: AnnotationType) => void;
  onSetColor: (color: string) => void;
  onSetWidth: (width: number) => void;
  onSetArrowStyle: (style: ArrowStyle) => void;
  onCancel: () => void;
  onDeleteAnnotation: (id: string) => void;
  onRenameAnnotation: (id: string, label: string) => void;
  onToggleGlow: (id: string) => void;
  onToggleDash: (id: string) => void;
  onToggleLabel: (id: string) => void;
  onToggleAnnotationFloat: (id: string) => void;
  onSetAnnotationColor: (id: string, color: string) => void;
  onSetAnnotationWidth: (id: string, width: number) => void;
  direction?: "up" | "down";
  showLabels?: boolean;
}

const MODE_STATUS: Record<AnnotationType, string> = {
  pin:   "Click map to place pin",
  line:  "Click to add points · Esc to finish",
  arrow: "Click to add points · Esc to finish",
  area:  "Click to add points · Esc to close",
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

/* ── Segmented toggle ──────────────────────────────────────── */

function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-border text-[11px] font-medium">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex flex-1 items-center justify-center gap-1 py-1.5 transition-colors ${
            value === o.value
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted text-muted-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── Annotation row ────────────────────────────────────────── */

interface AnnRowProps {
  ann: Annotation;
  editingId: string | null;
  editLabel: string;
  onStartEdit: (ann: Annotation) => void;
  onEditChange: (v: string) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onToggleGlow: () => void;
  onToggleDash: () => void;
  onToggleLabel: () => void;
  onToggleFloat: () => void;
  onSetColor: (color: string) => void;
  onSetWidth: (width: number) => void;
}

function AnnotationRow({
  ann, editingId, editLabel,
  onStartEdit, onEditChange, onCommitEdit, onCancelEdit,
  onDelete, onToggleGlow, onToggleDash, onToggleLabel, onToggleFloat, onSetColor, onSetWidth,
}: AnnRowProps) {
  const isEditing = editingId === ann.id;
  const [styleOpen, setStyleOpen] = useState(false);

  return (
    <div className={`flex flex-col rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border overflow-hidden ${styleOpen ? "border-primary/60" : "border-border/40"}`}>
      {/* Name row */}
      <div className="flex items-center gap-2 px-2.5 pt-2 pb-1">
        {/* Color dot — click toggles inline style editor */}
        <button
          className={`size-3.5 rounded-full shrink-0 ring-1 hover:scale-125 transition-transform ${styleOpen ? "ring-primary" : "ring-white/20"}`}
          style={{ background: ann.color }}
          onClick={() => setStyleOpen((prev) => !prev)}
          title="Edit color &amp; width"
        />

        {/* Type icon */}
        <span className="shrink-0 text-muted-foreground/60">{TYPE_ICON[ann.type]}</span>

        {/* Label / edit */}
        {isEditing ? (
          <input
            autoFocus
            value={editLabel}
            placeholder="Name (optional)"
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCommitEdit();
              if (e.key === "Escape") onCancelEdit();
            }}
            onBlur={onCommitEdit}
            className="w-0 flex-1 rounded border border-border bg-background px-1.5 py-0.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        ) : (
          <button
            className="text-xs truncate flex-1 text-left hover:text-primary transition-colors"
            style={{ color: ann.label ? undefined : "var(--color-muted-foreground)", fontStyle: ann.label ? undefined : "italic" }}
            onClick={() => onStartEdit(ann)}
            title="Click to rename"
          >
            {ann.label || "unnamed"}
          </button>
        )}

        {/* Delete */}
        <button
          onClick={onDelete}
          className="shrink-0 text-muted-foreground/40 hover:text-red-400 transition-colors p-0.5 rounded"
          title="Delete annotation"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {/* Inline style editor */}
      {styleOpen && (
        <div className="flex flex-col gap-2 px-2.5 py-2 border-t border-border/30 bg-muted/20">
          {/* Color swatches */}
          <div className="flex items-center gap-2 flex-wrap">
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
                className="size-4.5 rounded-full transition-all hover:opacity-100 hover:scale-110"
                title={c}
              />
            ))}
            <ColorPickerButton color={ann.color} onChange={onSetColor} />
          </div>
          {/* Width buttons (hidden for pins) */}
          {ann.type !== "pin" && (
            <div className="flex rounded-lg border border-border overflow-hidden">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((w) => (
                <button
                  key={w}
                  onClick={() => onSetWidth(w)}
                  className={`flex-1 py-1 text-[10px] font-medium transition-colors ${
                    ann.width === w
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-muted-foreground"
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action strip */}
      <div className="flex items-stretch border-t border-border/30">
        <ToggleChip
          active={ann.glow}
          onClick={onToggleGlow}
          activeClass="text-yellow-300 bg-yellow-400/10"
          icon={<Sparkles className="size-3" />}
          label="Glow"
          title={ann.glow ? "Remove glow effect" : "Add pulsing glow"}
        />
        {ann.type !== "pin" && (
          <ToggleChip
            active={ann.dash}
            onClick={onToggleDash}
            activeClass="text-sky-300 bg-sky-400/10"
            icon={<Minus className="size-3" />}
            label="Dash"
            title={ann.dash ? "Make solid" : "Make dashed"}
          />
        )}
        <ToggleChip
          active={ann.showLabel}
          onClick={onToggleLabel}
          activeClass="text-foreground bg-foreground/10"
          icon={ann.showLabel ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
          label="Label"
          title={ann.showLabel ? "Hide label" : "Show label"}
        />
        <ToggleChip
          active={styleOpen}
          onClick={() => setStyleOpen((prev) => !prev)}
          activeClass="text-orange-300 bg-orange-400/10"
          icon={<Palette className="size-3" />}
          label="Style"
          title={styleOpen ? "Close style editor" : "Edit color & width"}
        />
        {ann.type !== "pin" && (
          <ToggleChip
            active={ann.float}
            onClick={onToggleFloat}
            activeClass="text-violet-300 bg-violet-400/10"
            icon={ann.float ? <Layers className="size-3" /> : <Map className="size-3" />}
            label={ann.float ? "Float" : "Map"}
            title={ann.float ? "Switch to on-map (drapes terrain)" : "Switch to float (SVG overlay)"}
          />
        )}
      </div>
    </div>
  );
}

function ToggleChip({
  active, onClick, activeClass, icon, label, title,
}: {
  active: boolean;
  onClick: () => void;
  activeClass: string;
  icon: React.ReactNode;
  label: string;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex flex-1 flex-col items-center gap-0.5 px-1 py-1.5 text-[10px] font-medium transition-colors ${
        active ? activeClass : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/* ── Main component ────────────────────────────────────────── */

export function DrawingToolbar({
  mode, color, drawWidth, drawArrowStyle, annotations, open, onToggle,
  onStartDrawing, onSetColor, onSetWidth, onSetArrowStyle, onCancel,
  onDeleteAnnotation, onRenameAnnotation, onToggleGlow, onToggleDash, onToggleLabel,
  onToggleAnnotationFloat, onSetAnnotationColor, onSetAnnotationWidth,
  direction = "up", showLabels,
}: DrawingToolbarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  function startEdit(ann: Annotation) {
    setEditingId(ann.id);
    setEditLabel(ann.label);
  }

  function commitEdit() {
    if (editingId !== null) {
      onRenameAnnotation(editingId, editLabel.trim());
    }
    setEditingId(null);
  }

  function handleModeBtn(m: AnnotationType) {
    if (mode === m) onCancel();
    else onStartDrawing(m);
  }

  const trigger = (
    <FloatingTriggerBtn
      onClick={onToggle}
      aria-label={open ? "Close annotate tools" : "Open annotate tools"}
      className={mode ? "text-primary" : undefined}
      showLabels={showLabels}
    >
      {mode ? TYPE_ICON[mode] : <Pencil className="size-3.5" />}
      {mode ? MODE_LABEL[mode] : "Annotate"}
      {annotations.length > 0 && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground leading-none">
          {annotations.length}
        </span>
      )}
    </FloatingTriggerBtn>
  );

  const panel = (
    <CollapsePanel open={open} direction={direction}>
      <div className="glass-panel p-3 w-72 flex flex-col gap-3 mb-1">

        {/* ── Tool grid ── */}
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Tool</span>
          <div className="grid grid-cols-4 gap-1.5">
            {(["pin", "line", "arrow", "area"] as AnnotationType[]).map((m) => (
              <button
                key={m}
                onClick={() => handleModeBtn(m)}
                title={MODE_LABEL[m]}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-lg py-3 text-[11px] font-medium transition-colors ${
                  mode === m
                    ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {TYPE_ICON[m]}
                <span>{MODE_LABEL[m]}</span>
              </button>
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
                onClick={() => onSetColor(c)}
                style={{
                  background: c,
                  outline: color === c ? `2px solid ${c}` : undefined,
                  outlineOffset: color === c ? "2px" : undefined,
                  opacity: color === c ? 1 : 0.55,
                }}
                className="size-5 rounded-full transition-all hover:opacity-100 hover:scale-110"
                title={c}
              />
            ))}
            <ColorPickerButton color={color} onChange={onSetColor} />
          </div>
        </div>

        {/* ── Width ── */}
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">Width</span>
          <div className="flex flex-1 rounded-lg border border-border overflow-hidden">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((w) => (
              <button
                key={w}
                onClick={() => onSetWidth(w)}
                className={`flex-1 py-1.5 text-[11px] font-medium transition-colors ${
                  drawWidth === w
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground"
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

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

        {/* ── Active tool hint ── */}
        {mode && (
          <div className="rounded-lg bg-amber-400/10 border border-amber-400/20 px-3 py-2 flex items-start gap-2">
            <span className="size-1.5 rounded-full bg-amber-400 animate-pulse mt-1 shrink-0" />
            <p className="text-[11px] leading-snug">
              <span className="text-amber-400/90">{MODE_STATUS[mode]}</span>
              {mode !== "pin" && <span className="text-muted-foreground"> · double-click also works</span>}
            </p>
          </div>
        )}

        {/* ── Annotation list ── */}
        {annotations.length > 0 && (
          <>
            <div className="border-t border-border" />
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Annotations
                </span>
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-medium text-muted-foreground leading-none">
                  {annotations.length}
                </span>
              </div>
              <div className="max-h-56 overflow-y-auto flex flex-col gap-1.5">
                {annotations.map((ann) => (
                  <AnnotationRow
                    key={ann.id}
                    ann={ann}
                    editingId={editingId}
                    editLabel={editLabel}
                    onStartEdit={startEdit}
                    onEditChange={setEditLabel}
                    onCommitEdit={commitEdit}
                    onCancelEdit={() => setEditingId(null)}
                    onDelete={() => onDeleteAnnotation(ann.id)}
                    onToggleGlow={() => onToggleGlow(ann.id)}
                    onToggleDash={() => onToggleDash(ann.id)}
                    onToggleLabel={() => onToggleLabel(ann.id)}
                    onToggleFloat={() => onToggleAnnotationFloat(ann.id)}
                    onSetColor={(c) => onSetAnnotationColor(ann.id, c)}
                    onSetWidth={(w) => onSetAnnotationWidth(ann.id, w)}
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
      {direction === "down" ? (
        <>{trigger}{panel}</>
      ) : (
        <>{panel}{trigger}</>
      )}
    </div>
  );
}
