/** Dedicated threat event types (pipeline may output these directly) */
const THREAT_TYPES = new Set(["evacuation_warning", "israeli_evacuation_order"]);

/** Cross-cutting: these types + Israeli attacker = threat */
const THREAT_CONTEXT_TYPES = new Set([
  "evacuation",
  "civil_defense_warning",
  "civil_defense_update",
]);

const THREAT_ATTACKERS = new Set([
  "israel",
  "idf",
  "israeli military",
  "israeli forces",
]);

export function isThreatAlert(event: {
  eventType: string;
  attacker?: string | null;
}): boolean {
  if (THREAT_TYPES.has(event.eventType)) return true;
  if (!event.attacker) return false;
  return (
    THREAT_ATTACKERS.has(event.attacker.toLowerCase().trim()) &&
    THREAT_CONTEXT_TYPES.has(event.eventType)
  );
}
