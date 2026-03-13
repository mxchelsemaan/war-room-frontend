-- Extend get_feed_events search to cover target, topics (JSONB), and named_entities (NER).
-- Indexes already exist: idx_ne_source, idx_named_entities_normalized_trgm, idx_ne_value.

CREATE OR REPLACE FUNCTION public.get_feed_events(p_countries text[] DEFAULT NULL::text[], p_limit integer DEFAULT 30, p_types text[] DEFAULT NULL::text[], p_severities text[] DEFAULT NULL::text[], p_regions text[] DEFAULT NULL::text[], p_source_types text[] DEFAULT NULL::text[], p_cursor timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_weapon_systems text[] DEFAULT NULL::text[], p_handles text[] DEFAULT NULL::text[], p_query text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, source_type text, source_id text, source_channel text, message_date timestamp with time zone, latitude double precision, longitude double precision, enriched_at timestamp with time zone, data jsonb, media_url text, media_type text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
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
  WHERE (p_countries IS NULL OR e.data->>'location_country' = ANY(p_countries))
    AND (p_types IS NULL OR e.data->>'event_type' = ANY(p_types))
    AND (p_severities IS NULL OR e.data->>'severity' = ANY(p_severities))
    AND (p_regions IS NULL OR e.data->>'location_region' = ANY(p_regions))
    AND (p_source_types IS NULL OR e.source_type = ANY(p_source_types))
    AND (p_date_from IS NULL OR e.message_date::date >= p_date_from)
    AND (p_date_to IS NULL OR e.message_date::date <= p_date_to)
    AND (p_weapon_systems IS NULL OR e.data->>'weapon_system' = ANY(p_weapon_systems))
    AND (p_handles IS NULL OR e.source_channel = ANY(p_handles))
    AND (p_cursor IS NULL OR e.message_date < p_cursor)
    AND (p_query IS NULL OR (
      e.data->>'summary' ILIKE '%' || p_query || '%'
      OR e.data->>'location_name' ILIKE '%' || p_query || '%'
      OR e.data->>'attacker' ILIKE '%' || p_query || '%'
      OR e.data->>'affected_party' ILIKE '%' || p_query || '%'
      OR e.data->>'weapon_system' ILIKE '%' || p_query || '%'
      OR e.source_channel ILIKE '%' || p_query || '%'
      OR e.data->>'additional_context' ILIKE '%' || p_query || '%'
      OR e.data->>'source_claim' ILIKE '%' || p_query || '%'
      OR e.data->>'target' ILIKE '%' || p_query || '%'
      OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(e.data->'topics', '[]'::jsonb)) t WHERE t ILIKE '%' || p_query || '%')
      OR EXISTS (SELECT 1 FROM enriched.named_entities ne WHERE ne.source_type = e.source_type AND ne.source_id = e.source_id AND (ne.entity_value ILIKE '%' || p_query || '%' OR ne.entity_normalized ILIKE '%' || p_query || '%'))
    ))
    AND NOT (
      e.data->>'attacker' ILIKE '%Hezbollah%'
      OR e.data->>'attacker' ILIKE '%Islamic Resistance%'
      OR e.data->>'attacker' ILIKE '%Radwan forces%'
    )
  ORDER BY e.message_date DESC NULLS LAST
  LIMIT p_limit;
$function$;
