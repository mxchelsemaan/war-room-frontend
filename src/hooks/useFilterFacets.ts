import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { FEED_COUNTRIES } from "@/config/map";
import type { FilterFacets } from "@/types/events";

const EMPTY_FACETS: FilterFacets = {
  by_type: {},
  by_severity: {},
  by_region: {},
  by_source_type: {},
  total: 0,
};

export interface UseFilterFacetsReturn {
  facets: FilterFacets;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useFilterFacets(
  dateFrom?: string,
  dateTo?: string,
): UseFilterFacetsReturn {
  const [facets, setFacets] = useState<FilterFacets>(EMPTY_FACETS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!supabase) return;

    setIsLoading(true);
    try {
      const params: Record<string, unknown> = {
        p_countries: FEED_COUNTRIES,
      };
      if (dateFrom) params.p_from = dateFrom.slice(0, 10);
      if (dateTo) params.p_to = dateTo.slice(0, 10);

      const { data, error: rpcErr } = await supabase.rpc("get_filter_facets", params);

      if (rpcErr) throw rpcErr;

      if (data) {
        const raw = data as FilterFacets;
        setFacets({
          by_type: raw.by_type ?? {},
          by_severity: raw.by_severity ?? {},
          by_region: raw.by_region ?? {},
          by_source_type: raw.by_source_type ?? {},
          total: raw.total ?? 0,
        });
      }

      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch filter facets");
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetch();

    const interval = setInterval(() => { fetch(); }, 60_000);
    return () => clearInterval(interval);
  }, [fetch]);

  return { facets, isLoading, error, refresh: fetch };
}
