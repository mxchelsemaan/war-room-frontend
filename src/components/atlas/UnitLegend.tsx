import { Shield } from "lucide-react";
import { CollapsePanel, FloatingTriggerBtn } from "./FloatingPanel";
import type { LayerVisibility } from "./MapLayerControls";
import type { EventType } from "@/data/index";
import { STATIC_MARKER_META, STATIC_MARKER_COLORS } from "@/data/staticMarkers";
import type { StaticMarkerType } from "@/data/staticMarkers";
import type { PlacedUnit } from "@/types/units";

interface MapLegendProps {
  open: boolean;
  onToggle: () => void;
  layers: LayerVisibility;
  eventTypes: EventType[];
  showLabels?: boolean;
  placedUnits?: PlacedUnit[];
}

export function MapLegend({ open, onToggle, layers, eventTypes, showLabels, placedUnits = [] }: MapLegendProps) {
  const hasContent =
    layers.markers ||
    layers.infrastructure ||
    layers.units ||
    layers.frontLines ||
    layers.territory;

  return (
    <div className="relative flex flex-col items-center gap-1">
      <div className={`absolute bottom-full left-0 mb-1 w-64${open ? "" : " pointer-events-none"}`}>
      <CollapsePanel open={open} direction="up">
        <div className="glass-panel p-3 max-h-[calc(100vh-10rem)] overflow-y-auto space-y-3" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>

          {!hasContent && (
            <p className="text-xs text-muted-foreground italic">No active layers.</p>
          )}

          {/* ── Events ─────────────────────────────────────────────────────── */}
          {layers.markers && eventTypes.length > 0 && (
            <Section title="Events">
              {eventTypes.map(et => (
                <Row key={et.key} left={<Emoji>{et.icon}</Emoji>} label={et.label} />
              ))}
            </Section>
          )}

          {/* ── Infrastructure ─────────────────────────────────────────────── */}
          {layers.infrastructure && (
            <Section title="Infrastructure">
              {(Object.entries(STATIC_MARKER_META) as [StaticMarkerType, { label: string; icon: string }][]).map(([type, meta]) => (
                <Row
                  key={type}
                  left={<Emoji>{meta.icon}</Emoji>}
                  label={meta.label}
                  right={
                    <span
                      className="inline-block w-[7px] h-[7px] rounded-full"
                      style={{
                        background: STATIC_MARKER_COLORS[type],
                        boxShadow: `0 0 4px ${STATIC_MARKER_COLORS[type]}88`,
                      }}
                    />
                  }
                />
              ))}
            </Section>
          )}

          {/* ── Units ──────────────────────────────────────────────────────── */}
          {layers.units && (
            <Section title="Units">
              {placedUnits.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No units placed.</p>
              ) : (
                placedUnits.map((unit) => (
                  <Row
                    key={unit.id}
                    left={
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-sm"
                        style={{
                          background: unit.color,
                          boxShadow: `0 0 4px ${unit.color}88`,
                        }}
                      />
                    }
                    label={unit.label}
                  />
                ))
              )}
            </Section>
          )}

          {/* ── Front lines ────────────────────────────────────────────────── */}
          {layers.frontLines && (
            <Section title="Front Lines">
              <Row
                left={
                  <svg width="24" height="6" viewBox="0 0 24 6" className="shrink-0">
                    <line x1="0" y1="3" x2="24" y2="3" stroke="#ff5858" strokeWidth="2" strokeDasharray="4 3"/>
                  </svg>
                }
                label="Contact line"
              />
            </Section>
          )}

          {/* ── Territory ──────────────────────────────────────────────────── */}
          {layers.territory && (
            <Section title="Territory">
              {[
                { key: "idf",       color: "#ef4444", label: "IDF"       },
                { key: "hezbollah", color: "#f59e0b", label: "Hezbollah" },
              ].map((f) => (
                <Row
                  key={f.key}
                  left={
                    <span
                      className="inline-block w-3.5 h-2.5 rounded-sm border"
                      style={{
                        background: f.color + "33",
                        borderColor: f.color + "88",
                      }}
                    />
                  }
                  label={f.label}
                />
              ))}
            </Section>
          )}


        </div>
      </CollapsePanel>
      </div>
      <FloatingTriggerBtn onClick={onToggle} aria-label={open ? "Close legend" : "Open legend"} showLabels={showLabels} open={open}>
        <Shield className="size-3.5" />
        Legend
      </FloatingTriggerBtn>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 section-heading">
        {title}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({
  left,
  label,
  right,
}: {
  left: React.ReactNode;
  label: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 flex items-center justify-center w-[24px] h-[14px]">{left}</span>
      <span className="text-xs text-foreground">{label}</span>
      {right && <span className="ml-auto">{right}</span>}
    </div>
  );
}

function Emoji({ children }: { children: string }) {
  return <span className="text-sm leading-none">{children}</span>;
}
