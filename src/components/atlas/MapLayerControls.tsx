import { Layers, Mountain, Waves, Landmark, Map, Navigation, Pencil } from "lucide-react";
import { CollapsePanel, FloatingTriggerBtn } from "./FloatingPanel";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Switch } from "@/components/ui/switch";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import type { MonitorMode } from "@/config/map";

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

export function MapLayerControls({ layers, onChange, open, onToggle, showLabels, bigger, monitorMode = "auto", onMonitorModeChange }: MapLayerControlsProps) {
  const isMobile = useIsMobile();

  function toggle(key: keyof LayerVisibility) {
    onChange({ ...layers, [key]: !layers[key] });
  }

  const visibleGroups = LAYER_GROUPS
    .map(g => ({ ...g, items: isMobile ? g.items.filter(i => i.key !== "terrain") : g.items }))
    .filter(g => g.items.length > 0);

  return (
    <div className="relative flex flex-col items-center gap-1">
      <div className={`absolute top-1/2 -translate-y-1/2 left-full ml-2 w-64${open ? "" : " pointer-events-none"}`}>
        <CollapsePanel open={open} direction="right">
          <div className="glass-panel p-2 max-h-[calc(100vh-10rem)] overflow-y-auto" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          {/* Intelligence — Event Monitor */}
          <div>
            <p className="px-2 pt-1 pb-0.5 section-heading">
              Intelligence
            </p>
            <div className="px-2 py-1.5">
              {onMonitorModeChange && (
                <SegmentedToggle<MonitorMode>
                  options={MONITOR_OPTIONS}
                  value={monitorMode}
                  onChange={onMonitorModeChange}
                />
              )}
            </div>
          </div>

          {visibleGroups.map(({ heading, items }) => (
            <div key={heading}>
              <p className="px-2 pt-2 pb-0.5 section-heading first:pt-1">
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
                    <Switch checked={layers[key]} size="sm" className="ml-auto pointer-events-none" />
                  </div>
                </div>
              ))}
            </div>
          ))}
          </div>
        </CollapsePanel>
      </div>
      <FloatingTriggerBtn onClick={onToggle} aria-label={open ? "Close layers" : "Open layers"} showLabels={showLabels} open={open} className={bigger ? "px-3 py-2.5 md:px-2.5 md:py-2" : undefined}>
        <Layers className={bigger ? "size-3.5" : "size-3.5"} />
        Layers
      </FloatingTriggerBtn>
    </div>
  );
}
