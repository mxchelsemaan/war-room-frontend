export type { YoutubeChannel } from "@/data/youtubeChannels";
import { YOUTUBE_CHANNELS } from "@/data/youtubeChannels";

export { YOUTUBE_CHANNELS };

export function useYoutubeChannels() {
  return { channels: YOUTUBE_CHANNELS, loading: false, error: null };
}
