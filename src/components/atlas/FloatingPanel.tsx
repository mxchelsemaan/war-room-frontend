/**
 * Shared primitives for floating map control panels.
 *
 * CollapsePanel   — CSS grid-rows slide animation, used by all floating panels.
 * FloatingTriggerBtn — canonical trigger button (Layers / Legend / Shifra Brief).
 */

import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronUp } from "lucide-react";

interface CollapsePanelProps {
  open: boolean;
  /** "down" (default) expands toward bottom. "up" flips via scaleY. "left"/"right" slides horizontally. */
  direction?: "down" | "up" | "left" | "right";
  className?: string;
  children: React.ReactNode;
}

export function CollapsePanel({ open, direction = "down", className, children }: CollapsePanelProps) {
  const originMap = { down: "top", up: "bottom", left: "right", right: "left" } as const;

  return (
    <div
      className={cn(
        "transition-[transform,opacity] duration-200 ease-out",
        open
          ? "scale-100 opacity-100"
          : "scale-95 opacity-0 pointer-events-none",
        className,
      )}
      style={{ transformOrigin: originMap[direction] }}
    >
      {children}
    </div>
  );
}

interface FloatingTriggerBtnProps {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  showLabels?: boolean;
  /** When true, forces label visible and shows a chevron indicator */
  open?: boolean;
  "aria-label"?: string;
}

export function FloatingTriggerBtn({ onClick, children, className, showLabels = true, open, "aria-label": ariaLabel }: FloatingTriggerBtnProps) {
  const labelVisible = showLabels;
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      onMouseDown={(e) => e.stopPropagation()}
      aria-label={ariaLabel}
      className={cn(
        "glass-panel flex items-center px-3 py-3 md:px-2.5 md:py-2.5 min-h-[44px] md:min-h-0 text-xs font-semibold hover:bg-muted h-auto rounded-md",
        className
      )}
      style={{
        gap: "0.375rem",
        transition: "background-color 150ms",
      }}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) return <span className="shrink-0">{child}</span>;
        return (
          <span
            className="overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ease-out"
            style={{ maxWidth: labelVisible ? "8rem" : "0", opacity: labelVisible ? 1 : 0 }}
          >
            {child}
          </span>
        );
      })}
      {open !== undefined && (
        <ChevronUp
          className={cn(
            "size-3 shrink-0 transition-transform duration-200 text-muted-foreground",
            !open && "rotate-180"
          )}
        />
      )}
    </Button>
  );
}
