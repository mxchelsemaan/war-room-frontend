import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { transformMarkerRow } from "@/lib/transformEvent";
import { DEFAULT_LOOKBACK_MS, MAP_COUNTRIES } from "@/config/map";
import type { MapMarkerRow, MapMarkerEvent } from "@/types/events";
/** Poll interval for incremental marker updates */
const POLL_MS = 30_000;
/** Max days to retain in dayCache before LRU eviction */
const MAX_CACHED_DAYS = 14;

export interface UseMapMarkersReturn {
  markers: MapMarkerEvent[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useMapMarkers(): UseMapMarkersReturn {
  const [markerMap, setMarkerMap] = useState<Map<string, MapMarkerEvent>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const lastEnrichedAt = useRef<string | null>(null);
  const dayCache = useRef<Map<string, Set<string>>>(new Map());

  // ── LRU day eviction ────────────────────────────────────────────────
  const evictStaleDays = useCallback(() => {
    const cache = dayCache.current;
    if (cache.size <= MAX_CACHED_DAYS) return;

    const today = new Date().toISOString().slice(0, 10);
    const days = Array.from(cache.keys())
      .filter((d) => d !== today)
      .sort(); // oldest first

    const toEvict = days.slice(0, cache.size - MAX_CACHED_DAYS);
    if (toEvict.length === 0) return;

    setMarkerMap((prev) => {
      const next = new Map(prev);
      for (const day of toEvict) {
        const ids = cache.get(day);
        if (ids) {
          for (const id of ids) next.delete(id);
        }
        cache.delete(day);
      }
      return next;
    });
  }, []);

  // ── Merge slim rows into marker map ─────────────────────────────────
  const mergeRows = useCallback((rows: MapMarkerRow[]) => {
    if (rows.length === 0) return;

    const transformed = rows.map(transformMarkerRow).filter(
      (m) => m.event_location.lat != null && m.event_location.lng != null
    );

    setMarkerMap((prev) => {
      const next = new Map(prev);
      for (const m of transformed) {
        next.set(m.id, m);
        // Track day → ids for LRU eviction
        const ids = dayCache.current.get(m.date) ?? new Set();
        ids.add(m.id);
        dayCache.current.set(m.date, ids);
      }
      return next;
    });

    evictStaleDays();
  }, [evictStaleDays]);

  // ── Initial fetch: slim markers ─────────────────────────────────────
  const fetchMarkers = useCallback(async () => {
    if (!supabase) {
      setError("Supabase not configured");
      setIsLoading(false);
      return;
    }

    try {
      const since = new Date(Date.now() - DEFAULT_LOOKBACK_MS).toISOString();
      const { data, error: rpcErr } = await supabase.rpc("get_map_markers", {
        p_since: since,
        p_countries: MAP_COUNTRIES,
        p_limit: 5000,
      });

      if (rpcErr) throw rpcErr;

      const rows = (data ?? []) as MapMarkerRow[];
      if (rows.length > 0) {
        lastEnrichedAt.current = rows.reduce(
          (max, r) => (r.enriched_at > max ? r.enriched_at : max),
          rows[0].enriched_at,
        );
      } else {
        lastEnrichedAt.current = new Date().toISOString();
      }

      mergeRows(rows);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch markers");
    }
  }, [mergeRows]);

  // ── Incremental poll ────────────────────────────────────────────────
  const pollNew = useCallback(async () => {
    if (!supabase || !lastEnrichedAt.current) return;

    try {
      const { data, error: rpcErr } = await supabase.rpc("get_new_markers_since", {
        p_since: lastEnrichedAt.current,
        p_countries: MAP_COUNTRIES,
      });

      if (rpcErr) throw rpcErr;

      const rows = (data ?? []) as MapMarkerRow[];
      if (rows.length > 0) {
        lastEnrichedAt.current = rows.reduce(
          (max, r) => (r.enriched_at > max ? r.enriched_at : max),
          rows[0].enriched_at,
        );
        mergeRows(rows);
      }
    } catch {
      // Silent poll failure
    }
  }, [mergeRows]);

  // ── Initial load + polling ──────────────────────────────────────────
  useEffect(() => {
    setIsLoading(true);
    fetchMarkers().finally(() => setIsLoading(false));

    const interval = setInterval(pollNew, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchMarkers, pollNew]);

  const refresh = useCallback(() => {
    setIsLoading(true);
    dayCache.current.clear();
    setMarkerMap(new Map());
    fetchMarkers().finally(() => setIsLoading(false));
  }, [fetchMarkers]);

  const markers = useMemo(() => Array.from(markerMap.values()), [markerMap]);

  return { markers, isLoading, error, refresh };
}
