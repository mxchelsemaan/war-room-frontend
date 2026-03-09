/**
 * One-off script: resolve current live-stream video IDs for news channels.
 * Usage: node scripts/get-yt-live-ids.mjs
 *
 * Paste the output JSON into the STATIC_CHANNELS array in
 * src/hooks/useYoutubeChannels.ts to refresh the hardcoded IDs.
 */

const CHANNELS = [
  { display_name: "Al Jazeera Arabic",  handle: "aljazeera",       language: "arabic"  },
  { display_name: "Al Jazeera English", handle: "AlJazeeraEnglish", language: "english" },
  { display_name: "Al Jadeed",          handle: "aljadeed",         language: "arabic"  },
  { display_name: "MTV Lebanon",        handle: "MTVLebanonNews",   language: "arabic"  },
];

async function getLiveVideoId(handle) {
  const url = `https://www.youtube.com/@${handle}/live`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
    },
    redirect: "follow",
  });

  // First try: video ID in the final URL after redirect
  const finalUrl = res.url;
  const urlMatch = finalUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (urlMatch) return urlMatch[1];

  // Second try: extract from page HTML
  const html = await res.text();
  const htmlMatch = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
  if (htmlMatch) return htmlMatch[1];

  return null;
}

const results = await Promise.all(
  CHANNELS.map(async (ch) => {
    const video_id = await getLiveVideoId(ch.handle);
    return { ...ch, active: true, video_id };
  })
);

console.log("// Paste into STATIC_CHANNELS in src/hooks/useYoutubeChannels.ts");
console.log(JSON.stringify(results, null, 2));

const failed = results.filter((r) => !r.video_id);
if (failed.length) {
  console.error("\nFailed to resolve:", failed.map((r) => r.handle).join(", "));
}
