import { Layers, Mountain, MapPin, Flame, Waves, Landmark, Map, Navigation, Plane, Ship } from "lucide-react";
import { CollapsePanel, FloatingTriggerBtn } from "./FloatingPanel";

export interface LayerVisibility {
  terrain: boolean;
  hillshade: boolean;
  markers: boolean;
  heatmap: boolean;
  rivers: boolean;
  frontLines: boolean;
  territory: boolean;
  infrastructure: boolean;
  governorates: boolean;
  units: boolean;
  flights: boolean;
  ships: boolean;
  geoLabels: boolean;
}

interface MapLayerControlsProps {
  layers: LayerVisibility;
  onChange: (layers: LayerVisibility) => void;
  open: boolean;
  onToggle: () => void;
  showLabels?: boolean;
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
  {
    heading: "Intelligence",
    items: [
      { key: "markers",  label: "Events",   Icon: MapPin },
      { key: "heatmap",  label: "Heatmap",  Icon: Flame },
      { key: "units",    label: "Units",    Icon: Navigation },
      { key: "flights",  label: "Flights",  Icon: Plane },
      { key: "ships",    label: "Ships",    Icon: Ship },
    ],
  },
  {
    heading: "Political",
    items: [
      { key: "governorates",   label: "Muhafazat",      Icon: Map },
      { key: "infrastructure", label: "Infrastructure", Icon: Landmark },
    ],
  },
];

export function MapLayerControls({ layers, onChange, open, onToggle, showLabels }: MapLayerControlsProps) {
  function toggle(key: keyof LayerVisibility) {
    onChange({ ...layers, [key]: !layers[key] });
  }

  return (
    <div className="absolute top-[10px] left-3 z-10 flex flex-col items-start gap-1">
      <FloatingTriggerBtn onClick={onToggle} aria-label={open ? "Close layers" : "Open layers"} showLabels={showLabels}>
        <Layers className="size-3.5" />
        Layers
      </FloatingTriggerBtn>

      <CollapsePanel open={open}>
        <div className="glass-panel p-2 w-48 max-h-[calc(50vh-3rem)] overflow-y-auto">
          {LAYER_GROUPS.map(({ heading, items }) => (
            <div key={heading}>
              <p className="px-2 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 first:pt-1">
                {heading}
              </p>
              {items.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => toggle(key)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-muted"
                >
                  <Icon className={`size-3.5 ${layers[key] ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={layers[key] ? "text-foreground" : "text-muted-foreground"}>
                    {label}
                  </span>
                  <span className={`ml-auto h-4 w-7 rounded-full border border-border transition-colors ${layers[key] ? "bg-primary" : "bg-muted"}`}>
                    <span className={`block h-4 w-4 rounded-full border border-border bg-card shadow transition-transform ${layers[key] ? "translate-x-3" : "translate-x-0"}`} />
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </CollapsePanel>
    </div>
  );
}
