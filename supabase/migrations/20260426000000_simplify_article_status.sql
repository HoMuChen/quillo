-- Collapse articles.status from 7 editorial micro-states to 4:
--   planning  : prep work, no content yet
--   drafting  : AI generating draft (transient)
--   editing   : has content, user editing
--   published : live on at least one publish_target

ALTER TABLE public.articles
  DROP CONSTRAINT IF EXISTS articles_status_check;

UPDATE public.articles
SET status = CASE status
  WHEN 'planned'       THEN 'planning'
  WHEN 'outlining'     THEN 'planning'
  WHEN 'outline_ready' THEN 'planning'
  WHEN 'interviewing'  THEN 'planning'
  WHEN 'draft_ready'   THEN 'editing'
  ELSE status
END;

UPDATE public.articles a
SET status = 'published'
WHERE EXISTS (
  SELECT 1 FROM public.publish_targets t
  WHERE t.article_id = a.id AND t.remote_status = 'published'
);

ALTER TABLE public.articles
  ALTER COLUMN status SET DEFAULT 'planning',
  ADD CONSTRAINT articles_status_check
    CHECK (status IN ('planning','drafting','editing','published'));
