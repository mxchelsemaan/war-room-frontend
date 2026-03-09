import { Layers, Mountain, MapPin, Waves, Landmark, Map, Navigation, Plane, Ship, Pencil } from "lucide-react";
import { CollapsePanel, FloatingTriggerBtn } from "./FloatingPanel";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Switch } from "@/components/ui/switch";

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
      { key: "flights",  label: "Flights",  Icon: Plane },
      { key: "ships",    label: "Ships",    Icon: Ship },
    ],
  },
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
      { key: "governorates",   label: "Muhafazat",      Icon: Map },
      { key: "infrastructure", label: "Infrastructure", Icon: Landmark },
    ],
  },
];

export function MapLayerControls({ layers, onChange, open, onToggle, showLabels }: MapLayerControlsProps) {
  const isMobile = useIsMobile();

  function toggle(key: keyof LayerVisibility) {
    onChange({ ...layers, [key]: !layers[key] });
  }

  const visibleGroups = LAYER_GROUPS
    .map(g => ({ ...g, items: isMobile ? g.items.filter(i => i.key !== "terrain") : g.items }))
    .filter(g => g.items.length > 0);

  return (
    <div className="flex flex-col items-start gap-1">
      <FloatingTriggerBtn onClick={onToggle} aria-label={open ? "Close layers" : "Open layers"} showLabels={showLabels}>
        <Layers className="size-3.5" />
        Layers
      </FloatingTriggerBtn>

      <CollapsePanel open={open}>
        <div className="glass-panel p-2 w-48 max-h-[calc(50vh-3rem)] overflow-y-auto">
          {visibleGroups.map(({ heading, items }) => (
            <div key={heading}>
              <p className="px-2 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 first:pt-1">
                {heading}
              </p>
              {items.map(({ key, label, Icon }) => (
                <div
                  key={key}
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
              ))}
            </div>
          ))}
        </div>
      </CollapsePanel>
    </div>
  );
}
