import { useMemo, useState, useCallback } from "react";
import { YOUTUBE_CHANNELS } from "@/data/youtubeChannels";

const LANGUAGE_LABEL: Record<string, string> = {
  english: "English",
  arabic:  "عربي",
  french:  "Français",
};

export function useYoutubePlayer() {
  const channelGroups = useMemo(() => {
    const map = new Map<string, typeof YOUTUBE_CHANNELS>();
    for (const ch of YOUTUBE_CHANNELS) {
      const bucket = map.get(ch.display_name) ?? [];
      bucket.push(ch);
      map.set(ch.display_name, bucket);
    }
    return Array.from(map.entries()).map(([name, streams]) => ({ name, streams }));
  }, []);

  const [selectedGroup, setSelectedGroup] = useState(-1);
  const [selectedStream, setSelectedStream] = useState(0);

  const handleGroupChange = useCallback((idx: number) => {
    setSelectedGroup(idx);
    setSelectedStream(0);
  }, []);

  const group = channelGroups[selectedGroup];
  const stream = group?.streams[selectedStream];
  const embedSrc = stream ? `https://www.youtube.com/embed/${stream.video_id}?autoplay=0` : null;

  return {
    channelGroups,
    selectedGroup,
    selectedStream,
    setSelectedStream,
    handleGroupChange,
    group,
    stream,
    embedSrc,
    LANGUAGE_LABEL,
  };
}
