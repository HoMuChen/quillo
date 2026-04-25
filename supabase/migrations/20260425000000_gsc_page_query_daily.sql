-- Accurate page-level daily metrics (dimensions: date + page, no query).
-- Use for article performance tiles and decaying-pages opportunity.
CREATE TABLE gsc_page_daily (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  date date NOT NULL,
  page_url text NOT NULL,
  normalized_page_url text GENERATED ALWAYS AS (public.normalize_url(page_url)) STORED,
  clicks integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  ctr numeric NOT NULL DEFAULT 0,
  position numeric NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, date, normalized_page_url)
);
CREATE INDEX ON gsc_page_daily (project_id, date);
CREATE INDEX ON gsc_page_daily (project_id, normalized_page_url);

ALTER TABLE gsc_page_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON gsc_page_daily FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE TRIGGER t_gsc_page_daily_tenant BEFORE INSERT ON gsc_page_daily
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_project();

-- Accurate query-level daily metrics (dimensions: date + query, no page).
-- Use for striking-distance and rising-queries opportunity, and planning wizard injection.
CREATE TABLE gsc_query_daily (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  date date NOT NULL,
  query text NOT NULL,
  clicks integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  ctr numeric NOT NULL DEFAULT 0,
  position numeric NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, date, query)
);
CREATE INDEX ON gsc_query_daily (project_id, date);
CREATE INDEX ON gsc_query_daily (project_id, query);

ALTER TABLE gsc_query_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON gsc_query_daily FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE TRIGGER t_gsc_query_daily_tenant BEFORE INSERT ON gsc_query_daily
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_project();
