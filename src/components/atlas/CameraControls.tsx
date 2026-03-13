import type { MapRef } from "react-map-gl/maplibre";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ZoomIn, ZoomOut, LocateFixed, Video } from "lucide-react";
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

export function CameraControls({ mapRef, terrainActive: _terrainActive, onResetView, showLabels = false, open, onToggle }: CameraControlsProps) {
  const isMobile = useIsMobile();

  function adjust(bearing?: number, pitch?: number) {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const opts: Record<string, unknown> = { duration: 300 };
    if (bearing !== undefined) opts.bearing = map.getBearing() + bearing;
    if (pitch !== undefined) opts.pitch = Math.min(85, Math.max(0, map.getPitch() + pitch));
    map.easeTo(opts as Parameters<typeof map.easeTo>[0]);
  }

  function zoom(delta: number) {
    const map = mapRef.current?.getMap();
    if (!map) return;
    map.easeTo({ zoom: map.getZoom() + delta, duration: 200 });
  }

  const btnSize = isMobile ? "size-11" : "size-7";

  return (
    <div className="relative flex flex-col items-center gap-1">
      <div className={`absolute bottom-full right-0 mb-1 w-max${open ? "" : " pointer-events-none"}`}>
        <CollapsePanel open={open} direction="up">
          <div className="glass-panel p-1.5 rounded-xl grid grid-cols-3 gap-px place-items-center" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          {/* Row 1: zoom in + up + zoom out */}
          <Btn size={btnSize} onClick={() => zoom(1)} title="Zoom in"><ZoomIn className="size-3.5" /></Btn>
          {!isMobile ? (
            <Btn size={btnSize} onClick={() => adjust(undefined, -10)} title="Tilt up (↑)"><ArrowUp className="size-3.5" /></Btn>
          ) : <span />}
          <Btn size={btnSize} onClick={() => zoom(-1)} title="Zoom out"><ZoomOut className="size-3.5" /></Btn>
          {/* Row 2: left + center + right */}
          {!isMobile ? (
            <Btn size={btnSize} onClick={() => adjust(15)} title="Rotate left (←)"><ArrowLeft className="size-3.5" /></Btn>
          ) : <span />}
          <Btn size={btnSize} onClick={onResetView} title="Home — Beirut"><LocateFixed className="size-3.5" /></Btn>
          {!isMobile ? (
            <Btn size={btnSize} onClick={() => adjust(-15)} title="Rotate right (→)"><ArrowRight className="size-3.5" /></Btn>
          ) : <span />}
          {/* Row 3: down */}
          <span />
          {!isMobile ? (
            <Btn size={btnSize} onClick={() => adjust(undefined, 10)} title="Tilt down (↓)"><ArrowDown className="size-3.5" /></Btn>
          ) : <span />}
          <span />
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

function Btn({ onClick, title, size, children, className = "" }: {
  onClick: () => void;
  title: string;
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
      className={`flex items-center justify-center rounded-lg p-0 ${size} ${className}`}
    >
      {children}
    </Button>
  );
}
