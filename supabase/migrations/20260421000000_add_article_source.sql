ALTER TABLE articles
  ADD COLUMN source text NOT NULL DEFAULT 'quillo'
    CHECK (source IN ('quillo', 'ghost'));

CREATE INDEX ON articles(project_id, source) WHERE pillar_id IS NULL;
