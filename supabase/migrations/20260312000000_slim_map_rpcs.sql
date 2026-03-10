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
LANGUAGE sql STABLE
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
  FROM events e
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
LANGUAGE sql STABLE
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
  FROM events e
  WHERE e.latitude IS NOT NULL
    AND e.longitude IS NOT NULL
    AND e.enriched_at > p_since
    AND (p_countries IS NULL OR e.data->>'location_country' = ANY(p_countries))
  ORDER BY e.enriched_at ASC;
$$;

-- Full event detail for on-click (single row)
CREATE OR REPLACE FUNCTION get_event_detail(p_id uuid)
RETURNS SETOF events
LANGUAGE sql STABLE
AS $$
  SELECT * FROM events WHERE id = p_id LIMIT 1;
$$;

-- ── Priority 2: Enable Supabase Realtime ──────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE events;

-- ── Priority 4: Cursor-based feed pagination ──────────────────────────────

CREATE OR REPLACE FUNCTION get_feed_events(
  p_countries text[] DEFAULT NULL,
  p_types text[] DEFAULT NULL,
  p_severities text[] DEFAULT NULL,
  p_regions text[] DEFAULT NULL,
  p_source_types text[] DEFAULT NULL,
  p_cursor timestamptz DEFAULT NULL,
  p_limit int DEFAULT 30
)
RETURNS SETOF events
LANGUAGE sql STABLE
AS $$
  SELECT *
  FROM events
  WHERE latitude IS NOT NULL
    AND longitude IS NOT NULL
    AND (p_countries IS NULL OR data->>'location_country' = ANY(p_countries))
    AND (p_types IS NULL OR data->>'event_type' = ANY(p_types))
    AND (p_severities IS NULL OR data->>'severity' = ANY(p_severities))
    AND (p_regions IS NULL OR data->>'location_region' = ANY(p_regions))
    AND (p_source_types IS NULL OR source_type = ANY(p_source_types))
    AND (p_cursor IS NULL OR COALESCE(date_occurred, message_date) < p_cursor)
  ORDER BY COALESCE(date_occurred, message_date) DESC
  LIMIT p_limit;
$$;
