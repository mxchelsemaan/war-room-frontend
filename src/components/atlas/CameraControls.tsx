import type { MapRef } from "react-map-gl/maplibre";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Compass, ZoomIn, ZoomOut, LocateFixed, Video } from "lucide-react";
import { CollapsePanel, FloatingTriggerBtn } from "./FloatingPanel";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/useIsMobile";

interface CameraControlsProps {
  mapRef: React.RefObject<MapRef | null>;
  terrainActive: boolean;
  onResetView: () => void;
  showLabels?: boolean;
  open: boolean;
  onToggle: () => void;
}

export function CameraControls({ mapRef, terrainActive, onResetView, showLabels = false, open, onToggle }: CameraControlsProps) {
  const isMobile = useIsMobile();

  function adjust(bearing?: number, pitch?: number) {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const opts: Record<string, unknown> = { duration: 300 };
    if (bearing !== undefined) opts.bearing = map.getBearing() + bearing;
    if (pitch !== undefined) opts.pitch = Math.min(85, Math.max(0, map.getPitch() + pitch));
    map.easeTo(opts as Parameters<typeof map.easeTo>[0]);
  }

  function resetNorth() {
    mapRef.current?.getMap().easeTo({ bearing: 0, pitch: terrainActive ? 65 : 0, duration: 500 });
  }

  function zoom(delta: number) {
    const map = mapRef.current?.getMap();
    if (!map) return;
    map.easeTo({ zoom: map.getZoom() + delta, duration: 200 });
  }

  const btnSize = isMobile ? "size-11" : showLabels ? "size-9 pb-0.5" : "size-7";

  return (
    <div className="relative flex flex-col items-center gap-1">
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max">
        <CollapsePanel open={open} direction="up">
          <div className="glass-panel p-1.5 rounded-xl flex flex-col items-center gap-1">
          {/* Top: compass rose — desktop only (terrain disabled on mobile) */}
          {!isMobile && (
            <>
              <div className="flex flex-col items-center gap-px">
                <Btn size={btnSize} onClick={() => adjust(undefined, -10)} title="Tilt up" label="Up" showLabels={showLabels}>
                  <ArrowUp className="size-3.5" />
                </Btn>
                <div className="flex items-center gap-px">
                  <Btn size={btnSize} onClick={() => adjust(15)} title="Rotate left" label="L" showLabels={showLabels}><ArrowLeft className="size-3.5" /></Btn>
                  <Btn size={btnSize} onClick={resetNorth} title="Reset north" label="N" showLabels={showLabels} className="text-sky-400 hover:text-sky-300">
                    <Compass className="size-3.5" />
                  </Btn>
                  <Btn size={btnSize} onClick={() => adjust(-15)} title="Rotate right" label="R" showLabels={showLabels}><ArrowRight className="size-3.5" /></Btn>
                </div>
                <Btn size={btnSize} onClick={() => adjust(undefined, 10)} title="Tilt down" label="Down" showLabels={showLabels}>
                  <ArrowDown className="size-3.5" />
                </Btn>
              </div>
              <div className="h-px self-stretch bg-white/10 my-0.5" />
            </>
          )}

          {/* Bottom: zoom in / out / center */}
          <div className="flex items-center gap-px">
            <Btn size={btnSize} onClick={() => zoom(1)} title="Zoom in" label="In" showLabels={showLabels}><ZoomIn className="size-3.5" /></Btn>
            <Btn size={btnSize} onClick={() => zoom(-1)} title="Zoom out" label="Out" showLabels={showLabels}><ZoomOut className="size-3.5" /></Btn>
            <Btn size={btnSize} onClick={onResetView} title="Home — Beirut" label="Center" showLabels={showLabels} className="text-amber-400 hover:text-amber-300">
              <LocateFixed className="size-3.5" />
            </Btn>
          </div>
          </div>
        </CollapsePanel>
      </div>

      <FloatingTriggerBtn onClick={onToggle} aria-label={open ? "Close camera" : "Camera controls"} showLabels={showLabels} open={open}>
        <Video className="size-3.5" />
        Camera
      </FloatingTriggerBtn>

    </div>
  );
}

function Btn({ onClick, title, label, showLabels, size, children, className = "" }: {
  onClick: () => void;
  title: string;
  label?: string;
  showLabels?: boolean;
  size: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`flex flex-col items-center justify-center rounded-lg gap-px p-0 ${size} ${className}`}
    >
      {children}
      {showLabels && label && (
        <span className="text-[10px] leading-none font-medium tracking-wide opacity-60">{label}</span>
      )}
    </Button>
  );
}
