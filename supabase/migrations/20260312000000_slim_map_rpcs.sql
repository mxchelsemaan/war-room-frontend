-- ============================================================================
-- Priority 1: Slim map marker RPCs (60-70% less payload for map display)
-- Priority 2: Enable Supabase Realtime on events table
-- Priority 4: Cursor-based feed pagination RPC
-- ============================================================================

-- ── Priority 1: Slim map markers ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_map_markers(
  p_since timestamptz DEFAULT NOW() - INTERVAL '12 hours',
  p_countries text[] DEFAULT NULL,
  p_limit int DEFAULT 5000
)
RETURNS TABLE(
  id uuid,
  event_type text,
  severity text,
  lat double precision,
  lng double precision,
  date timestamptz,
  source_type text,
  location_name text,
  location_region text,
  enriched_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    e.id,
    e.data->>'event_type'       AS event_type,
    e.data->>'severity'         AS severity,
    e.latitude                  AS lat,
    e.longitude                 AS lng,
    COALESCE(e.date_occurred, e.message_date) AS date,
    e.source_type,
    e.data->>'location_name'    AS location_name,
    e.data->>'location_region'  AS location_region,
    e.enriched_at
  FROM enriched.events e
  WHERE e.latitude IS NOT NULL
    AND e.longitude IS NOT NULL
    AND COALESCE(e.date_occurred, e.message_date) >= p_since
    AND (p_countries IS NULL OR e.data->>'location_country' = ANY(p_countries))
  ORDER BY COALESCE(e.date_occurred, e.message_date) DESC
  LIMIT p_limit;
$$;

-- Incremental slim markers since a given timestamp
CREATE OR REPLACE FUNCTION get_new_markers_since(
  p_since timestamptz,
  p_countries text[] DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  event_type text,
  severity text,
  lat double precision,
  lng double precision,
  date timestamptz,
  source_type text,
  location_name text,
  location_region text,
  enriched_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    e.id,
    e.data->>'event_type'       AS event_type,
    e.data->>'severity'         AS severity,
    e.latitude                  AS lat,
    e.longitude                 AS lng,
    COALESCE(e.date_occurred, e.message_date) AS date,
    e.source_type,
    e.data->>'location_name'    AS location_name,
    e.data->>'location_region'  AS location_region,
    e.enriched_at
  FROM enriched.events e
  WHERE e.latitude IS NOT NULL
    AND e.longitude IS NOT NULL
    AND e.enriched_at > p_since
    AND (p_countries IS NULL OR e.data->>'location_country' = ANY(p_countries))
  ORDER BY e.enriched_at ASC;
$$;

-- ── Priority 2: Enable Supabase Realtime ──────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE events;

-- ── Priority 4: Cursor-based feed pagination ──────────────────────────────

CREATE OR REPLACE FUNCTION get_feed_events(
  p_countries text[] DEFAULT NULL,
  p_limit int DEFAULT 30,
  p_types text[] DEFAULT NULL,
  p_severities text[] DEFAULT NULL,
  p_regions text[] DEFAULT NULL,
  p_source_types text[] DEFAULT NULL,
  p_cursor timestamptz DEFAULT NULL
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
    AND (p_cursor IS NULL OR COALESCE(e.date_occurred, e.message_date) < p_cursor)
  ORDER BY COALESCE(e.date_occurred, e.message_date) DESC
  LIMIT p_limit;
$$;
