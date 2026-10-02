-- Read-only export of the legacy Digital Flora catalog. Paste into the old project's SQL editor,
-- copy the single JSON value from the `plants` column into legacy-export.json.
select coalesce(
  jsonb_agg(
    jsonb_build_object(
      'id', id,
      'common_name', common_name,
      'latin_name', latin_name,
      'family', family,
      'photos', photos,
      'confidence', confidence,
      'recognition', recognition,
      'habitat', habitat,
      'lookalikes', lookalikes,
      'benefits', benefits,
      'risks', risks,
      'uses', uses,
      'fun_fact', fun_fact,
      'source_file', source_file
    )
    order by created_at, id
  ),
  '[]'::jsonb
) as plants
from public.plants;
