/** Dedicated threat event types (pipeline may output these directly) */
const THREAT_TYPES = new Set(["evacuation_warning", "israeli_evacuation_order"]);

const THREAT_ATTACKERS = new Set([
  "israel",
  "idf",
  "israeli military",
  "israeli forces",
]);

/** Source channels that always represent Israeli threat alerts */
const THREAT_CHANNELS = new Set([
  "idfspokespersonarabic", // Telegram: IDF Arabic spokesperson
  "avichayadraee",         // X: AvichayAdraee
]);

const EVAC_ORDER_TYPES = new Set(["evacuation_warning", "israeli_evacuation_order", "evacuation"]);

export function isEvacuationOrder(event: { eventType: string; sourceChannel?: string | null }): boolean {
  if (EVAC_ORDER_TYPES.has(event.eventType)) return true;
  // AvichayAdraee posts are evacuation orders
  if (event.sourceChannel && THREAT_CHANNELS.has(event.sourceChannel.toLowerCase().trim())) return true;
  return false;
}

export function isThreatAlert(event: {
  eventType: string;
  attacker?: string | null;
  sourceChannel?: string | null;
}): boolean {
  // Dedicated threat event types
  if (THREAT_TYPES.has(event.eventType)) return true;
  // Known threat source channels (e.g. IDF spokesperson)
  if (event.sourceChannel && THREAT_CHANNELS.has(event.sourceChannel.toLowerCase().trim())) return true;
  // Israeli attacker on any event
  if (event.attacker && THREAT_ATTACKERS.has(event.attacker.toLowerCase().trim())) return true;
  return false;
}
