import { Popup } from "react-map-gl/maplibre";
import type { MapEvent } from "@/data/index";

export interface ClusterPopupData {
  lngLat: [number, number];
  events: MapEvent[];
}

interface ClusterPopupProps {
  data: ClusterPopupData;
  onClose: () => void;
  onSelectEvent: (evt: MapEvent) => void;
}

export function ClusterPopup({ data, onClose, onSelectEvent }: ClusterPopupProps) {
  return (
    <Popup
      longitude={data.lngLat[0]}
      latitude={data.lngLat[1]}
      anchor="bottom"
      offset={16}
      onClose={onClose}
      closeOnClick={false}
      maxWidth="300px"
    >
      <div className="flex flex-col gap-1 pr-3">
        <div className="text-xs font-semibold text-muted-foreground mb-1">
          {data.events.length} events in this area
        </div>
        <div className="flex flex-col gap-0.5 max-h-60 overflow-y-auto -mr-2 pr-2">
          {data.events.map((evt) => (
            <button
              key={evt.id}
              onClick={() => onSelectEvent(evt)}
              className="flex items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-muted/50 transition-colors"
            >
              <span className="text-sm shrink-0">{evt.event_icon}</span>
              <span className="text-xs text-foreground truncate flex-1">{evt.event_label}</span>
              {evt.severity && (
                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-2xs font-semibold leading-none ${
                  evt.severity === "critical" ? "bg-red-600 text-white" :
                  evt.severity === "major" ? "bg-red-500 text-white" :
                  evt.severity === "moderate" ? "bg-amber-500 text-white" :
                  "bg-slate-400 text-white"
                }`}>
                  {evt.severity}
                </span>
              )}
              <span className="shrink-0 text-2xs text-muted-foreground">{evt.date}</span>
            </button>
          ))}
        </div>
      </div>
    </Popup>
  );
}
