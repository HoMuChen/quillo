-- supabase/migrations/20260423000100_gsc_rpcs.sql

CREATE OR REPLACE FUNCTION public.gsc_striking_distance(p_project uuid, p_window_days int)
RETURNS TABLE(
  query text, normalized_page_url text,
  clicks bigint, impressions bigint, avg_position numeric,
  matching_article_id uuid
) AS $$
  WITH agg AS (
    SELECT
      gdp.query,
      gdp.normalized_page_url,
      SUM(gdp.clicks)::bigint AS clicks,
      SUM(gdp.impressions)::bigint AS impressions,
      (SUM(gdp.position * gdp.impressions) / NULLIF(SUM(gdp.impressions),0))::numeric AS avg_position
    FROM gsc_daily_query_page gdp
    WHERE gdp.project_id = p_project
      AND gdp.date >= CURRENT_DATE - (p_window_days || ' days')::interval
    GROUP BY gdp.query, gdp.normalized_page_url
  )
  SELECT
    agg.query, agg.normalized_page_url, agg.clicks, agg.impressions, agg.avg_position,
    (SELECT pt.article_id
     FROM publish_targets pt
     WHERE pt.normalized_url = agg.normalized_page_url
     ORDER BY pt.published_at DESC NULLS LAST
     LIMIT 1) AS matching_article_id
  FROM agg
  WHERE agg.avg_position BETWEEN 5 AND 20 AND agg.impressions >= 100
  ORDER BY agg.impressions DESC
  LIMIT 100;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.gsc_rising_queries(p_project uuid, p_window_days int)
RETURNS TABLE(
  query text,
  current_impressions bigint, previous_impressions bigint,
  growth bigint
) AS $$
  WITH cur AS (
    SELECT query, SUM(impressions)::bigint AS impressions
    FROM gsc_daily_query_page
    WHERE project_id = p_project
      AND date >= CURRENT_DATE - (p_window_days || ' days')::interval
    GROUP BY query
  ),
  prev AS (
    SELECT query, SUM(impressions)::bigint AS impressions
    FROM gsc_daily_query_page
    WHERE project_id = p_project
      AND date >= CURRENT_DATE - (2 * p_window_days || ' days')::interval
      AND date <  CURRENT_DATE - (p_window_days || ' days')::interval
    GROUP BY query
  )
  SELECT
    cur.query,
    cur.impressions AS current_impressions,
    COALESCE(prev.impressions, 0) AS previous_impressions,
    (cur.impressions - COALESCE(prev.impressions, 0)) AS growth
  FROM cur
  LEFT JOIN prev USING (query)
  WHERE cur.impressions >= 50
    AND (COALESCE(prev.impressions, 0) = 0 OR cur.impressions::numeric / NULLIF(prev.impressions, 0) >= 1.5)
  ORDER BY growth DESC
  LIMIT 100;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.gsc_decaying_pages(p_project uuid, p_window_days int)
RETURNS TABLE(
  normalized_page_url text,
  current_clicks bigint, previous_clicks bigint,
  decline_pct numeric,
  matching_article_id uuid
) AS $$
  WITH cur AS (
    SELECT normalized_page_url, SUM(clicks)::bigint AS clicks
    FROM gsc_daily_query_page
    WHERE project_id = p_project
      AND date >= CURRENT_DATE - (p_window_days || ' days')::interval
    GROUP BY normalized_page_url
  ),
  prev AS (
    SELECT normalized_page_url, SUM(clicks)::bigint AS clicks
    FROM gsc_daily_query_page
    WHERE project_id = p_project
      AND date >= CURRENT_DATE - (2 * p_window_days || ' days')::interval
      AND date <  CURRENT_DATE - (p_window_days || ' days')::interval
    GROUP BY normalized_page_url
  )
  SELECT
    cur.normalized_page_url,
    cur.clicks AS current_clicks,
    COALESCE(prev.clicks, 0) AS previous_clicks,
    1 - (cur.clicks::numeric / NULLIF(prev.clicks, 0)) AS decline_pct,
    (SELECT pt.article_id FROM publish_targets pt
     WHERE pt.normalized_url = cur.normalized_page_url
     ORDER BY pt.published_at DESC NULLS LAST
     LIMIT 1) AS matching_article_id
  FROM cur
  JOIN prev USING (normalized_page_url)
  WHERE prev.clicks >= 50
    AND cur.clicks::numeric / NULLIF(prev.clicks, 0) <= 0.7
  ORDER BY (prev.clicks - cur.clicks) DESC
  LIMIT 100;
$$ LANGUAGE sql STABLE;
