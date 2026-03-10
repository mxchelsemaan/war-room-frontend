-- Add live status columns to youtube_channels
ALTER TABLE config.youtube_channels
  ADD COLUMN IF NOT EXISTS is_live boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS live_video_id text,
  ADD COLUMN IF NOT EXISTS live_checked_at timestamptz;

-- pg_cron + pg_net: invoke edge function every 5 minutes
SELECT cron.schedule(
  'youtube-live-status-check',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/youtube-live-status',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
