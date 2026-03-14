import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { transformRow } from "@/lib/transformEvent";
import { isRelevantEvent } from "@/lib/filterUtils";
import { THEATER_COUNTRIES } from "@/config/map";
import type { EventRow, EnrichedEvent } from "@/types/events";
const PAGE_SIZE = 30;
const POLL_INTERVAL_MS = 15_000;

export interface FeedFilters {
  types?: string[];
  severities?: string[];
  regions?: string[];
  sourceTypes?: string[];
  handles?: string[];
  dateFrom?: string;
  dateTo?: string;
  weaponSystems?: string[];
  query?: string;
}

export interface UseFeedEventsReturn {
  events: EnrichedEvent[];
  loadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
}

export function useFeedEvents(filters: FeedFilters): UseFeedEventsReturn {
  const [events, setEvents] = useState<EnrichedEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cursorRef = useRef<string | null>(null);

  // Serialize filters for dependency tracking
  const filterKey = useMemo(
    () => JSON.stringify(filters),
    [filters],
  );

  const buildParams = useCallback(() => {
    const params: Record<string, unknown> = {
      p_countries: THEATER_COUNTRIES,
      p_limit: PAGE_SIZE,
    };
    if (filters.types?.length) params.p_types = filters.types;
    if (filters.severities?.length) params.p_severities = filters.severities;
    if (filters.regions?.length) params.p_regions = filters.regions;
    if (filters.sourceTypes?.length) params.p_source_types = filters.sourceTypes;
    if (filters.handles?.length) params.p_handles = filters.handles;
    if (filters.dateFrom) params.p_date_from = filters.dateFrom;
    if (filters.dateTo) params.p_date_to = filters.dateTo;
    if (filters.weaponSystems?.length) params.p_weapon_systems = filters.weaponSystems;
    if (filters.query) params.p_query = filters.query;
    return params;
  }, [filters]);

  const fetchPage = useCallback(async (cursor: string | null, isInitial: boolean) => {
    if (!supabase) {
      setError("Supabase not configured");
      setIsLoading(false);
      return;
    }

    if (isInitial) setIsLoading(true);
    else setIsLoadingMore(true);

    try {
      const params = buildParams();
      if (cursor) params.p_cursor = cursor;

      const { data, error: rpcErr } = await supabase.rpc("get_feed_events", params);

      if (rpcErr) throw rpcErr;

      const rows = (data ?? []) as EventRow[];
      const filtered = filters.query ? rows : rows.filter(isRelevantEvent);
      const enriched = filtered.map(transformRow);

      if (isInitial) {
        setEvents(enriched);
      } else {
        setEvents((prev) => [...prev, ...enriched]);
      }

      setHasMore(rows.length === PAGE_SIZE);

      // Update cursor to the last event's message_date for next page
      if (enriched.length > 0) {
        const last = enriched[enriched.length - 1];
        cursorRef.current = last.messageDate;
      }

      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch feed");
    } finally {
      if (isInitial) setIsLoading(false);
      else setIsLoadingMore(false);
    }
  }, [buildParams]);

  // Reset and fetch first page when filters change
  useEffect(() => {
    cursorRef.current = null;
    setHasMore(true);
    fetchPage(null, true);
  }, [filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Merge new events into the feed (prepend new, update existing).
  // Returns prev ref when nothing actually changed to avoid downstream re-renders.
  const mergeEvents = useCallback((enriched: EnrichedEvent[]) => {
    if (enriched.length === 0) return;
    setEvents((prev) => {
      const existing = new Map(prev.map((e) => [e.id, e]));
      const prepend: EnrichedEvent[] = [];
      let anyUpdated = false;
      for (const e of enriched) {
        if (existing.has(e.id)) {
          const old = existing.get(e.id)!;
          if (old.messageDate !== e.messageDate || old.summary !== e.summary) {
            existing.set(e.id, e);
            anyUpdated = true;
          }
        } else {
          prepend.push(e);
        }
      }
      if (prepend.length === 0 && !anyUpdated) return prev;
      const updated = Array.from(existing.values());
      return [...prepend, ...updated];
    });
  }, []);

  // Poll for newest events every 15s
  useEffect(() => {
    if (!supabase) return;

    const poll = async () => {
      try {
        const params = buildParams();
        const { data } = await supabase!.rpc("get_feed_events", params);
        if (!data) return;

        const rows = filters.query ? (data as EventRow[]) : (data as EventRow[]).filter(isRelevantEvent);
        const enriched = rows.map(transformRow);
        mergeEvents(enriched);
      } catch {
        // Silent — next poll will catch up
      }
    };

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [filterKey, mergeEvents, buildParams]);

  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) return;
    fetchPage(cursorRef.current, false);
  }, [hasMore, isLoadingMore, fetchPage]);

  return { events, loadMore, hasMore, isLoading, isLoadingMore, error };
}
