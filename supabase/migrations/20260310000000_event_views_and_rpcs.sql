-- ============================================================================
-- Materialized View: events_daily_summary
-- Pre-aggregates events by day + key dimensions for fast timeline/facet queries
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS events_daily_summary AS
SELECT
  (COALESCE(date_occurred, message_date))::date AS day,
  data->>'event_type'        AS event_type,
  data->>'severity'          AS severity,
  data->>'location_region'   AS region,
  data->>'location_country'  AS country,
  source_type,
  COUNT(*)                                                    AS event_count,
  SUM(COALESCE((data->>'casualties_killed')::int, 0))        AS total_killed,
  SUM(COALESCE((data->>'casualties_injured')::int, 0))       AS total_injured,
  AVG(latitude)                                               AS centroid_lat,
  AVG(longitude)                                              AS centroid_lng
FROM events
WHERE latitude IS NOT NULL AND longitude IS NOT NULL
GROUP BY day, event_type, severity, region, country, source_type;

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_summary_pk
  ON events_daily_summary (day, event_type, severity, region, country, source_type);

-- ============================================================================
-- Indexes on events table
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_events_date_country
  ON events ((COALESCE(date_occurred, message_date)::date) DESC, ((data->>'location_country')))
  WHERE latitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_enriched_at
  ON events (enriched_at DESC);

-- ============================================================================
-- pg_cron: refresh materialized view every 5 minutes
-- ============================================================================

SELECT cron.schedule(
  'refresh-daily-summary',
  '*/5 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY events_daily_summary'
);

-- ============================================================================
-- RPC: get_recent_events
-- Returns events from the last N hours, filtered by countries
-- ============================================================================

CREATE OR REPLACE FUNCTION get_recent_events(
  p_since timestamptz DEFAULT NOW() - INTERVAL '12 hours',
  p_countries text[] DEFAULT NULL,
  p_limit int DEFAULT 2000
)
RETURNS SETOF events
LANGUAGE sql STABLE
AS $$
  SELECT *
  FROM events
  WHERE latitude IS NOT NULL
    AND longitude IS NOT NULL
    AND COALESCE(date_occurred, message_date) >= p_since
    AND (p_countries IS NULL OR data->>'location_country' = ANY(p_countries))
  ORDER BY COALESCE(date_occurred, message_date) DESC
  LIMIT p_limit;
$$;

-- ============================================================================
-- RPC: get_new_events_since
-- Incremental poll — only events enriched after a given timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION get_new_events_since(
  p_since timestamptz,
  p_countries text[] DEFAULT NULL
)
RETURNS SETOF events
LANGUAGE sql STABLE
AS $$
  SELECT *
  FROM events
  WHERE latitude IS NOT NULL
    AND longitude IS NOT NULL
    AND enriched_at > p_since
    AND (p_countries IS NULL OR data->>'location_country' = ANY(p_countries))
  ORDER BY enriched_at ASC;
$$;

-- ============================================================================
-- RPC: get_events_for_date_range
-- Paginated fetch with server-side filters
-- ============================================================================

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
RETURNS SETOF events
LANGUAGE sql STABLE
AS $$
  SELECT *
  FROM events
  WHERE latitude IS NOT NULL
    AND longitude IS NOT NULL
    AND (COALESCE(date_occurred, message_date))::date BETWEEN p_from AND p_to
    AND (p_countries IS NULL OR data->>'location_country' = ANY(p_countries))
    AND (p_types IS NULL OR data->>'event_type' = ANY(p_types))
    AND (p_severities IS NULL OR data->>'severity' = ANY(p_severities))
    AND (p_regions IS NULL OR data->>'location_region' = ANY(p_regions))
  ORDER BY COALESCE(date_occurred, message_date) DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- ============================================================================
-- RPC: get_timeline_dates
-- Dates + counts for timeline scrubber (from materialized view)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_timeline_dates(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_countries text[] DEFAULT NULL
)
RETURNS TABLE(day date, count bigint)
LANGUAGE sql STABLE
AS $$
  SELECT
    s.day,
    SUM(s.event_count)::bigint AS count
  FROM events_daily_summary s
  WHERE (p_from IS NULL OR s.day >= p_from)
    AND (p_to IS NULL OR s.day <= p_to)
    AND (p_countries IS NULL OR s.country = ANY(p_countries))
  GROUP BY s.day
  ORDER BY s.day;
$$;

-- ============================================================================
-- RPC: get_filter_facets
-- Aggregated counts per type/severity/region (from materialized view)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_filter_facets(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_countries text[] DEFAULT NULL
)
RETURNS json
LANGUAGE sql STABLE
AS $$
  SELECT json_build_object(
    'by_type', (
      SELECT json_object_agg(event_type, cnt)
      FROM (
        SELECT event_type, SUM(event_count)::bigint AS cnt
        FROM events_daily_summary
        WHERE (p_from IS NULL OR day >= p_from)
          AND (p_to IS NULL OR day <= p_to)
          AND (p_countries IS NULL OR country = ANY(p_countries))
        GROUP BY event_type
        ORDER BY cnt DESC
      ) t
    ),
    'by_severity', (
      SELECT json_object_agg(severity, cnt)
      FROM (
        SELECT severity, SUM(event_count)::bigint AS cnt
        FROM events_daily_summary
        WHERE (p_from IS NULL OR day >= p_from)
          AND (p_to IS NULL OR day <= p_to)
          AND (p_countries IS NULL OR country = ANY(p_countries))
        GROUP BY severity
        ORDER BY cnt DESC
      ) t
    ),
    'by_region', (
      SELECT json_object_agg(region, cnt)
      FROM (
        SELECT region, SUM(event_count)::bigint AS cnt
        FROM events_daily_summary
        WHERE (p_from IS NULL OR day >= p_from)
          AND (p_to IS NULL OR day <= p_to)
          AND (p_countries IS NULL OR country = ANY(p_countries))
          AND region IS NOT NULL
        GROUP BY region
        ORDER BY cnt DESC
      ) t
    ),
    'by_source_type', (
      SELECT json_object_agg(source_type, cnt)
      FROM (
        SELECT source_type, SUM(event_count)::bigint AS cnt
        FROM events_daily_summary
        WHERE (p_from IS NULL OR day >= p_from)
          AND (p_to IS NULL OR day <= p_to)
          AND (p_countries IS NULL OR country = ANY(p_countries))
          AND source_type IS NOT NULL
        GROUP BY source_type
        ORDER BY cnt DESC
      ) t
    ),
    'total', (
      SELECT SUM(event_count)::bigint
      FROM events_daily_summary
      WHERE (p_from IS NULL OR day >= p_from)
        AND (p_to IS NULL OR day <= p_to)
        AND (p_countries IS NULL OR country = ANY(p_countries))
    )
  );
$$;
