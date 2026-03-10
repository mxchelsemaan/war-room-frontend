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

const SHIP_TYPE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  cargo:  { bg: "#14532d", color: "#4ade80", label: "Cargo"  },
  tanker: { bg: "#451a03", color: "#fbbf24", label: "Tanker" },
  patrol: { bg: "#1e3a5f", color: "#60a5fa", label: "Patrol" },
  naval:  { bg: "#3f0f0f", color: "#f87171", label: "Naval"  },
};

export function MapLegend({ open, onToggle, layers, eventTypes, showLabels, placedUnits = [] }: MapLegendProps) {
  const hasContent =
    layers.markers ||
    layers.infrastructure ||
    layers.units ||
    layers.flights ||
    layers.ships ||
    layers.frontLines ||
    layers.territory;

  return (
    <div className="absolute bottom-4 left-3 z-10 flex flex-col-reverse items-start gap-1">
      <FloatingTriggerBtn onClick={onToggle} aria-label={open ? "Close legend" : "Open legend"} showLabels={showLabels}>
        <Shield className="size-3.5" />
        Legend
      </FloatingTriggerBtn>

      <CollapsePanel open={open} direction="up">
        <div className="glass-panel p-3 w-56 max-h-[calc(100vh-8rem)] overflow-y-auto space-y-3">

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

          {/* ── Flights ────────────────────────────────────────────────────── */}
          {layers.flights && (
            <Section title="Flights">
              <Row left={<span className="text-xs font-mono leading-none">↙</span>} label="Arrival" />
              <Row left={<span className="text-xs font-mono leading-none">↗</span>} label="Departure" />
              <Row
                left={
                  <svg width="24" height="4" viewBox="0 0 24 4" className="shrink-0">
                    <line x1="0" y1="2" x2="24" y2="2" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3"/>
                  </svg>
                }
                label="Route"
              />
            </Section>
          )}

          {/* ── Ships ──────────────────────────────────────────────────────── */}
          {layers.ships && (
            <Section title="Ships">
              {Object.entries(SHIP_TYPE_STYLES).map(([type, s]) => (
                <Row
                  key={type}
                  left={
                    <span
                      className="inline-block text-[7px] font-bold font-mono px-[3px] py-px rounded-sm leading-[1.4] whitespace-nowrap"
                      style={{ background: s.bg, color: s.color }}
                    >
                      {s.label.toUpperCase()}
                    </span>
                  }
                  label={s.label}
                />
              ))}
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
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
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
