import type { EventTypeMeta } from "@/types/events";

/** Known event types from the enrichment pipeline */
const KNOWN_TYPES: Record<string, { label: string; icon: string; color: string }> = {
  airstrike:              { label: "Airstrike",              icon: "💥", color: "#ef4444" },
  missile_attack:         { label: "Missile attack",         icon: "🚀", color: "#dc2626" },
  drone_strike:           { label: "Drone strike",           icon: "🛩️", color: "#f97316" },
  shelling:               { label: "Shelling",               icon: "💣", color: "#ea580c" },
  rocket_attack:          { label: "Rocket attack",          icon: "🎯", color: "#c2410c" },
  armed_clash:            { label: "Armed clash",            icon: "⚔️", color: "#b91c1c" },
  ground_operation:       { label: "Ground operation",       icon: "🪖", color: "#991b1b" },
  border_incident:        { label: "Border incident",        icon: "🚧", color: "#e11d48" },
  assassination:          { label: "Assassination",          icon: "🎯", color: "#9f1239" },
  raid:                   { label: "Raid",                   icon: "🔫", color: "#be123c" },
  explosion:              { label: "Explosion",              icon: "💥", color: "#f43f5e" },
  naval_operation:        { label: "Naval operation",        icon: "🚢", color: "#0ea5e9" },
  military_deployment:    { label: "Military deployment",    icon: "🎖️", color: "#7c3aed" },
  military_movement:      { label: "Military movement",      icon: "🚛", color: "#8b5cf6" },
  military_statement:     { label: "Military statement",     icon: "📋", color: "#6d28d9" },
  political_statement:    { label: "Political statement",    icon: "🏛️", color: "#a855f7" },
  diplomatic_meeting:     { label: "Diplomatic meeting",     icon: "🤝", color: "#7c3aed" },
  government_formation:   { label: "Government formation",   icon: "🏛️", color: "#6366f1" },
  legislation:            { label: "Legislation",            icon: "📜", color: "#818cf8" },
  judicial_proceedings:   { label: "Judicial proceedings",   icon: "⚖️", color: "#4f46e5" },
  displacement:           { label: "Displacement",           icon: "🏚️", color: "#d97706" },
  evacuation:             { label: "Evacuation",             icon: "🚨", color: "#f59e0b" },
  infrastructure_damage:  { label: "Infrastructure damage",  icon: "🏗️", color: "#3b82f6" },
  trade_disruption:       { label: "Trade disruption",       icon: "📦", color: "#2563eb" },
  economic_crisis:        { label: "Economic crisis",        icon: "📉", color: "#1d4ed8" },
  civil_defense_update:   { label: "Civil defense update",   icon: "🔔", color: "#eab308" },
  civil_defense_warning:  { label: "Civil defense warning",  icon: "⚠️", color: "#ca8a04" },
  all_clear:              { label: "All clear",              icon: "✅", color: "#22c55e" },
  detention:              { label: "Detention",              icon: "🔒", color: "#64748b" },
  arms_transfer:          { label: "Arms transfer",          icon: "📦", color: "#475569" },
  protest:                { label: "Protest",                icon: "✊", color: "#eab308" },
  humanitarian:           { label: "Humanitarian",           icon: "🤝", color: "#22c55e" },
  evacuation_warning:     { label: "Evacuation Warning",     icon: "🚨", color: "#dc2626" },
  israeli_evacuation_order: { label: "Evacuation Order",     icon: "🚨", color: "#dc2626" },
  casualty_report:        { label: "Casualty report",        icon: "🩸", color: "#b91c1c" },
  civil_defense_alert:    { label: "Civil defense alert",    icon: "🚨", color: "#d97706" },
  strike_warning:         { label: "Strike warning",         icon: "⚠️", color: "#f59e0b" },
  target_declaration:     { label: "Target declaration",     icon: "🎯", color: "#dc2626" },
  civilian_warning:       { label: "Civilian warning",       icon: "📢", color: "#eab308" },
  ceasefire_violation:    { label: "Ceasefire violation",    icon: "🚫", color: "#ef4444" },
  ceasefire_agreement:    { label: "Ceasefire agreement",    icon: "🕊️", color: "#22c55e" },
  hostage_situation:      { label: "Hostage situation",      icon: "🔐", color: "#9f1239" },
  cyber_attack:           { label: "Cyber attack",           icon: "💻", color: "#6366f1" },
  espionage:              { label: "Espionage",              icon: "🕵️", color: "#4f46e5" },
};

/** Deterministic color from a string hash */
function hashColor(str: string): string {
  const palette = [
    "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
    "#3b82f6", "#6366f1", "#a855f7", "#ec4899", "#f43f5e",
    "#0ea5e9", "#84cc16", "#d946ef", "#f59e0b", "#64748b",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return palette[Math.abs(hash) % palette.length];
}

/** Convert snake_case to Sentence case */
function snakeToTitle(s: string): string {
  const words = s.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Get display metadata for any event type (known or unknown) */
export function getEventTypeMeta(type: string): EventTypeMeta {
  const known = KNOWN_TYPES[type];
  if (known) return { key: type, ...known };
  return {
    key: type,
    label: snakeToTitle(type),
    icon: "📌",
    color: hashColor(type),
  };
}

/** Shorthand for map layer usage */
export function getEventTypeColor(type: string): string {
  return getEventTypeMeta(type).color;
}
