import { useState } from "react";
import { Layers, Mountain, Waves, Landmark, Map, Navigation, Pencil, Settings2 } from "lucide-react";
import { CollapsePanel, FloatingTriggerBtn } from "./FloatingPanel";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import type { HeatmapSettings, MonitorMode } from "@/config/map";
import { HEATMAP_COLOR_SCHEMES, HEATMAP_PRESETS } from "@/config/map";

export interface LayerVisibility {
  terrain: boolean;
  hillshade: boolean;
  markers: boolean;
  rivers: boolean;
  frontLines: boolean;
  territory: boolean;
  infrastructure: boolean;
  governorates: boolean;
  annotations: boolean;
  units: boolean;
  heatmap: boolean;
  geoLabels: boolean;
  subgovernorates: boolean;
}

interface MapLayerControlsProps {
  layers: LayerVisibility;
  onChange: (layers: LayerVisibility) => void;
  open: boolean;
  onToggle: () => void;
  showLabels?: boolean;
  bigger?: boolean;
  heatmapSettings?: HeatmapSettings;
  onHeatmapSettingsChange?: (settings: HeatmapSettings) => void;
  monitorMode?: MonitorMode;
  onMonitorModeChange?: (mode: MonitorMode) => void;
}

type LayerDef = { key: keyof LayerVisibility; label: string; Icon: React.ElementType };

const LAYER_GROUPS: { heading: string; items: LayerDef[] }[] = [
  {
    heading: "Terrain",
    items: [
      { key: "terrain", label: "3D Terrain", Icon: Mountain },
    ],
  },
  {
    heading: "Environment",
    items: [
      { key: "rivers", label: "Rivers", Icon: Waves },
    ],
  },
  // Intelligence group is rendered separately with monitor mode selector
  {
    heading: "Annotations",
    items: [
      { key: "annotations", label: "Shapes", Icon: Pencil },
      { key: "units",       label: "Units",  Icon: Navigation },
    ],
  },
  {
    heading: "Political",
    items: [
      { key: "governorates",      label: "Governorates",      Icon: Map },
      { key: "subgovernorates",  label: "Districts",         Icon: Map },
      { key: "infrastructure",   label: "Infrastructure",    Icon: Landmark },
    ],
  },
];

const MONITOR_OPTIONS: { value: MonitorMode; label: React.ReactNode }[] = [
  { value: "auto", label: "Auto" },
  { value: "heatmap", label: "Heat" },
  { value: "markers", label: "Pins" },
];

const schemeKeys = Object.keys(HEATMAP_COLOR_SCHEMES);
const presetKeys = Object.keys(HEATMAP_PRESETS);

function HeatmapConfig({ settings, onChange }: { settings: HeatmapSettings; onChange: (s: HeatmapSettings) => void }) {
  const activePreset = HEATMAP_PRESETS[settings.preset] ?? HEATMAP_PRESETS.all_events;

  return (
    <div className="px-2 pb-2 pt-1 space-y-2.5" onClick={(e) => e.stopPropagation()}>
      {/* Data Source presets */}
      <div className="space-y-1">
        <span className="text-[10px] text-muted-foreground">Data Source</span>
        <div className="flex flex-wrap gap-1">
          {presetKeys.map((key) => {
            const p = HEATMAP_PRESETS[key];
            const active = settings.preset === key;
            return (
              <button
                key={key}
                onClick={() => onChange({ ...settings, preset: key })}
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border transition-all ${
                  active
                    ? "border-primary ring-1 ring-primary/40 bg-primary/10 text-foreground"
                    : "border-border/50 hover:border-border text-muted-foreground"
                }`}
              >
                <span>{p.icon}</span>
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[9px] text-muted-foreground/70 leading-tight">{activePreset.description}</p>
      </div>
      {/* Radius */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Radius</span>
          <span className="text-[10px] text-muted-foreground tabular-nums">{settings.radius}</span>
        </div>
        <Slider
          min={10} max={60} step={1}
          value={[settings.radius]}
          onValueChange={([v]) => onChange({ ...settings, radius: v })}
        />
      </div>
      {/* Intensity */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Intensity</span>
          <span className="text-[10px] text-muted-foreground tabular-nums">{settings.intensity.toFixed(1)}</span>
        </div>
        <Slider
          min={5} max={40} step={1}
          value={[settings.intensity * 10]}
          onValueChange={([v]) => onChange({ ...settings, intensity: v / 10 })}
        />
      </div>
      {/* Opacity */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Opacity</span>
          <span className="text-[10px] text-muted-foreground tabular-nums">{settings.opacity.toFixed(2)}</span>
        </div>
        <Slider
          min={4} max={20} step={1}
          value={[settings.opacity * 20]}
          onValueChange={([v]) => onChange({ ...settings, opacity: v / 20 })}
        />
      </div>
      {/* Color scheme swatches */}
      <div className="space-y-1">
        <span className="text-[10px] text-muted-foreground">Color Scheme</span>
        <div className="flex gap-1.5">
          {schemeKeys.map((key) => {
            const scheme = HEATMAP_COLOR_SCHEMES[key];
            const gradient = scheme.stops
              .filter(([, c]) => !c.includes("rgba"))
              .map(([, c]) => c)
              .join(", ");
            return (
              <button
                key={key}
                title={scheme.label}
                onClick={() => onChange({ ...settings, colorScheme: key })}
                className={`h-5 flex-1 rounded-sm border transition-all ${
                  settings.colorScheme === key
                    ? "border-primary ring-1 ring-primary/40 scale-105"
                    : "border-border/50 hover:border-border"
                }`}
                style={{ background: `linear-gradient(90deg, ${gradient})` }}
              />
            );
          })}
        </div>
      </div>
      {/* Render mode — Float (above map) or Surface (draped on terrain) */}
      <div className="space-y-1">
        <span className="text-[10px] text-muted-foreground">Render Mode</span>
        <SegmentedToggle<"float" | "surface">
          options={[
            { value: "float", label: "Float" },
            { value: "surface", label: "Surface" },
          ]}
          value={settings.drapeOnTerrain ? "surface" : "float"}
          onChange={(v) => onChange({ ...settings, drapeOnTerrain: v === "surface" })}
        />
      </div>
    </div>
  );
}

export function MapLayerControls({ layers, onChange, open, onToggle, showLabels, bigger, heatmapSettings, onHeatmapSettingsChange, monitorMode = "auto", onMonitorModeChange }: MapLayerControlsProps) {
  const isMobile = useIsMobile();
  const [heatmapConfigOpen, setHeatmapConfigOpen] = useState(false);

  function toggle(key: keyof LayerVisibility) {
    onChange({ ...layers, [key]: !layers[key] });
  }

  const showHeatmapConfig = monitorMode === "auto" || monitorMode === "heatmap";

  const visibleGroups = LAYER_GROUPS
    .map(g => ({ ...g, items: isMobile ? g.items.filter(i => i.key !== "terrain") : g.items }))
    .filter(g => g.items.length > 0);

  return (
    <div className="relative flex flex-col items-center gap-1">
      <div className={`absolute top-1/2 -translate-y-1/2 left-full ml-2 w-56${open ? "" : " pointer-events-none"}`}>
        <CollapsePanel open={open} direction="right">
          <div className="glass-panel p-2 max-h-[calc(100vh-14rem)] overflow-y-auto">
          {/* Intelligence — Event Monitor */}
          <div>
            <p className="px-2 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Intelligence
            </p>
            <div className="px-2 py-1.5 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                {showHeatmapConfig && heatmapSettings && onHeatmapSettingsChange && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setHeatmapConfigOpen(!heatmapConfigOpen); }}
                    className="ml-auto p-0.5 rounded hover:bg-muted-foreground/20 transition-colors"
                    aria-label="Heatmap settings"
                  >
                    <Settings2 className={`size-3 ${heatmapConfigOpen ? "text-primary" : "text-muted-foreground"}`} />
                  </button>
                )}
              </div>
              {onMonitorModeChange && (
                <SegmentedToggle<MonitorMode>
                  options={MONITOR_OPTIONS}
                  value={monitorMode}
                  onChange={onMonitorModeChange}
                />
              )}
            </div>
            {showHeatmapConfig && heatmapConfigOpen && heatmapSettings && onHeatmapSettingsChange && (
              <HeatmapConfig settings={heatmapSettings} onChange={onHeatmapSettingsChange} />
            )}
          </div>

          {visibleGroups.map(({ heading, items }) => (
            <div key={heading}>
              <p className="px-2 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 first:pt-1">
                {heading}
              </p>
              {items.map(({ key, label, Icon }) => (
                <div key={key}>
                  <div
                    onClick={() => toggle(key)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" || e.key === " " ? toggle(key) : undefined}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 min-h-[44px] md:min-h-0 text-xs transition-colors hover:bg-muted cursor-pointer"
                  >
                    <Icon className={`size-3.5 ${layers[key] ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={layers[key] ? "text-foreground" : "text-muted-foreground"}>
                      {label}
                    </span>
                    <Switch checked={layers[key]} className="ml-auto pointer-events-none scale-75" />
                  </div>
                </div>
              ))}
            </div>
          ))}
          </div>
        </CollapsePanel>
      </div>
      <FloatingTriggerBtn onClick={onToggle} aria-label={open ? "Close layers" : "Open layers"} showLabels={showLabels} open={open} panelSide="right" className={bigger ? "px-4 py-3.5 md:px-3.5 md:py-3" : undefined}>
        <Layers className={bigger ? "size-4" : "size-3.5"} />
        Layers
      </FloatingTriggerBtn>
    </div>
  );
}
