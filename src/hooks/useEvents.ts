import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { transformRow } from "@/lib/transformEvent";
import { getEventTypeMeta } from "@/config/eventTypes";
import { FEED_CONFIG } from "@/config/map";
import type { EventRow, EnrichedEvent, EventTypeMeta } from "@/types/events";

/** Lebanon theater countries — LB, IL, SY, PS */
const THEATER_COUNTRIES = ["LB", "IL", "SY", "PS"];

export interface UseEventsReturn {
  events: EnrichedEvent[];
  eventTypes: EventTypeMeta[];
  totalCount: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  /** Whether auto-scroll loading is still allowed (pages < autoLoadPages) */
  canAutoLoad: boolean;
  loadMore: () => void;
  refresh: () => void;
}

export function useEvents(dateFrom?: string, dateTo?: string): UseEventsReturn {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [allEventTypes, setAllEventTypes] = useState<EventTypeMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const pagesLoadedRef = useRef(0);

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

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      if (!supabase) {
        setError("Supabase not configured");
        setIsLoading(false);
        return;
      }

      const limit = offset === 0 ? FEED_CONFIG.initialPageSize : FEED_CONFIG.pageSize;

      try {
        const params: Record<string, unknown> = {
          p_limit: limit,
          p_offset: offset,
          p_countries: THEATER_COUNTRIES,
        };
        if (dateFrom) params.p_date_from = dateFrom;
        if (dateTo) params.p_date_to = dateTo;

        const [{ data, error: rpcErr }, { data: countData }] = await Promise.all([
          supabase.rpc("get_events_page", params),
          offset === 0
            ? supabase.rpc("get_events_count", {
                p_date_from: dateFrom || null,
                p_date_to: dateTo || null,
                p_countries: THEATER_COUNTRIES,
              })
            : Promise.resolve({ data: null }),
        ]);

        if (rpcErr) throw rpcErr;

        const newRows = (data ?? []) as EventRow[];
        setRows((prev) => (append ? [...prev, ...newRows] : newRows));
        if (countData !== null) setTotalCount(Number(countData));
        offsetRef.current = offset + newRows.length;
        pagesLoadedRef.current += 1;
        setError(null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to fetch events");
      }
    },
    [dateFrom, dateTo],
  );

  // Initial load + reset on filter change
  useEffect(() => {
    setIsLoading(true);
    offsetRef.current = 0;
    pagesLoadedRef.current = 0;
    fetchPage(0, false).finally(() => setIsLoading(false));
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    fetchPage(offsetRef.current, true).finally(() => setIsLoadingMore(false));
  }, [fetchPage, isLoadingMore]);

  const refresh = useCallback(() => {
    setIsLoading(true);
    offsetRef.current = 0;
    pagesLoadedRef.current = 0;
    fetchPage(0, false).finally(() => setIsLoading(false));
  }, [fetchPage]);

  const events = useMemo(() => rows.map(transformRow), [rows]);

  const hasMore = rows.length < totalCount;
  const [canAutoLoad, setCanAutoLoad] = useState(true);

  // Update canAutoLoad whenever pagesLoaded changes (via rows changing)
  useEffect(() => {
    setCanAutoLoad(pagesLoadedRef.current < FEED_CONFIG.autoLoadPages);
  }, [rows]);

  return { events, eventTypes: allEventTypes, totalCount, isLoading, isLoadingMore, error, hasMore, canAutoLoad, loadMore, refresh };
}
