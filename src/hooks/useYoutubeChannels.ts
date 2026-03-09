import { useEffect, useState } from "react";

export interface YoutubeChannel {
  handle: string;
  active: boolean;
  display_name: string;
  language: "english" | "arabic" | "french";
  video_id: string;
  /** true = confirmed live via API, false = confirmed not live, null = unknown (no API key) */
  is_live: boolean | null;
}

interface ChannelConfig {
  display_name: string;
  handle: string;
  language: YoutubeChannel["language"];
  channel_id: string;       // stable UC… ID — used to query the API
  fallback_video_id: string; // used when API key absent or request fails
}

const CHANNELS: ChannelConfig[] = [
  { display_name: "Al Jazeera Arabic",  handle: "aljazeera",       language: "arabic",  channel_id: "UCfiwzLy-8yKzIbsmZTzxDgw", fallback_video_id: "bNyUyrR0PHo" },
  { display_name: "Al Jazeera English", handle: "AlJazeeraEnglish", language: "english", channel_id: "UCNye-wNBqNL5ZzHSJj3l8Bg", fallback_video_id: "gCNeDWCI0vo" },
  { display_name: "Al Jadeed",          handle: "aljadeed",         language: "arabic",  channel_id: "UCoAOpXaFG4v3J8b8TSLmXvg", fallback_video_id: "V7byUF8j-W0" },
  { display_name: "MTV Lebanon",        handle: "MTVLebanonNews",   language: "arabic",  channel_id: "UC9_XmAwE5szLHF76FjMylaw",  fallback_video_id: "vuJ3toOYBRM" },
];

function toChannels(
  configs: ChannelConfig[],
  liveIds: Record<string, string> | null, // null = no API key, unknown live status
): YoutubeChannel[] {
  return configs.map((c) => ({
    handle: c.handle,
    active: true,
    display_name: c.display_name,
    language: c.language,
    video_id: liveIds?.[c.channel_id] ?? c.fallback_video_id,
    is_live: liveIds === null ? null : c.channel_id in liveIds,
  }));
}

async function fetchLiveVideoId(channelId: string, apiKey: string): Promise<string | null> {
  const url =
    `https://www.googleapis.com/youtube/v3/search` +
    `?part=id&channelId=${channelId}&eventType=live&type=video&maxResults=1&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return (data.items?.[0]?.id?.videoId as string) ?? null;
}

interface UseYoutubeChannelsResult {
  channels: YoutubeChannel[];
  loading: boolean;
  error: string | null;
}

export function useYoutubeChannels(): UseYoutubeChannelsResult {
  const [channels, setChannels] = useState<YoutubeChannel[]>(() =>
    toChannels(CHANNELS, null)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;
    if (!apiKey) {
      // No key — mark all as unknown live status but keep fallback video IDs
      setChannels(toChannels(CHANNELS, null));
      return;
    }

    setLoading(true);
    let cancelled = false;

    Promise.all(
      CHANNELS.map(async (c) => {
        const videoId = await fetchLiveVideoId(c.channel_id, apiKey).catch(() => null);
        return [c.channel_id, videoId] as [string, string | null];
      })
    ).then((entries) => {
      if (cancelled) return;
      const liveIds: Record<string, string> = {};
      for (const [id, vid] of entries) {
        if (vid) liveIds[id] = vid;
      }
      setChannels(toChannels(CHANNELS, liveIds)); // is_live derived from presence in liveIds
      setLoading(false);
    }).catch((err) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : "Failed to load live streams");
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  return { channels, loading, error };
}
