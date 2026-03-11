-- ============================================================================
-- Feed consistency: sort by enriched_at, add date range + weapon system filters
-- ============================================================================

CREATE OR REPLACE FUNCTION get_feed_events(
  p_countries text[] DEFAULT NULL,
  p_limit int DEFAULT 30,
  p_types text[] DEFAULT NULL,
  p_severities text[] DEFAULT NULL,
  p_regions text[] DEFAULT NULL,
  p_source_types text[] DEFAULT NULL,
  p_cursor timestamptz DEFAULT NULL,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_weapon_systems text[] DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  source_type text,
  source_id text,
  source_channel text,
  date_occurred timestamptz,
  message_date timestamptz,
  latitude double precision,
  longitude double precision,
  enriched_at timestamptz,
  data jsonb,
  media_url text
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    e.id, e.source_type, e.source_id, e.source_channel,
    e.date_occurred, e.message_date, e.latitude, e.longitude,
    e.enriched_at, e.data,
    CASE
      WHEN e.source_type = 'telegram' THEN tm.media_url
      WHEN e.source_type = 'x_post'  THEN (xp.media->0->>'url')
      ELSE NULL
    END AS media_url
  FROM enriched.events e
  LEFT JOIN raw.telegram_messages tm
    ON e.source_type = 'telegram'
    AND tm.channel_username = split_part(e.source_id, ':', 1)
    AND tm.message_id = safe_bigint(split_part(e.source_id, ':', 2))
  LEFT JOIN raw.x_posts xp
    ON e.source_type = 'x_post'
    AND xp.tweet_id = safe_bigint(e.source_id)
  WHERE e.latitude IS NOT NULL
    AND e.longitude IS NOT NULL
    AND (p_countries IS NULL OR e.data->>'location_country' = ANY(p_countries))
    AND (p_types IS NULL OR e.data->>'event_type' = ANY(p_types))
    AND (p_severities IS NULL OR e.data->>'severity' = ANY(p_severities))
    AND (p_regions IS NULL OR e.data->>'location_region' = ANY(p_regions))
    AND (p_source_types IS NULL OR e.source_type = ANY(p_source_types))
    AND (p_date_from IS NULL OR COALESCE(e.date_occurred, e.message_date)::date >= p_date_from)
    AND (p_date_to IS NULL OR COALESCE(e.date_occurred, e.message_date)::date <= p_date_to)
    AND (p_weapon_systems IS NULL OR e.data->>'weapon_system' = ANY(p_weapon_systems))
    AND (p_cursor IS NULL OR e.enriched_at < p_cursor)
  ORDER BY e.enriched_at DESC
  LIMIT p_limit;
$$;
