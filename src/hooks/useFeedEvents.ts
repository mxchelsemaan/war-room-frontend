import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { transformRow } from "@/lib/transformEvent";
import { isLebanonRelated } from "@/lib/filterUtils";
import { THEATER_COUNTRIES } from "@/config/map";
import type { EventRow, EnrichedEvent } from "@/types/events";
import type { RealtimeChannel } from "@supabase/supabase-js";
const PAGE_SIZE = 30;

export interface FeedFilters {
  types?: string[];
  severities?: string[];
  regions?: string[];
  sourceTypes?: string[];
  handles?: string[];
  dateFrom?: string;
  dateTo?: string;
  weaponSystems?: string[];
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
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Serialize filters for dependency tracking
  const filterKey = useMemo(
    () => JSON.stringify(filters),
    [filters],
  );

  const fetchPage = useCallback(async (cursor: string | null, isInitial: boolean) => {
    if (!supabase) {
      setError("Supabase not configured");
      setIsLoading(false);
      return;
    }

    if (isInitial) setIsLoading(true);
    else setIsLoadingMore(true);

    try {
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
      if (cursor) params.p_cursor = cursor;

      const { data, error: rpcErr } = await supabase.rpc("get_feed_events", params);

      if (rpcErr) throw rpcErr;

      const rows = (data ?? []) as EventRow[];
      const filtered = rows.filter(isLebanonRelated);
      const enriched = filtered.map(transformRow);

      if (isInitial) {
        setEvents(enriched);
      } else {
        setEvents((prev) => [...prev, ...enriched]);
      }

      setHasMore(rows.length === PAGE_SIZE);

      // Update cursor to the last event's enrichedAt for next page
      if (enriched.length > 0) {
        const last = enriched[enriched.length - 1];
        cursorRef.current = last.enrichedAt;
      }

      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch feed");
    } finally {
      if (isInitial) setIsLoading(false);
      else setIsLoadingMore(false);
    }
  }, [filters]);

  // Reset and fetch first page when filters change
  useEffect(() => {
    cursorRef.current = null;
    setHasMore(true);
    fetchPage(null, true);
  }, [filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: prepend new events to feed
  useEffect(() => {
    if (!supabase) return;

    const handlePayload = (payload: { new: unknown; eventType: string }) => {
      const row = payload.new as EventRow;
      if (row.latitude == null || row.longitude == null) return;
      if (!isLebanonRelated(row)) return;

      const enriched = transformRow(row);

      // Check if it matches current filters
      if (filters.types?.length && !filters.types.includes(enriched.eventType)) return;
      if (filters.severities?.length && !filters.severities.includes(enriched.severity)) return;
      if (filters.regions?.length && !filters.regions.includes(enriched.location.region ?? "")) return;
      if (filters.sourceTypes?.length && !filters.sourceTypes.includes(enriched.sourceType)) return;
      if (filters.handles?.length && !filters.handles.includes(enriched.sourceChannel ?? "")) return;
      if (filters.dateFrom && enriched.date < filters.dateFrom) return;
      if (filters.dateTo && enriched.date > filters.dateTo) return;
      if (filters.weaponSystems?.length && !filters.weaponSystems.includes(enriched.weaponSystem ?? "")) return;

      setEvents((prev) => {
        const idx = prev.findIndex((e) => e.id === enriched.id);
        if (idx >= 0) {
          // UPDATE: replace existing event in-place
          const next = [...prev];
          next[idx] = enriched;
          return next;
        }
        // INSERT: prepend
        return [enriched, ...prev];
      });
    };

    const channel = supabase
      .channel("feed-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "events" },
        handlePayload,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "events" },
        handlePayload,
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase!.removeChannel(channel);
      channelRef.current = null;
    };
  }, [filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) return;
    fetchPage(cursorRef.current, false);
  }, [hasMore, isLoadingMore, fetchPage]);

  return { events, loadMore, hasMore, isLoading, isLoadingMore, error };
}
