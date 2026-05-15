DROP FUNCTION IF EXISTS get_ticket_stats(TEXT);

CREATE FUNCTION get_ticket_stats(p_ai_user_id TEXT DEFAULT NULL)
RETURNS TABLE (
  total_tickets          BIGINT,
  open_tickets           BIGINT,
  resolved_count         BIGINT,
  closed_tickets         BIGINT,
  total_completed        BIGINT,
  ai_resolved            BIGINT,
  percent_resolved_by_ai NUMERIC,
  avg_resolution_minutes NUMERIC
) LANGUAGE sql AS $$
  WITH counts AS (
    SELECT
      COUNT(*)::BIGINT AS total_tickets,
      COUNT(*) FILTER (WHERE status = 'open')::BIGINT AS open_tickets,
      COUNT(*) FILTER (WHERE status = 'resolved')::BIGINT AS resolved_count,
      COUNT(*) FILTER (WHERE status = 'closed')::BIGINT AS closed_tickets,
      COUNT(*) FILTER (WHERE status IN ('resolved', 'closed'))::BIGINT AS total_completed,
      COUNT(*) FILTER (WHERE status IN ('resolved', 'closed') AND p_ai_user_id IS NOT NULL AND "assignedToId" = p_ai_user_id)::BIGINT AS ai_resolved,
      ROUND(
        (EXTRACT(EPOCH FROM AVG("resolvedAt" - "createdAt") FILTER (WHERE "resolvedAt" IS NOT NULL)) / 60)::NUMERIC,
        1
      ) AS avg_resolution_minutes
    FROM ticket
  )
  SELECT
    total_tickets,
    open_tickets,
    resolved_count,
    closed_tickets,
    total_completed,
    ai_resolved,
    ROUND((ai_resolved::NUMERIC / NULLIF(total_completed, 0)) * 1000) / 10 AS percent_resolved_by_ai,
    avg_resolution_minutes
  FROM counts;
$$;
