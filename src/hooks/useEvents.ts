import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { transformRow } from "@/lib/transformEvent";
import { getEventTypeMeta } from "@/config/eventTypes";
import { isLebanonRelated } from "@/lib/filterUtils";
import { THEATER_COUNTRIES } from "@/config/map";
import type { EventRow, EnrichedEvent, EventTypeMeta } from "@/types/events";

export interface UseEventsReturn {
  events: EnrichedEvent[];
  eventTypes: EventTypeMeta[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useEvents(dateFrom?: string, dateTo?: string): UseEventsReturn {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [allEventTypes, setAllEventTypes] = useState<EventTypeMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all distinct event types once on mount (filtered to theater)
  useEffect(() => {
    if (!supabase) return;
    supabase.rpc("get_event_types", { p_countries: THEATER_COUNTRIES }).then(({ data }) => {
      if (data) {
        const types = (data as { event_type: string; count: number }[])
          .map((r) => getEventTypeMeta(r.event_type));
        setAllEventTypes(types);
      }
    });
  }, []);

  const fetchAll = useCallback(
    async () => {
      if (!supabase) {
        setError("Supabase not configured");
        setIsLoading(false);
        return;
      }

      try {
        const params: Record<string, unknown> = {
          p_limit: 100000,
          p_offset: 0,
          p_countries: THEATER_COUNTRIES,
        };
        if (dateFrom) params.p_date_from = dateFrom;
        if (dateTo) params.p_date_to = dateTo;

        const [{ data, error: rpcErr }, { data: countData }] = await Promise.all([
          supabase.rpc("get_events_page", params),
          supabase.rpc("get_events_count", {
            p_date_from: dateFrom || null,
            p_date_to: dateTo || null,
            p_countries: THEATER_COUNTRIES,
          }),
        ]);

        if (rpcErr) throw rpcErr;

        const filtered = ((data ?? []) as EventRow[]).filter(isLebanonRelated);
        setRows(filtered);
        setTotalCount(filtered.length);
        setError(null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to fetch events");
      }
    },
    [dateFrom, dateTo],
  );

  // Initial load + reset on filter change + silent background polling every 60s
  useEffect(() => {
    setIsLoading(true);
    fetchAll().finally(() => setIsLoading(false));

    const interval = setInterval(() => { fetchAll(); }, 60_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const refresh = useCallback(() => {
    setIsLoading(true);
    fetchAll().finally(() => setIsLoading(false));
  }, [fetchAll]);

  const events = useMemo(() => rows.map(transformRow), [rows]);

  return { events, eventTypes: allEventTypes, totalCount, isLoading, error, refresh };
}
