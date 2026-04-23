-- GSC per-project OAuth credentials + property binding.
CREATE TABLE gsc_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  tenant_id uuid NOT NULL,
  google_user_email text NOT NULL,
  property_url text NOT NULL,
  refresh_token_encrypted bytea NOT NULL,
  access_token_encrypted bytea,
  access_token_expires_at timestamptz,
  last_synced_at timestamptz,
  last_sync_status text CHECK (last_sync_status IN ('ok','partial','error')),
  last_sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON gsc_connections(tenant_id);

ALTER TABLE gsc_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON gsc_connections FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE TRIGGER t_gsc_connections_tenant BEFORE INSERT ON gsc_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_project();
CREATE TRIGGER t_touch_gsc_connections BEFORE UPDATE ON gsc_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Raw per-day/query/page metrics. No retention; user cleans up manually if it grows.
CREATE TABLE gsc_daily_query_page (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  date date NOT NULL,
  query text NOT NULL,
  page_url text NOT NULL,
  normalized_page_url text GENERATED ALWAYS AS (public.normalize_url(page_url)) STORED,
  clicks integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  ctr numeric NOT NULL DEFAULT 0,
  position numeric NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, date, query, normalized_page_url)
);
CREATE INDEX ON gsc_daily_query_page (project_id, normalized_page_url);
CREATE INDEX ON gsc_daily_query_page (project_id, query);

ALTER TABLE gsc_daily_query_page ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON gsc_daily_query_page FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE TRIGGER t_gsc_daily_query_page_tenant BEFORE INSERT ON gsc_daily_query_page
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_project();

-- Sync audit log.
CREATE TABLE gsc_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  rows_inserted integer NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('ok','partial','error')),
  error text
);
CREATE INDEX ON gsc_sync_runs(project_id, started_at DESC);

ALTER TABLE gsc_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON gsc_sync_runs FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE TRIGGER t_gsc_sync_runs_tenant BEFORE INSERT ON gsc_sync_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_project();
