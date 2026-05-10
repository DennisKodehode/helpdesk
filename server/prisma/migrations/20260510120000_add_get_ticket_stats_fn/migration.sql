CREATE OR REPLACE FUNCTION get_ticket_stats(p_ai_user_id TEXT DEFAULT NULL)
RETURNS TABLE (
  total_tickets          BIGINT,
  open_tickets           BIGINT,
  total_resolved         BIGINT,
  ai_resolved            BIGINT,
  avg_resolution_seconds DOUBLE PRECISION
) LANGUAGE sql AS $$
  SELECT
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE status = 'open')::BIGINT,
    COUNT(*) FILTER (WHERE status IN ('resolved', 'closed'))::BIGINT,
    COUNT(*) FILTER (WHERE status IN ('resolved', 'closed') AND p_ai_user_id IS NOT NULL AND "assignedToId" = p_ai_user_id)::BIGINT,
    EXTRACT(EPOCH FROM AVG("resolvedAt" - "createdAt") FILTER (WHERE "resolvedAt" IS NOT NULL))
  FROM ticket;
$$;
