import { supabase } from "./supabase";

function getSessionId(): string {
  let id = sessionStorage.getItem("analytics_session_id");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("analytics_session_id", id);
  }
  return id;
}

export function track(eventName: string, metadata?: Record<string, unknown>) {
  if (!supabase) return;
  supabase
    .from("analytics")
    .insert({ event_name: eventName, metadata: metadata ?? {}, session_id: getSessionId() })
    .then(/* fire-and-forget */);
}
