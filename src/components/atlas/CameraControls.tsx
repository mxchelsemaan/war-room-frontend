import { useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Compass, ZoomIn, ZoomOut, LocateFixed, Video } from "lucide-react";
import { CollapsePanel, FloatingTriggerBtn } from "./FloatingPanel";
import { useIsMobile } from "@/hooks/useIsMobile";

interface CameraControlsProps {
  mapRef: React.RefObject<MapRef | null>;
  terrainActive: boolean;
  onResetView: () => void;
  showLabels?: boolean;
}

export function CameraControls({ mapRef, terrainActive, onResetView, showLabels = false }: CameraControlsProps) {
  const [open, setOpen] = useState(false);
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

  return (
    <div className="flex flex-col items-end gap-1">
      <CollapsePanel open={open}>
        <div className="glass-panel p-1.5 rounded-xl shadow-xl mb-1 flex items-center gap-1">
          {/* Left: zoom + home */}
          <div className="flex flex-col items-center gap-px">
            <Btn onClick={() => zoom(1)} title="Zoom in" label="In" showLabels={showLabels} large={isMobile}><ZoomIn className="size-3.5" /></Btn>
            <Btn onClick={() => zoom(-1)} title="Zoom out" label="Out" showLabels={showLabels} large={isMobile}><ZoomOut className="size-3.5" /></Btn>
            <Btn onClick={onResetView} title="Home — Beirut" label="Center" showLabels={showLabels} large={isMobile} className="text-amber-400 hover:text-amber-300">
              <LocateFixed className="size-3.5" />
            </Btn>
          </div>

          {/* Right: compass rose — desktop only (terrain disabled on mobile) */}
          {!isMobile && (
            <>
              <div className="w-px self-stretch bg-white/10 mx-0.5" />
              <div className="flex flex-col items-center gap-px">
                <Btn onClick={() => adjust(undefined, -10)} title="Tilt up" label="Up" showLabels={showLabels}>
                  <ArrowUp className="size-3.5" />
                </Btn>
                <div className="flex items-center gap-px">
                  <Btn onClick={() => adjust(15)} title="Rotate left" label="L" showLabels={showLabels}><ArrowLeft className="size-3.5" /></Btn>
                  <Btn onClick={resetNorth} title="Reset north" label="N" showLabels={showLabels} className="text-sky-400 hover:text-sky-300">
                    <Compass className="size-3.5" />
                  </Btn>
                  <Btn onClick={() => adjust(-15)} title="Rotate right" label="R" showLabels={showLabels}><ArrowRight className="size-3.5" /></Btn>
                </div>
                <Btn onClick={() => adjust(undefined, 10)} title="Tilt down" label="Down" showLabels={showLabels}>
                  <ArrowDown className="size-3.5" />
                </Btn>
              </div>
            </>
          )}
        </div>
      </CollapsePanel>

      <FloatingTriggerBtn onClick={() => setOpen((v) => !v)} aria-label={open ? "Close camera" : "Camera controls"} showLabels={showLabels}>
        <Video className="size-3.5" />
        Camera
      </FloatingTriggerBtn>

    </div>
  );
}

function Btn({ onClick, title, label, showLabels, large, children, className = "" }: {
  onClick: () => void;
  title: string;
  label?: string;
  showLabels?: boolean;
  large?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const sizeClass = large ? "size-11" : showLabels ? "size-9 pb-0.5" : "size-7";
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`flex flex-col items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors gap-px ${sizeClass} ${className}`}
    >
      {children}
      {showLabels && label && (
        <span className="text-[8px] leading-none font-medium tracking-wide opacity-60">{label}</span>
      )}
    </button>
  );
}
