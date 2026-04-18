-- Public bucket for article images; path prefix {tenant_id}/{article_id}/{kind}/{uuid}.{ext}
INSERT INTO storage.buckets (id, name, public)
VALUES ('article-images', 'article-images', true)
ON CONFLICT (id) DO NOTHING;

-- Read is public (because the Ghost site will embed these URLs anonymously)
CREATE POLICY article_images_read ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'article-images');

-- Writes require the uploader to belong to the tenant in the first path segment
CREATE POLICY article_images_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'article-images'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.user_tenant_ids())
  );

CREATE POLICY article_images_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'article-images'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.user_tenant_ids())
  );

CREATE POLICY article_images_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'article-images'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.user_tenant_ids())
  );
