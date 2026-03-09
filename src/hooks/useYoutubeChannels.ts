import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface YoutubeChannel {
  handle: string;
  active: boolean;
  display_name: string;
  language: "english" | "arabic" | "french";
  video_id: string;
}

interface UseYoutubeChannelsResult {
  channels: YoutubeChannel[];
  loading: boolean;
  error: string | null;
}

export function useYoutubeChannels(): UseYoutubeChannelsResult {
  const [channels, setChannels] = useState<YoutubeChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let cancelled = false;

    supabase
      .from("youtube_channels")
      .select("*")
      .eq("active", true)
      .order("display_name", { ascending: true })
      .order("language", { ascending: true })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setError(err.message);
        } else {
          setChannels((data as YoutubeChannel[]) ?? []);
        }
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return { channels, loading, error };
}
