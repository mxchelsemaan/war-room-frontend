import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface InfraPin {
  id: string;
  type: string;
  label: string;
  sublabel: string | null;
  emoji: string;
  lat: number;
  lng: number;
  color: string;
  display_order: number;
}

export interface InfraTypeMeta {
  label: string;
  icon: string;
}

export interface UseInfraMarkersReturn {
  markers: InfraPin[];
  markerTypes: Record<string, InfraTypeMeta>;
  markerColors: Record<string, string>;
  isLoading: boolean;
  error: string | null;
}

/** Title-case a snake_case string */
function titleCase(s: string): string {
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function useInfraMarkers(): UseInfraMarkersReturn {
  const [markers, setMarkers] = useState<InfraPin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetch() {
      const { data, error: err } = await supabase!
        .schema("config")
        .from("infrastructure_pins")
        .select("*")
        .order("display_order", { ascending: true });

      if (cancelled) return;

      if (err) {
        setError(err.message);
        setIsLoading(false);
        return;
      }

      setMarkers(
        (data ?? []).map((row: Record<string, unknown>) => ({
          id: row.id as string,
          type: row.type as string,
          label: row.label as string,
          sublabel: (row.sublabel as string) ?? null,
          emoji: row.emoji as string,
          lat: row.lat as number,
          lng: row.lng as number,
          color: row.color as string,
          display_order: row.display_order as number,
        })),
      );
      setIsLoading(false);
    }

    fetch();
    return () => { cancelled = true; };
  }, []);

  const markerTypes = useMemo(() => {
    const map: Record<string, InfraTypeMeta> = {};
    for (const m of markers) {
      if (!map[m.type]) {
        map[m.type] = { label: titleCase(m.type), icon: m.emoji };
      }
    }
    return map;
  }, [markers]);

  const markerColors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of markers) {
      if (!map[m.type]) {
        map[m.type] = m.color;
      }
    }
    return map;
  }, [markers]);

  return { markers, markerTypes, markerColors, isLoading, error };
}
