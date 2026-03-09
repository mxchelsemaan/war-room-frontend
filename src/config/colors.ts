/** Color presets used by annotation drawing and unit placement */
export const DRAW_COLOR_PRESETS = [
  "#e2e8f0", "#000000", "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#3b82f6", "#a855f7", "#ec4899",
] as const;

import { getEventTypeColor } from "@/config/eventTypes";

/** Per-event-type accent colors — delegates to the event type registry */
export const EVENT_TYPE_COLORS = new Proxy<Record<string, string>>({}, {
  get(_target, prop: string) {
    return getEventTypeColor(prop);
  },
});
export const EVENT_COLOR_DEFAULT = "#64748b";
