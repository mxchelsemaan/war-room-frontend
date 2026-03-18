import { useCallback, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { ChevronDown, Play, Maximize2, LocateFixed, Camera, Flag } from "lucide-react";
import type { EnrichedEvent } from "@/types/events";
import { getEventTypeMeta } from "@/config/eventTypes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { buildSourceUrl } from "@/lib/sourceUrl";
import { ChannelAvatar } from "@/components/ui/ChannelAvatar";
import { isThreatAlert, isEvacuationOrder } from "@/lib/threatUtils";
import { ReportModal } from "./ReportModal";

/** Detect media type from URL path extension */
function getMediaType(url: string): "video" | "image" {
  const path = url.split("?")[0];
  if (path.endsWith(".video") || path.endsWith(".mp4") || path.endsWith(".mov") || path.endsWith(".webm")) return "video";
  return "image";
}

const TITLE_CASE_MINOR = new Set(["a","an","the","and","but","or","nor","for","yet","so","in","on","at","to","by","of","up","as","is"]);
function toTitleCase(str: string): string {
  return str.replace(/\S+/g, (word, i) => {
    if (i > 0 && TITLE_CASE_MINOR.has(word.toLowerCase())) return word.toLowerCase();
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
}

function shortTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs < 24) return remMins > 0 ? `${hrs}h${remMins}m ago` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-600",
  major:    "bg-red-500",
  moderate: "bg-amber-500",
  minor:    "bg-slate-400",
};

export function EventRow({
  event,
  isHighlighted,
  isSelected,
  onFlyTo,
  onEventSelect,
}: {
  event: EnrichedEvent;
  isHighlighted: boolean;
  isSelected?: boolean;
  onFlyTo?: (lat: number, lng: number, eventId?: string) => void;
  onEventSelect?: (id: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const detailsRef = useRef<HTMLDivElement>(null);
  const meta = getEventTypeMeta(event.eventType);
  const severityDot = SEVERITY_COLORS[event.severity] ?? "bg-slate-500";
  const isThreat = isThreatAlert(event);
  const isEvac = isEvacuationOrder(event);
  // Red glow expires 2 hours after the event date
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
  const [now] = useState(() => Date.now());
  const threatGlow = isThreat && event.dateTime
    ? (now - new Date(event.dateTime).getTime()) < TWO_HOURS_MS
    : isThreat;

  const hasMedia = !!event.mediaUrl;
  const hasPendingMedia = !event.mediaUrl && !!event.mediaType && event.mediaType !== "sticker";
  const hasCasualties = (event.casualties.killed ?? 0) > 0 || (event.casualties.injured ?? 0) > 0;
  const sourceUrl = buildSourceUrl(event.sourceType, event.sourceChannel, event.sourceId);

  const toggle = useCallback(() => {
    const el = detailsRef.current;
    if (!el) { setExpanded(v => !v); return; }

    if (expanded) {
      // Collapse: animate from current height to 0
      el.style.height = `${el.scrollHeight}px`;
      requestAnimationFrame(() => {
        el.style.height = "0px";
        el.style.opacity = "0";
      });
    } else {
      // Expand: set to 0, then animate to scrollHeight
      el.style.height = "0px";
      el.style.opacity = "0";
      setExpanded(true);
      requestAnimationFrame(() => {
        el.style.height = `${el.scrollHeight}px`;
        el.style.opacity = "1";
      });
    }
  }, [expanded]);

  const handleTransitionEnd = useCallback(() => {
    const el = detailsRef.current;
    if (!el) return;
    if (expanded && el.style.height !== "0px") {
      el.style.height = "auto"; // allow content reflow after expand
    } else if (el.style.height === "0px") {
      setExpanded(false);
    }
  }, [expanded]);

  return (
    <div
      data-event-id={event.id}
      className={`relative border-b border-border/50 hover:bg-muted/30 transition-all cursor-pointer ${
        isHighlighted ? "bg-primary/5" : ""
      } ${expanded ? "bg-muted/20" : ""} ${isSelected ? "ring-1 ring-inset ring-primary bg-primary/10" : ""}`}
      onClick={toggle}
    >
      {/* Threat glow overlay — animate-pulse with random phase offset, expires 2h after event */}
      {threatGlow && (
        <div
          className={`absolute inset-0 pointer-events-none animate-pulse ${
            isEvac ? "bg-red-500/40" : "bg-red-500/25"
          }`}
          style={{ animationDelay: `${-((event.id.charCodeAt(0) ?? 0) % 20) * 0.1}s` }}
        />
      )}
      {/* Collapsed row */}
      <div className="flex gap-2.5 px-3 py-2.5 relative z-[1]">
        {/* Left: avatar + event icon + severity */}
        <div className="flex flex-col items-center gap-1.5 mt-0.5 shrink-0">
          <ChannelAvatar sourceType={event.sourceType} sourceChannel={event.sourceChannel} className="size-6 shrink-0" />
          <span className="text-base leading-none">{meta.icon}</span>
          <span className={`h-1.5 w-1.5 rounded-full ${severityDot}`} />
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col gap-0.5 min-w-0">
          {/* Line 1: source handle + link (left) + time ago (right) + chevron */}
          <div className="flex items-center justify-between gap-1">
            {(() => {
              const handle = event.sourceChannel ? `@${event.sourceChannel}` : null;
              const inner = (
                <span className="inline-flex items-center gap-1 text-xs truncate min-w-0">
                  {handle && <span className="font-medium truncate">{handle}</span>}
                  {sourceUrl && <span className="text-muted-foreground/60 text-2xs">(link)</span>}
                </span>
              );
              return sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-foreground transition-colors truncate min-w-0"
                >
                  {inner}
                </a>
              ) : inner;
            })()}
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs text-muted-foreground">
                {event.dateTime ? shortTimeAgo(event.dateTime) : event.date}
              </span>
              <ChevronDown className={`size-3 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
            </div>
          </div>

          {/* Line 2: summary + media thumbnail hint */}
          <div className={`flex gap-2 ${expanded ? "" : ""}`}>
            <p className={`text-xs text-muted-foreground leading-relaxed flex-1 min-w-0 ${expanded ? "" : "line-clamp-2"}`}>
              {event.summary}
            </p>
            {!expanded && hasMedia && (
              <div className="shrink-0 w-10 h-10 rounded overflow-hidden border border-border/50 bg-muted relative">
                {getMediaType(event.mediaUrl!) === "video" ? (
                  <div className="w-full h-full flex items-center justify-center bg-black/60">
                    <Play className="size-4 text-white fill-white" />
                  </div>
                ) : (
                  <img
                    src={event.mediaUrl!}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
                  />
                )}
              </div>
            )}
            {!expanded && hasPendingMedia && (
              <div className="shrink-0 w-10 h-10 rounded overflow-hidden border border-border/50 bg-muted/50 flex items-center justify-center">
                <Camera className="size-3.5 text-muted-foreground/40" />
              </div>
            )}
          </div>

          {/* Chips — always visible */}
          <div className="flex flex-wrap items-center gap-1 mt-0.5">
            <Badge
              variant="ghost"
              className="px-1.5 py-0.5 text-2xs leading-none"
              style={{ background: meta.color + "22", color: meta.color }}
            >
              {meta.label}
            </Badge>
            {isThreat && (
              <Badge variant="destructive" className="px-1.5 py-0.5 text-2xs font-bold leading-none">
                ALERT
              </Badge>
            )}
            {hasCasualties && (
              <Badge variant="ghost" className="bg-red-500/15 text-red-400 px-1.5 py-0.5 text-2xs leading-none">
                {event.casualties.killed != null && event.casualties.killed > 0 && `${event.casualties.killed} killed`}
                {event.casualties.killed != null && event.casualties.killed > 0 && event.casualties.injured != null && event.casualties.injured > 0 && " · "}
                {event.casualties.injured != null && event.casualties.injured > 0 && `${event.casualties.injured} injured`}
              </Badge>
            )}
            {event.verificationStatus !== "reported" && event.verificationStatus !== "confirmed" && (
              <Badge variant="secondary" className="px-1.5 py-0.5 text-2xs leading-none">
                {toTitleCase(event.verificationStatus)}
              </Badge>
            )}
          </div>

        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          ref={detailsRef}
          onTransitionEnd={handleTransitionEnd}
          className="overflow-hidden transition-[height,opacity] duration-200 ease-out"
        >
        <div className="px-3 pb-3 flex flex-col gap-2 ml-[30px]">
          {/* Media — image or video */}
          {hasMedia && (() => {
            const isVideo = getMediaType(event.mediaUrl!);
            return isVideo === "video" ? (
              <div className="w-full overflow-hidden rounded-md border border-border/50 bg-black">
                <video
                  src={event.mediaUrl!}
                  controls
                  preload="metadata"
                  playsInline
                  className="w-full max-h-56 object-contain"
                  onError={(e) => { (e.target as HTMLVideoElement).style.display = "none"; }}
                />
              </div>
            ) : (
              <>
                <div
                  className="group relative w-full overflow-hidden rounded-md border border-border/50 cursor-zoom-in"
                  onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
                >
                  <img
                    src={event.mediaUrl!}
                    alt=""
                    loading="lazy"
                    className="w-full max-h-56 object-cover bg-muted"
                    onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
                    <Maximize2 className="size-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
                  <DialogContent
                    className="max-w-[90vw] max-h-[90vh] p-0 border-none bg-transparent shadow-none [&>button]:text-white [&>button]:bg-black/50 [&>button]:rounded-full [&>button]:size-8 [&>button]:top-2 [&>button]:right-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <img
                      src={event.mediaUrl!}
                      alt=""
                      className="w-full h-full max-h-[85vh] object-contain rounded-lg"
                    />
                  </DialogContent>
                </Dialog>
              </>
            );
          })()}

          {/* Pending media placeholder */}
          {!hasMedia && hasPendingMedia && (
            <div className="w-full h-24 rounded-md border border-dashed border-border/50 bg-muted/30 flex items-center justify-center gap-2">
              <Camera className="size-4 text-muted-foreground/50" />
              <span className="text-xs text-muted-foreground/50">Media loading…</span>
            </div>
          )}

          {/* Detail grid */}
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            {event.attacker && (
              <>
                <span className="text-muted-foreground">Attacker</span>
                <span className="text-foreground">{toTitleCase(event.attacker)}</span>
              </>
            )}
            {event.target && (
              <>
                <span className="text-muted-foreground">Target</span>
                <span className="text-foreground">{toTitleCase(event.target)}</span>
              </>
            )}
            {event.affectedParty && (
              <>
                <span className="text-muted-foreground">Affected</span>
                <span className="text-foreground">{toTitleCase(event.affectedParty)}</span>
              </>
            )}
            {event.weaponSystem && (
              <>
                <span className="text-muted-foreground">Weapon</span>
                <span className="text-foreground">{toTitleCase(event.weaponSystem)}</span>
              </>
            )}
            {event.location.region && (
              <>
                <span className="text-muted-foreground">Region</span>
                <span className="text-foreground">{toTitleCase(event.location.region)}</span>
              </>
            )}
            {event.casualties.displaced != null && event.casualties.displaced > 0 && (
              <>
                <span className="text-muted-foreground">Displaced</span>
                <span className="text-foreground">{event.casualties.displaced.toLocaleString()}</span>
              </>
            )}
            <span className="text-muted-foreground">Date</span>
            <span className="text-foreground">
              {event.dateTime
                ? format(parseISO(event.dateTime), "EEE d MMM yyyy, h:mm a")
                : event.date}
            </span>
          </div>

          {/* Topics */}
          {event.topics.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {event.topics.map((t) => (
                <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-2xs text-muted-foreground">
                  {toTitleCase(t)}
                </span>
              ))}
            </div>
          )}

          {/* Source claim */}
          {event.sourceClaim && (
            <p className="text-2xs text-muted-foreground/70 italic">
              According to: {event.sourceClaim}
            </p>
          )}

          {/* Go to event + Report */}
          <div className="flex gap-2">
            {onFlyTo && event.location.lat != null && event.location.lng != null && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-7 text-2xs gap-1.5"
                onClick={(e) => { e.stopPropagation(); onFlyTo(event.location.lat!, event.location.lng!, event.id); onEventSelect?.(event.id); }}
              >
                <LocateFixed className="size-3" />
                Go to event
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-2xs gap-1.5 text-muted-foreground"
              disabled={reported}
              onClick={(e) => { e.stopPropagation(); setReportOpen(true); }}
            >
              <Flag className="size-3" />
              {reported ? "Reported" : "Report"}
            </Button>
          </div>
          <ReportModal
            open={reportOpen}
            onOpenChange={setReportOpen}
            eventId={event.id}
            onSuccess={() => setReported(true)}
          />
        </div>
        </div>
      )}
    </div>
  );
}
