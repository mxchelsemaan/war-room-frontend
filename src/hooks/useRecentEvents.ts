import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { transformRow } from "@/lib/transformEvent";
import { getEventTypeMeta } from "@/config/eventTypes";
import { isRelevantEvent } from "@/lib/filterUtils";
import { DEFAULT_LOOKBACK_MS, FEED_COUNTRIES } from "@/config/map";
import type { EventRow, EnrichedEvent, EventTypeMeta } from "@/types/events";
const POLL_INTERVAL_MS = 30_000;
const PAGE_SIZE = 500;

export interface UseRecentEventsReturn {
  events: EnrichedEvent[];
  eventTypes: EventTypeMeta[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  fetchDateRange: (from: string, to: string) => Promise<void>;
  fetchDay: (day: string) => Promise<EnrichedEvent[]>;
  refresh: () => void;
}

export function useRecentEvents(): UseRecentEventsReturn {
  const [eventMap, setEventMap] = useState<Map<string, EnrichedEvent>>(new Map());
  const [allEventTypes, setAllEventTypes] = useState<EventTypeMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date-keyed cache so revisiting a day is instant
  const dayCache = useRef<Map<string, EnrichedEvent[]>>(new Map());
  // Track the last enriched_at for incremental polling
  const lastPolledAt = useRef<string | null>(null);

  // Merge rows into the event map, deduplicating by id
  const mergeRows = useCallback((rows: EventRow[]) => {
    const filtered = rows.filter(isRelevantEvent);
    if (filtered.length === 0) return;

    const enriched = filtered.map(transformRow);

    setEventMap((prev) => {
      const next = new Map(prev);
      for (const e of enriched) {
        next.set(e.id, e);
      }
      return next;
    });

    // Update day cache
    for (const e of enriched) {
      const cached = dayCache.current.get(e.date);
      if (cached) {
        // Replace or append
        const idx = cached.findIndex((c) => c.id === e.id);
        if (idx >= 0) cached[idx] = e;
        else cached.push(e);
      }
    }
  }, []);

  // Fetch all distinct event types once on mount
  useEffect(() => {
    if (!supabase) return;
    supabase.rpc("get_event_types", { p_countries: FEED_COUNTRIES }).then(({ data }) => {
      if (data) {
        const types = (data as { event_type: string; count: number }[])
          .map((r) => getEventTypeMeta(r.event_type));
        setAllEventTypes(types);
      }
    });
  }, []);

  // Initial load: recent events (last 7 days)
  const fetchRecent = useCallback(async () => {
    if (!supabase) {
      setError("Supabase not configured");
      setIsLoading(false);
      return;
    }

    try {
      const since = new Date(Date.now() - DEFAULT_LOOKBACK_MS).toISOString();
      const { data, error: rpcErr } = await supabase.rpc("get_recent_events", {
        p_since: since,
        p_countries: FEED_COUNTRIES,
        p_limit: 2000,
      });

      if (rpcErr) throw rpcErr;

      const rows = (data ?? []) as EventRow[];
      if (rows.length > 0) {
        // Track latest enriched_at for incremental polling
        lastPolledAt.current = rows.reduce((max, r) =>
          r.enriched_at > max ? r.enriched_at : max, rows[0].enriched_at);
      } else {
        lastPolledAt.current = new Date().toISOString();
      }

      mergeRows(rows);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch events");
    }
  }, [mergeRows]);

  // Incremental poll: only new events since last poll
  const pollNew = useCallback(async () => {
    if (!supabase || !lastPolledAt.current) return;

    try {
      const { data, error: rpcErr } = await supabase.rpc("get_new_events_since", {
        p_since: lastPolledAt.current,
        p_countries: FEED_COUNTRIES,
      });

      if (rpcErr) throw rpcErr;

      const rows = (data ?? []) as EventRow[];
      if (rows.length > 0) {
        lastPolledAt.current = rows.reduce((max, r) =>
          r.enriched_at > max ? r.enriched_at : max, rows[0].enriched_at);
        mergeRows(rows);
      }
    } catch {
      // Silent poll failure — don't update error state
    }
  }, [mergeRows]);

  // Initial load + polling
  useEffect(() => {
    setIsLoading(true);
    fetchRecent().finally(() => setIsLoading(false));

    const interval = setInterval(pollNew, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchRecent, pollNew]);

  // Fetch a full date range (paginated)
  const fetchDateRange = useCallback(async (from: string, to: string) => {
    if (!supabase) return;

    setIsLoading(true);
    try {
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error: rpcErr } = await supabase.rpc("get_events_for_date_range", {
          p_from: from,
          p_to: to,
          p_countries: FEED_COUNTRIES,
          p_limit: PAGE_SIZE,
          p_offset: offset,
        });

        if (rpcErr) throw rpcErr;

        const rows = (data ?? []) as EventRow[];
        mergeRows(rows);

        hasMore = rows.length === PAGE_SIZE;
        offset += PAGE_SIZE;
      }

      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch date range");
    } finally {
      setIsLoading(false);
    }
  }, [mergeRows]);

  // Fetch a single day (checks cache first)
  const fetchDay = useCallback(async (day: string): Promise<EnrichedEvent[]> => {
    const cached = dayCache.current.get(day);
    if (cached && cached.length > 0) return cached;

    if (!supabase) return [];

    try {
      const { data, error: rpcErr } = await supabase.rpc("get_events_for_date_range", {
        p_from: day,
        p_to: day,
        p_countries: FEED_COUNTRIES,
        p_limit: PAGE_SIZE,
        p_offset: 0,
      });

      if (rpcErr) throw rpcErr;

      const rows = (data ?? []) as EventRow[];
      const filtered = rows.filter(isRelevantEvent);
      const enriched = filtered.map(transformRow);

      // Cache the result
      dayCache.current.set(day, enriched);

      // Merge into global state
      mergeRows(rows);

      return enriched;
    } catch {
      return [];
    }
  }, [mergeRows]);

  const refresh = useCallback(() => {
    setIsLoading(true);
    dayCache.current.clear();
    setEventMap(new Map());
    fetchRecent().finally(() => setIsLoading(false));
  }, [fetchRecent]);

  // Stabilise array ref: only create a new array when event IDs actually change
  const prevEventsRef = useRef<EnrichedEvent[]>([]);
  const events = useMemo(() => {
    const next = Array.from(eventMap.values());
    const prev = prevEventsRef.current;
    if (prev.length === next.length && prev.every((e, i) => e.id === next[i].id)) {
      return prev;
    }
    prevEventsRef.current = next;
    return next;
  }, [eventMap]);
  const totalCount = events.length;

  return {
    events,
    eventTypes: allEventTypes,
    totalCount,
    isLoading,
    error,
    fetchDateRange,
    fetchDay,
    refresh,
  };
}
