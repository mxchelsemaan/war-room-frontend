import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { THEATER_COUNTRIES } from "@/config/map";
import type { TimelineDateEntry } from "@/types/events";

export interface UseTimelineDatesReturn {
  dates: TimelineDateEntry[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useTimelineDates(
  dateFrom?: string,
  dateTo?: string,
): UseTimelineDatesReturn {
  const [dates, setDates] = useState<TimelineDateEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!supabase) return;

    setIsLoading(true);
    try {
      const params: Record<string, unknown> = {
        p_countries: THEATER_COUNTRIES,
      };
      if (dateFrom) params.p_from = dateFrom.slice(0, 10);
      if (dateTo) params.p_to = dateTo.slice(0, 10);

      const { data, error: rpcErr } = await supabase.rpc("get_timeline_dates", params);

      if (rpcErr) throw rpcErr;

      const entries = ((data ?? []) as { day: string; count: number }[]).map((r) => ({
        day: typeof r.day === "string" ? r.day.slice(0, 10) : String(r.day),
        count: Number(r.count),
      }));

      setDates(entries);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch timeline dates");
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetch();

    const interval = setInterval(() => { fetch(); }, 60_000);
    return () => clearInterval(interval);
  }, [fetch]);

  return { dates, isLoading, error, refresh: fetch };
}
