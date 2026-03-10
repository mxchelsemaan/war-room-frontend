import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function getYoutubeApiKey(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const { data, error } = await supabase.rpc('read_secret', { secret_name: 'YOUTUBE_API_KEY' });
  if (error) {
    console.error('Failed to read YOUTUBE_API_KEY from vault:', error.message);
    return Deno.env.get('YOUTUBE_API_KEY') ?? null;
  }
  return data?.[0]?.decrypted_secret ?? Deno.env.get('YOUTUBE_API_KEY') ?? null;
}

interface Channel {
  handle: string;
  video_id: string | null;
  live_video_id: string | null;
  channel_id: string | null;
  live_checked_at: string | null;
}

/**
 * Batch-check whether video IDs are currently live.
 * Uses `videos.list` — costs 1 quota unit regardless of count (up to 50).
 */
async function batchCheckVideos(
  videoIds: string[],
  apiKey: string,
): Promise<Record<string, boolean>> {
  const ids = videoIds.filter(Boolean).join(",");
  if (!ids) return {};

  const url = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${ids}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error("videos.list failed:", res.status, await res.text());
    return {};
  }

  const data = await res.json();
  const map: Record<string, boolean> = {};

  for (const item of data.items ?? []) {
    const d = item.liveStreamingDetails;
    map[item.id] = !!(d?.actualStartTime && !d?.actualEndTime);
  }
  return map;
}

/**
 * Search for a channel's current live stream.
 * Uses `search.list` — costs 100 quota units. Only called for stale channels.
 */
async function searchLiveStream(
  channelId: string,
  apiKey: string,
): Promise<string | null> {
  const url = `https://www.googleapis.com/youtube/v3/search?part=id&channelId=${channelId}&eventType=live&type=video&maxResults=1&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error("search.list failed:", res.status, await res.text());
    return null;
  }

  const data = await res.json();
  return data.items?.[0]?.id?.videoId ?? null;
}

Deno.serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const YOUTUBE_API_KEY = await getYoutubeApiKey(supabase);
  if (!YOUTUBE_API_KEY) {
    return new Response(
      JSON.stringify({ error: "YOUTUBE_API_KEY not found in vault or env" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // Fetch active channels
  const { data: channels, error: fetchError } = await supabase
    .schema("config")
    .from("youtube_channels")
    .select("handle, video_id, live_video_id, channel_id, live_checked_at")
    .eq("active", true);

  if (fetchError) {
    console.error("Failed to fetch channels:", fetchError.message);
    return new Response(
      JSON.stringify({ error: fetchError.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const chs = (channels ?? []) as Channel[];
  if (chs.length === 0) {
    return new Response(
      JSON.stringify({ message: "No active channels" }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  // Phase 1: Batch check all known video IDs (1 quota unit)
  const allVideoIds = new Set<string>();
  for (const ch of chs) {
    if (ch.video_id) allVideoIds.add(ch.video_id);
    if (ch.live_video_id) allVideoIds.add(ch.live_video_id);
  }

  const liveMap = await batchCheckVideos([...allVideoIds], YOUTUBE_API_KEY);

  // Build updates
  type Update = {
    handle: string;
    is_live: boolean;
    live_video_id: string | null;
    live_checked_at: string;
  };
  const updates: Update[] = [];
  const staleChannels: Channel[] = [];
  const now = new Date().toISOString();

  for (const ch of chs) {
    // Check if stored live_video_id or video_id is live
    if (ch.live_video_id && liveMap[ch.live_video_id]) {
      updates.push({
        handle: ch.handle,
        is_live: true,
        live_video_id: ch.live_video_id,
        live_checked_at: now,
      });
    } else if (ch.video_id && liveMap[ch.video_id]) {
      updates.push({
        handle: ch.handle,
        is_live: true,
        live_video_id: ch.video_id,
        live_checked_at: now,
      });
    } else if (ch.channel_id) {
      // Not live with known IDs — candidate for search
      staleChannels.push(ch);
    } else {
      // No channel_id to search — mark offline
      updates.push({
        handle: ch.handle,
        is_live: false,
        live_video_id: null,
        live_checked_at: now,
      });
    }
  }

  // Phase 2: Search for live streams on stale channels (100 units each)
  // Only search channels not searched in the last hour
  const ONE_HOUR_AGO = Date.now() - 60 * 60 * 1000;

  for (const ch of staleChannels) {
    const lastChecked = ch.live_checked_at
      ? new Date(ch.live_checked_at).getTime()
      : 0;

    if (lastChecked > ONE_HOUR_AGO) {
      // Recently searched — just mark offline, keep existing live_video_id
      updates.push({
        handle: ch.handle,
        is_live: false,
        live_video_id: ch.live_video_id,
        live_checked_at: ch.live_checked_at ?? now,
      });
      continue;
    }

    const foundId = await searchLiveStream(ch.channel_id!, YOUTUBE_API_KEY);
    if (foundId) {
      updates.push({
        handle: ch.handle,
        is_live: true,
        live_video_id: foundId,
        live_checked_at: now,
      });
    } else {
      updates.push({
        handle: ch.handle,
        is_live: false,
        live_video_id: null,
        live_checked_at: now,
      });
    }
  }

  // Write updates to DB
  let updatedCount = 0;
  for (const u of updates) {
    const { error: updateError } = await supabase
      .schema("config")
      .from("youtube_channels")
      .update({
        is_live: u.is_live,
        live_video_id: u.live_video_id,
        live_checked_at: u.live_checked_at,
      })
      .eq("handle", u.handle);

    if (updateError) {
      console.error(`Failed to update ${u.handle}:`, updateError.message);
    } else {
      updatedCount++;
    }
  }

  const liveCount = updates.filter((u) => u.is_live).length;
  console.log(
    `Updated ${updatedCount}/${chs.length} channels. ${liveCount} live, ${staleChannels.length} searched.`,
  );

  return new Response(
    JSON.stringify({
      updated: updatedCount,
      total: chs.length,
      live: liveCount,
      searched: staleChannels.length,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
