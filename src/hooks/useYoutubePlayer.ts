import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchYoutubeChannels, type YoutubeChannel } from "@/data/youtubeChannels";

/** Convert ISO 3166-1 alpha-2 country code to flag emoji */
function countryFlag(code: string): string {
  const upper = code.toUpperCase();
  if (upper.length !== 2) return "";
  return String.fromCodePoint(
    ...upper.split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export interface ChannelGroup {
  name: string;
  handle: string;
  country: string;
  streams: YoutubeChannel[];
  isLive: boolean;
}

export function useYoutubePlayer() {
  const [channels, setChannels] = useState<YoutubeChannel[]>([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const data = await fetchYoutubeChannels();
      if (active) setChannels(data);
    };

    load();
    const interval = setInterval(load, REFRESH_INTERVAL);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const channelGroups: ChannelGroup[] = useMemo(() => {
    const sorted = [...channels].sort((a, b) => {
      const countryCmp = a.country.localeCompare(b.country);
      if (countryCmp !== 0) return countryCmp;
      return a.display_name.localeCompare(b.display_name);
    });
    return sorted.map((ch) => ({
      name: `${countryFlag(ch.country)} ${ch.display_name}`,
      handle: ch.handle,
      country: ch.country,
      streams: [ch],
      isLive: ch.is_live,
    }));
  }, [channels]);

  const [selectedGroup, setSelectedGroup] = useState(-1);
  const [selectedStream, setSelectedStream] = useState(0);

  const handleGroupChange = useCallback((idx: number) => {
    setSelectedGroup(idx);
    setSelectedStream(0);
  }, []);

  const group = channelGroups[selectedGroup];
  const stream = group?.streams[selectedStream];

  // Prefer live video ID discovered by edge function, fall back to stored
  const videoId = stream
    ? (stream.live_video_id ?? stream.video_id)
    : null;
  const embedSrc = videoId
    ? `https://www.youtube.com/embed/${videoId}?autoplay=0&cc_load_policy=1&cc_lang_pref=en`
    : null;

  return {
    channelGroups,
    selectedGroup,
    selectedStream,
    setSelectedStream,
    handleGroupChange,
    group,
    stream,
    embedSrc,
    countryFlag,
  };
}
