-- Atomic save of a Pillar Cluster plan: creates pillars (in order) with their
-- child articles (in order) inside a single transaction. tenant_id is filled
-- automatically by the existing trigger set_tenant_from_project.

CREATE OR REPLACE FUNCTION public.create_pillar_plan(
  p_project_id uuid,
  p_plan jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  p jsonb;
  a jsonb;
  pid uuid;
  ppos int := 0;
  apos int := 0;
  created_pillars jsonb := '[]'::jsonb;
  created_articles jsonb := '[]'::jsonb;
BEGIN
  -- Require user to own the project (RLS also enforces this, but be explicit)
  IF NOT EXISTS (
    SELECT 1 FROM projects WHERE id = p_project_id
  ) THEN
    RAISE EXCEPTION 'project not found or not accessible';
  END IF;

  FOR p IN SELECT * FROM jsonb_array_elements(p_plan->'pillars')
  LOOP
    INSERT INTO pillars (
      project_id, title, description, target_keyword, search_intent, position
    ) VALUES (
      p_project_id,
      p->>'title',
      p->>'description',
      p->>'target_keyword',
      p->>'search_intent',
      ppos
    )
    RETURNING id INTO pid;

    created_pillars := created_pillars || jsonb_build_object('id', pid, 'position', ppos);

    apos := 0;
    FOR a IN SELECT * FROM jsonb_array_elements(p->'articles')
    LOOP
      INSERT INTO articles (
        project_id, pillar_id, title, target_keyword, lsi_keywords,
        search_intent, word_count_target, role, position
      ) VALUES (
        p_project_id,
        pid,
        a->>'title',
        a->>'target_keyword',
        ARRAY(SELECT jsonb_array_elements_text(a->'lsi_keywords')),
        a->>'search_intent',
        (a->>'word_count_target')::int,
        a->>'role',
        apos
      );
      apos := apos + 1;
    END LOOP;

    ppos := ppos + 1;
  END LOOP;

  RETURN jsonb_build_object('pillars', created_pillars);
END;
$$;

-- The function is SECURITY INVOKER so RLS on pillars / articles is enforced.
-- Grant execute to authenticated users.
GRANT EXECUTE ON FUNCTION public.create_pillar_plan(uuid, jsonb) TO authenticated;
