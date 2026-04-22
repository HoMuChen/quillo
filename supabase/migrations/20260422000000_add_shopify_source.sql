ALTER TABLE articles
  DROP CONSTRAINT articles_source_check,
  ADD CONSTRAINT articles_source_check
    CHECK (source IN ('quillo', 'ghost', 'shopify'));
