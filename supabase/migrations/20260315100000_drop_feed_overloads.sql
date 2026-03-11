-- ============================================================================
-- Drop old get_feed_events overloads that cause PostgREST PGRST203 ambiguity.
-- Only the latest signature (with p_handles) should remain.
-- ============================================================================

-- Original 7-param version (no date range, no weapon systems, no handles)
DROP FUNCTION IF EXISTS get_feed_events(text[], int, text[], text[], text[], text[], timestamptz);

-- 10-param version (added date range + weapon systems, no handles)
DROP FUNCTION IF EXISTS get_feed_events(text[], int, text[], text[], text[], text[], timestamptz, date, date, text[]);
