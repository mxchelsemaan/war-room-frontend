import { supabase } from "@/lib/supabase";

export interface YoutubeChannel {
  handle: string;
  active: boolean;
  display_name: string;
  language: string;
  country: string;
  video_id: string | null;
}

/**
 * Fetch active YouTube channels from Supabase.
 * Falls back to empty array if Supabase is not configured.
 */
export async function fetchYoutubeChannels(): Promise<YoutubeChannel[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .schema("config")
    .from("youtube_channels")
    .select("handle, display_name, language, country, video_id, active")
    .eq("active", true);

  if (error) {
    console.error("Failed to fetch YouTube channels:", error.message);
    return [];
  }

  return (data ?? []) as YoutubeChannel[];
}
