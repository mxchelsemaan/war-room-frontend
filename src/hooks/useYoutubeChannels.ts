export interface YoutubeChannel {
  handle: string;
  active: boolean;
  display_name: string;
  language: "english" | "arabic" | "french";
  video_id: string;
}

/** Refresh video IDs with: node scripts/get-yt-live-ids.mjs */
export const YOUTUBE_CHANNELS: YoutubeChannel[] = [
  { display_name: "Al Jazeera Arabic",  handle: "aljazeera",       language: "arabic",  active: true, video_id: "bNyUyrR0PHo" },
  { display_name: "Al Jazeera English", handle: "AlJazeeraEnglish", language: "english", active: true, video_id: "gCNeDWCI0vo" },
  { display_name: "Al Jadeed",          handle: "aljadeed",         language: "arabic",  active: true, video_id: "V7byUF8j-W0" },
  { display_name: "MTV Lebanon",        handle: "MTVLebanonNews",   language: "arabic",  active: true, video_id: "vuJ3toOYBRM" },
];

export function useYoutubeChannels() {
  return { channels: YOUTUBE_CHANNELS, loading: false, error: null };
}
