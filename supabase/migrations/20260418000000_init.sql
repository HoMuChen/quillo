-- 20260418000000_init.sql
-- Quillo M1 initial schema + RLS + triggers

-- ============================================================
-- Tenants & membership
-- ============================================================

CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tenant_members (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role      text NOT NULL CHECK (role IN ('owner','editor','viewer')) DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

CREATE OR REPLACE FUNCTION public.user_tenant_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
$$;

-- ============================================================
-- Projects
-- ============================================================

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  domain text,
  audience text,
  theme text,
  content_locale text NOT NULL DEFAULT 'zh-TW',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON projects(tenant_id);

CREATE TABLE brand_materials (
  project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL,
  author_background text,
  reader_persona    text,
  tone              text,
  preferred_terms   text[] NOT NULL DEFAULT '{}',
  forbidden_terms   text[] NOT NULL DEFAULT '{}',
  ee_at_cases       text,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Pillars & articles
-- ============================================================

CREATE TABLE pillars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL,
  title text NOT NULL,
  description text,
  target_keyword text,
  search_intent text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON pillars(project_id, position);

CREATE TABLE articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  pillar_id  uuid REFERENCES pillars(id) ON DELETE SET NULL,
  tenant_id  uuid NOT NULL,

  title text NOT NULL,
  target_keyword text,
  lsi_keywords text[] NOT NULL DEFAULT '{}',
  search_intent text,
  word_count_target int,
  role text,
  position int NOT NULL DEFAULT 0,

  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned','outlining','outline_ready','interviewing','drafting','draft_ready','editing')),

  body_tiptap jsonb,
  body_markdown text,

  slug text,
  meta_title text,
  meta_description text,
  excerpt text,
  canonical_url text,
  focus_keyword text,
  tags text[] NOT NULL DEFAULT '{}',
  feature_image_url text,

  platform_meta jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON articles(project_id);
CREATE INDEX ON articles(pillar_id);

CREATE TABLE article_outlines (
  article_id uuid PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL,
  sections   jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE interview_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL,
  section_id text NOT NULL,
  question text NOT NULL,
  answer text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','answered','skipped')),
  position int NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON interview_questions(article_id);

CREATE TABLE article_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL,
  storage_path text NOT NULL,
  url text NOT NULL,
  alt text,
  caption text,
  kind text NOT NULL CHECK (kind IN ('feature','inline')),
  remote_refs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON article_images(article_id);

-- ============================================================
-- URL normalization
-- ============================================================

CREATE OR REPLACE FUNCTION public.normalize_url(u text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE r text;
BEGIN
  IF u IS NULL OR u = '' THEN RETURN NULL; END IF;
  r := lower(u);
  r := regexp_replace(r, '[#?].*$', '');
  r := regexp_replace(r, '/+$', '');
  RETURN r;
END $$;

-- ============================================================
-- Site connections & publish targets
-- ============================================================

CREATE TABLE site_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ghost','wordpress','shopify')),
  name text NOT NULL,
  config_encrypted bytea NOT NULL,
  last_tested_at timestamptz,
  last_test_ok boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON site_connections(project_id);

CREATE TABLE publish_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES site_connections(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL,
  remote_post_id text,
  remote_url text,
  normalized_url text GENERATED ALWAYS AS (public.normalize_url(remote_url)) STORED,
  url_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  remote_status text,
  scheduled_for timestamptz,
  published_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (article_id, connection_id)
);
CREATE INDEX ON publish_targets(article_id);
CREATE INDEX ON publish_targets(normalized_url);

CREATE TABLE publish_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publish_target_id uuid NOT NULL REFERENCES publish_targets(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('publish','republish','unpublish','schedule','test_connection')),
  status text NOT NULL CHECK (status IN ('success','failure')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON publish_logs(publish_target_id, created_at DESC);

-- ============================================================
-- Triggers — new user → tenant + membership
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_tid uuid;
  t_name text;
BEGIN
  t_name := coalesce(NEW.raw_user_meta_data->>'name', NEW.email, 'User') || '''s workspace';
  INSERT INTO public.tenants(name) VALUES (t_name) RETURNING id INTO new_tid;
  INSERT INTO public.tenant_members(tenant_id, user_id, role)
    VALUES (new_tid, NEW.id, 'owner');
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Triggers — auto-fill tenant_id from parents
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_tenant_from_project()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM projects WHERE id = NEW.project_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER t_brand_materials_tenant BEFORE INSERT ON brand_materials
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_project();
CREATE TRIGGER t_pillars_tenant         BEFORE INSERT ON pillars
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_project();
CREATE TRIGGER t_articles_tenant        BEFORE INSERT ON articles
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_project();
CREATE TRIGGER t_site_conn_tenant       BEFORE INSERT ON site_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_project();

CREATE OR REPLACE FUNCTION public.set_tenant_from_article()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM articles WHERE id = NEW.article_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER t_outlines_tenant    BEFORE INSERT ON article_outlines
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_article();
CREATE TRIGGER t_questions_tenant   BEFORE INSERT ON interview_questions
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_article();
CREATE TRIGGER t_images_tenant      BEFORE INSERT ON article_images
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_article();

CREATE OR REPLACE FUNCTION public.set_tenant_from_publish_target()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM publish_targets WHERE id = NEW.publish_target_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER t_publish_logs_tenant BEFORE INSERT ON publish_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_publish_target();

CREATE OR REPLACE FUNCTION public.set_publish_target_tenant()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM articles WHERE id = NEW.article_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER t_publish_targets_tenant BEFORE INSERT ON publish_targets
  FOR EACH ROW EXECUTE FUNCTION public.set_publish_target_tenant();

-- ============================================================
-- updated_at triggers
-- ============================================================

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

CREATE TRIGGER t_touch_projects          BEFORE UPDATE ON projects          FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_touch_brand             BEFORE UPDATE ON brand_materials    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_touch_pillars           BEFORE UPDATE ON pillars            FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_touch_articles          BEFORE UPDATE ON articles           FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_touch_outlines          BEFORE UPDATE ON article_outlines   FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_touch_questions         BEFORE UPDATE ON interview_questions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_touch_site_connections  BEFORE UPDATE ON site_connections   FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_touch_publish_targets   BEFORE UPDATE ON publish_targets    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE tenants              ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects             ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_materials      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pillars              ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_outlines     ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_questions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_images       ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_connections     ENABLE ROW LEVEL SECURITY;
ALTER TABLE publish_targets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE publish_logs         ENABLE ROW LEVEL SECURITY;

CREATE POLICY own_tenants ON tenants FOR ALL TO authenticated
  USING (id IN (SELECT public.user_tenant_ids()))
  WITH CHECK (id IN (SELECT public.user_tenant_ids()));

CREATE POLICY own_memberships ON tenant_members FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'projects','brand_materials','pillars','articles',
      'article_outlines','interview_questions','article_images',
      'site_connections','publish_targets','publish_logs'
    ])
  LOOP
    EXECUTE format($q$
      CREATE POLICY tenant_isolation ON %I FOR ALL TO authenticated
      USING (tenant_id IN (SELECT public.user_tenant_ids()))
      WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()))
    $q$, t);
  END LOOP;
END $$;
