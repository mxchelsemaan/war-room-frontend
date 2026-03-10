import { useEffect, useRef, useState } from "react";
import type { YoutubeChannel } from "@/data/youtubeChannels";

export interface LiveStatus {
  isLive: boolean;
  videoId: string | null;
}

export type LiveStatusMap = Record<string, LiveStatus>;

const POLL_INTERVAL = 3 * 60 * 1000; // 3 minutes

/**
 * Probe YouTube oEmbed to check if a channel's /live URL resolves to a video.
 * The oEmbed endpoint is CORS-friendly and returns JSON with thumbnail_url
 * containing the video ID when a live stream is active.
 */
async function probeLiveStatus(
  handle: string,
  signal: AbortSignal,
): Promise<LiveStatus> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/@${handle}/live&format=json`;
    const res = await fetch(oembedUrl, { signal });

    if (!res.ok) return { isLive: false, videoId: null };

    const json = await res.json();
    // thumbnail_url looks like: https://i.ytimg.com/vi/VIDEO_ID/hqdefault.jpg
    const match = (json.thumbnail_url as string)?.match(/\/vi\/([a-zA-Z0-9_-]{11})\//);
    const videoId = match?.[1] ?? null;

    return { isLive: !!videoId, videoId };
  } catch {
    return { isLive: false, videoId: null };
  }
}

/**
 * Polls YouTube oEmbed for each channel to detect live status and discover video IDs.
 * Returns a map of handle -> { isLive, videoId }.
 */
export function useLiveStatus(channels: YoutubeChannel[]) {
  const [statusMap, setStatusMap] = useState<LiveStatusMap>({});
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (channels.length === 0) {
      setStatusMap({});
      setLoading(false);
      return;
    }

    let active = true;

    const poll = async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const results = await Promise.allSettled(
        channels.map((ch) => probeLiveStatus(ch.handle, controller.signal)),
      );

      if (!active) return;

      const map: LiveStatusMap = {};
      channels.forEach((ch, i) => {
        const r = results[i];
        if (r.status === "fulfilled") {
          // If oEmbed found a video, use it; otherwise fall back to stored video_id
          map[ch.handle] = r.value.isLive
            ? r.value
            : { isLive: false, videoId: ch.video_id ?? r.value.videoId };
        } else {
          map[ch.handle] = { isLive: false, videoId: ch.video_id };
        }
      });
      setStatusMap(map);
      setLoading(false);
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL);

    return () => {
      active = false;
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [channels]);

  return { statusMap, loading };
}
