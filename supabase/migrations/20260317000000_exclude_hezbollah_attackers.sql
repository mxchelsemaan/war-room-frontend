-- ============================================================================
-- Exclude Hezbollah-attacker events from all data RPCs and materialized view.
--
-- Attacker patterns excluded (ILIKE):
--   %Hezbollah%          — "Hezbollah", "Kataib Hezbollah", "Iran and Hezbollah", etc.
--   %Islamic Resistance% — "Islamic Resistance in Lebanon", "… in Iraq", etc.
--   %Radwan forces%
--
-- NOT excluded: "Islamic Revolutionary Guard Corps" (without Hezbollah),
--   "launches from Lebanon", "Unidentified militants from Lebanon"
-- ============================================================================

-- ── 1. Rebuild events_daily_summary materialized view ───────────────────────

DROP MATERIALIZED VIEW IF EXISTS events_daily_summary;

CREATE MATERIALIZED VIEW events_daily_summary AS
SELECT
  e.message_date::date AS day,
  e.data->>'event_type'        AS event_type,
  e.data->>'severity'          AS severity,
  e.data->>'location_region'   AS region,
  e.data->>'location_country'  AS country,
  e.source_type,
  COUNT(*)                                                    AS event_count,
  SUM(COALESCE((e.data->>'casualties_killed')::int, 0))      AS total_killed,
  SUM(COALESCE((e.data->>'casualties_injured')::int, 0))     AS total_injured,
  AVG(e.latitude)                                             AS centroid_lat,
  AVG(e.longitude)                                            AS centroid_lng
FROM enriched.events e
WHERE e.latitude IS NOT NULL AND e.longitude IS NOT NULL
  AND NOT (
    e.data->>'attacker' ILIKE '%Hezbollah%'
    OR e.data->>'attacker' ILIKE '%Islamic Resistance%'
    OR e.data->>'attacker' ILIKE '%Radwan forces%'
  )
GROUP BY day, event_type, severity, region, country, e.source_type;

CREATE UNIQUE INDEX idx_daily_summary_pk
  ON events_daily_summary (day, event_type, severity, region, country, source_type);

-- ── 2. get_feed_events ─────────────────────────────────────────────────────

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
  p_weapon_systems text[] DEFAULT NULL,
  p_handles text[] DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  source_type text,
  source_id text,
  source_channel text,
  message_date timestamptz,
  latitude double precision,
  longitude double precision,
  enriched_at timestamptz,
  data jsonb,
  media_url text,
  media_type text
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    e.id, e.source_type, e.source_id, e.source_channel,
    e.message_date, e.latitude, e.longitude,
    e.enriched_at, e.data,
    CASE
      WHEN e.source_type = 'telegram' THEN (
        SELECT tm.media_url
        FROM raw.telegram_messages tm
        WHERE tm.channel_username = split_part(e.source_id, ':', 1)
          AND tm.message_id = safe_bigint(split_part(e.source_id, ':', 2))
        LIMIT 1
      )
      WHEN e.source_type = 'x_post' THEN (
        SELECT xp.media->0->>'url'
        FROM raw.x_posts xp
        WHERE xp.tweet_id = safe_bigint(e.source_id)
        LIMIT 1
      )
      ELSE NULL
    END AS media_url,
    CASE
      WHEN e.source_type = 'telegram' THEN (
        SELECT tm.media_type
        FROM raw.telegram_messages tm
        WHERE tm.channel_username = split_part(e.source_id, ':', 1)
          AND tm.message_id = safe_bigint(split_part(e.source_id, ':', 2))
        LIMIT 1
      )
      ELSE NULL
    END AS media_type
  FROM enriched.events e
  WHERE e.latitude IS NOT NULL
    AND e.longitude IS NOT NULL
    AND (p_countries IS NULL OR e.data->>'location_country' = ANY(p_countries))
    AND (p_types IS NULL OR e.data->>'event_type' = ANY(p_types))
    AND (p_severities IS NULL OR e.data->>'severity' = ANY(p_severities))
    AND (p_regions IS NULL OR e.data->>'location_region' = ANY(p_regions))
    AND (p_source_types IS NULL OR e.source_type = ANY(p_source_types))
    AND (p_date_from IS NULL OR e.message_date::date >= p_date_from)
    AND (p_date_to IS NULL OR e.message_date::date <= p_date_to)
    AND (p_weapon_systems IS NULL OR e.data->>'weapon_system' = ANY(p_weapon_systems))
    AND (p_handles IS NULL OR e.source_channel = ANY(p_handles))
    AND (p_cursor IS NULL OR e.message_date < p_cursor)
    AND NOT (
      e.data->>'attacker' ILIKE '%Hezbollah%'
      OR e.data->>'attacker' ILIKE '%Islamic Resistance%'
      OR e.data->>'attacker' ILIKE '%Radwan forces%'
    )
  ORDER BY e.message_date DESC NULLS LAST
  LIMIT p_limit;
$$;

-- ── 3. get_recent_events ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_recent_events(
  p_since timestamptz DEFAULT NOW() - INTERVAL '12 hours',
  p_countries text[] DEFAULT NULL,
  p_limit int DEFAULT 2000
)
RETURNS TABLE(
  id uuid,
  source_type text,
  source_id text,
  source_channel text,
  message_date timestamptz,
  latitude double precision,
  longitude double precision,
  enriched_at timestamptz,
  data jsonb,
  media_url text
)
LANGUAGE sql STABLE
AS $$
  SELECT
    e.id, e.source_type, e.source_id, e.source_channel,
    e.message_date, e.latitude, e.longitude, e.enriched_at, e.data,
    CASE
      WHEN e.source_type = 'telegram' THEN (
        SELECT tm.media_url
        FROM raw.telegram_messages tm
        WHERE tm.channel_username = split_part(e.source_id, ':', 1)
          AND tm.message_id = safe_bigint(split_part(e.source_id, ':', 2))
        LIMIT 1
      )
      WHEN e.source_type = 'x_post' THEN (
        SELECT xp.media->0->>'url'
        FROM raw.x_posts xp
        WHERE xp.tweet_id = safe_bigint(e.source_id)
        LIMIT 1
      )
      ELSE NULL
    END AS media_url
  FROM enriched.events e
  WHERE e.latitude IS NOT NULL
    AND e.longitude IS NOT NULL
    AND e.message_date >= p_since
    AND (p_countries IS NULL OR e.data->>'location_country' = ANY(p_countries))
    AND NOT (
      e.data->>'attacker' ILIKE '%Hezbollah%'
      OR e.data->>'attacker' ILIKE '%Islamic Resistance%'
      OR e.data->>'attacker' ILIKE '%Radwan forces%'
    )
  ORDER BY e.message_date DESC
  LIMIT p_limit;
$$;

-- ── 4. get_new_events_since ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_new_events_since(
  p_since timestamptz,
  p_countries text[] DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  source_type text,
  source_id text,
  source_channel text,
  message_date timestamptz,
  latitude double precision,
  longitude double precision,
  enriched_at timestamptz,
  data jsonb,
  media_url text
)
LANGUAGE sql STABLE
AS $$
  SELECT
    e.id, e.source_type, e.source_id, e.source_channel,
    e.message_date, e.latitude, e.longitude, e.enriched_at, e.data,
    CASE
      WHEN e.source_type = 'telegram' THEN (
        SELECT tm.media_url
        FROM raw.telegram_messages tm
        WHERE tm.channel_username = split_part(e.source_id, ':', 1)
          AND tm.message_id = safe_bigint(split_part(e.source_id, ':', 2))
        LIMIT 1
      )
      WHEN e.source_type = 'x_post' THEN (
        SELECT xp.media->0->>'url'
        FROM raw.x_posts xp
        WHERE xp.tweet_id = safe_bigint(e.source_id)
        LIMIT 1
      )
      ELSE NULL
    END AS media_url
  FROM enriched.events e
  WHERE e.latitude IS NOT NULL
    AND e.longitude IS NOT NULL
    AND e.enriched_at > p_since
    AND (p_countries IS NULL OR e.data->>'location_country' = ANY(p_countries))
    AND NOT (
      e.data->>'attacker' ILIKE '%Hezbollah%'
      OR e.data->>'attacker' ILIKE '%Islamic Resistance%'
      OR e.data->>'attacker' ILIKE '%Radwan forces%'
    )
  ORDER BY e.enriched_at ASC;
$$;

-- ── 5. get_events_for_date_range ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_events_for_date_range(
  p_from date,
  p_to date,
  p_countries text[] DEFAULT NULL,
  p_types text[] DEFAULT NULL,
  p_severities text[] DEFAULT NULL,
  p_regions text[] DEFAULT NULL,
  p_limit int DEFAULT 500,
  p_offset int DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  source_type text,
  source_id text,
  source_channel text,
  message_date timestamptz,
  latitude double precision,
  longitude double precision,
  enriched_at timestamptz,
  data jsonb,
  media_url text
)
LANGUAGE sql STABLE
AS $$
  SELECT
    e.id, e.source_type, e.source_id, e.source_channel,
    e.message_date, e.latitude, e.longitude, e.enriched_at, e.data,
    CASE
      WHEN e.source_type = 'telegram' THEN (
        SELECT tm.media_url
        FROM raw.telegram_messages tm
        WHERE tm.channel_username = split_part(e.source_id, ':', 1)
          AND tm.message_id = safe_bigint(split_part(e.source_id, ':', 2))
        LIMIT 1
      )
      WHEN e.source_type = 'x_post' THEN (
        SELECT xp.media->0->>'url'
        FROM raw.x_posts xp
        WHERE xp.tweet_id = safe_bigint(e.source_id)
        LIMIT 1
      )
      ELSE NULL
    END AS media_url
  FROM enriched.events e
  WHERE e.latitude IS NOT NULL
    AND e.longitude IS NOT NULL
    AND e.message_date::date BETWEEN p_from AND p_to
    AND (p_countries IS NULL OR e.data->>'location_country' = ANY(p_countries))
    AND (p_types IS NULL OR e.data->>'event_type' = ANY(p_types))
    AND (p_severities IS NULL OR e.data->>'severity' = ANY(p_severities))
    AND (p_regions IS NULL OR e.data->>'location_region' = ANY(p_regions))
    AND NOT (
      e.data->>'attacker' ILIKE '%Hezbollah%'
      OR e.data->>'attacker' ILIKE '%Islamic Resistance%'
      OR e.data->>'attacker' ILIKE '%Radwan forces%'
    )
  ORDER BY e.message_date DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- ── 6. get_map_markers ─────────────────────────────────────────────────────

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
    e.message_date              AS date,
    e.source_type,
    e.data->>'location_name'    AS location_name,
    e.data->>'location_region'  AS location_region,
    e.enriched_at
  FROM enriched.events e
  WHERE e.latitude IS NOT NULL
    AND e.longitude IS NOT NULL
    AND e.message_date >= p_since
    AND (p_countries IS NULL OR e.data->>'location_country' = ANY(p_countries))
    AND NOT (
      e.data->>'attacker' ILIKE '%Hezbollah%'
      OR e.data->>'attacker' ILIKE '%Islamic Resistance%'
      OR e.data->>'attacker' ILIKE '%Radwan forces%'
    )
  ORDER BY e.message_date DESC
  LIMIT p_limit;
$$;

-- ── 7. get_new_markers_since ───────────────────────────────────────────────

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
    e.message_date              AS date,
    e.source_type,
    e.data->>'location_name'    AS location_name,
    e.data->>'location_region'  AS location_region,
    e.enriched_at
  FROM enriched.events e
  WHERE e.latitude IS NOT NULL
    AND e.longitude IS NOT NULL
    AND e.enriched_at > p_since
    AND (p_countries IS NULL OR e.data->>'location_country' = ANY(p_countries))
    AND NOT (
      e.data->>'attacker' ILIKE '%Hezbollah%'
      OR e.data->>'attacker' ILIKE '%Islamic Resistance%'
      OR e.data->>'attacker' ILIKE '%Radwan forces%'
    )
  ORDER BY e.enriched_at ASC;
$$;
