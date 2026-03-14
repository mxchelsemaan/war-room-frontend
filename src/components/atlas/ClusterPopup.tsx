import { useMemo, useState } from "react";
import { Popup } from "react-map-gl/maplibre";
import type { MapEvent } from "@/data/index";
import type { EnrichedEvent } from "@/types/events";
import { buildSourceUrl, SourceIcon } from "@/lib/sourceUrl";

export interface ClusterPopupData {
  lngLat: [number, number];
  events: MapEvent[];
}

interface ClusterPopupProps {
  data: ClusterPopupData;
  enrichedEventsById?: Map<string, EnrichedEvent>;
  onClose: () => void;
  onSelectEvent: (evt: MapEvent) => void;
}

type SortDir = "desc" | "asc";

function sortByDate(events: MapEvent[], dir: SortDir): MapEvent[] {
  const sorted = [...events];
  return dir === "desc"
    ? sorted.sort((a, b) => b.date.localeCompare(a.date))
    : sorted.sort((a, b) => a.date.localeCompare(b.date));
}

export function ClusterPopup({ data, enrichedEventsById, onClose, onSelectEvent }: ClusterPopupProps) {
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const sorted = useMemo(() => sortByDate(data.events, sortDir), [data.events, sortDir]);

  return (
    <Popup
      longitude={data.lngLat[0]}
      latitude={data.lngLat[1]}
      anchor="bottom"
      offset={16}
      onClose={onClose}
      closeOnClick={false}
      maxWidth="380px"
    >
      <div className="flex flex-col gap-1">
        {/* Header + sort controls */}
        <div className="flex items-center justify-between mb-1 pr-5">
          <span className="text-xs font-semibold text-muted-foreground">
            {data.events.length} events at this location
          </span>
          <button
            onClick={() => setSortDir((d) => d === "desc" ? "asc" : "desc")}
            className="rounded px-1.5 py-0.5 text-2xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Date {sortDir === "desc" ? "↓" : "↑"}
          </button>
        </div>

        <div className="flex flex-col max-h-80 overflow-y-auto -mr-2 pr-2">
          {sorted.map((evt, i) => {
            const enriched = enrichedEventsById?.get(evt.id);
            const hasCasualties = enriched && (enriched.casualties.killed != null || enriched.casualties.injured != null || enriched.casualties.displaced != null);
            return (
              <button
                key={evt.id}
                onClick={() => onSelectEvent(evt)}
                className={`flex flex-col gap-1 text-left px-1.5 py-2 hover:bg-muted/50 transition-colors${i < sorted.length - 1 ? " border-b border-border/40" : ""}`}
              >
                {/* Header: icon + label + severity */}
                <div className="flex items-center gap-2">
                  <span className="text-lg shrink-0">{evt.event_icon}</span>
                  <span className="text-xs font-semibold text-foreground flex-1">{evt.event_label}</span>
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
                </div>
                {/* Summary */}
                {(enriched?.summary ?? evt.summary) && (
                  <p className={`text-xs text-muted-foreground leading-relaxed${enriched ? "" : " line-clamp-3"}`}>
                    {enriched?.summary ?? evt.summary}
                  </p>
                )}
                {/* Sources */}
                {(() => {
                  const url = buildSourceUrl(evt.sourceType, evt.sourceChannel, evt.sourceId);
                  return evt.sourceChannel ? (
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      {evt.sourceType && <SourceIcon sourceType={evt.sourceType} className="size-3" />}
                      {url ? (
                        <span
                          onClick={(e) => { e.stopPropagation(); window.open(url, "_blank", "noopener,noreferrer"); }}
                          className="hover:text-foreground transition-colors cursor-pointer"
                        >
                          @{evt.sourceChannel}
                        </span>
                      ) : (
                        <span>@{evt.sourceChannel}</span>
                      )}
                    </div>
                  ) : null;
                })()}
                {/* Casualties */}
                {hasCasualties && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {enriched!.casualties.killed != null && <span className="text-red-400 font-medium">{enriched!.casualties.killed} killed</span>}
                    {enriched!.casualties.injured != null && <span className="text-amber-400 font-medium">{enriched!.casualties.injured} injured</span>}
                    {enriched!.casualties.displaced != null && <span className="text-blue-400 font-medium">{enriched!.casualties.displaced} displaced</span>}
                  </div>
                )}
                {/* Weapon system */}
                {enriched?.weaponSystem && (
                  <div className="text-xs text-muted-foreground">Weapon: <span className="text-foreground/80">{enriched.weaponSystem}</span></div>
                )}
                {/* Attacker → Target */}
                {(enriched?.attacker || enriched?.affectedParty) && (
                  <div className="text-xs text-muted-foreground">
                    {enriched.attacker && <span className="text-foreground/80">{enriched.attacker}</span>}
                    {enriched.attacker && enriched.affectedParty && <span> → </span>}
                    {enriched.affectedParty && <span className="text-foreground/80">{enriched.affectedParty}</span>}
                  </div>
                )}
                {/* Media thumbnail */}
                {enriched?.mediaUrl && enriched.mediaType?.startsWith("image") && (
                  <img src={enriched.mediaUrl} alt="" className="rounded w-full max-h-24 object-cover" loading="lazy" />
                )}
                {/* Date + source */}
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{evt.date}</span>
                  {(() => {
                    const url = buildSourceUrl(evt.sourceType, evt.sourceChannel, evt.sourceId);
                    return url ? (
                      <span
                        onClick={(e) => { e.stopPropagation(); window.open(url, "_blank", "noopener,noreferrer"); }}
                        className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        title={`View on ${evt.sourceType === "telegram" ? "Telegram" : "X"}`}
                      >
                        <SourceIcon sourceType={evt.sourceType!} className="size-3" />
                        {evt.sourceChannel && <span>@{evt.sourceChannel}</span>}
                      </span>
                    ) : evt.sourceChannel ? (
                      <span className="text-muted-foreground/70">· {evt.sourceChannel}</span>
                    ) : null;
                  })()}
                  {evt.verificationStatus && evt.verificationStatus !== "reported" && (
                    <span className="rounded bg-muted px-1 py-0.5 text-2xs">{evt.verificationStatus}</span>
                  )}
                </div>
                {/* Topics */}
                {enriched?.topics && enriched.topics.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {enriched.topics.map((t) => (
                      <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground">{t}</span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </Popup>
  );
}
