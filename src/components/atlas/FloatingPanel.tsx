/**
 * Shared primitives for floating map control panels.
 *
 * CollapsePanel   — CSS grid-rows slide animation, used by all floating panels.
 * FloatingTriggerBtn — canonical trigger button (Layers / Legend / Shifra Brief).
 */

import React from "react";
import { cn } from "@/lib/utils";

interface CollapsePanelProps {
  open: boolean;
  /** "down" (default) expands toward bottom. "up" flips via scaleY trick. */
  direction?: "down" | "up";
  className?: string;
  children: React.ReactNode;
}

export function CollapsePanel({ open, direction = "down", className, children }: CollapsePanelProps) {
  const isUp = direction === "up";
  return (
    <div
      className={cn("grid transition-[grid-template-rows] duration-200 ease-out", className)}
      style={{
        gridTemplateRows: open ? "1fr" : "0fr",
        ...(isUp ? { transform: "scaleY(-1)" } : {}),
      }}
    >
      <div
        className="overflow-hidden"
        style={isUp ? { transform: "scaleY(-1)" } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

interface FloatingTriggerBtnProps {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  showLabels?: boolean;
  "aria-label"?: string;
}

export function FloatingTriggerBtn({ onClick, children, className, showLabels = true, "aria-label": ariaLabel }: FloatingTriggerBtnProps) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "glass-panel flex items-center px-3 py-3 md:px-2.5 md:py-2.5 min-h-[44px] md:min-h-0 text-xs font-semibold transition-colors hover:bg-muted",
        showLabels ? "gap-1.5" : "gap-0",
        className
      )}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) return child;
        if (!showLabels) return null;
        return <span className="whitespace-nowrap">{child}</span>;
      })}
    </button>
  );
}
