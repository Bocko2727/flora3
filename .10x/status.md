# Статус — Флора 3
Клон: `fix/ai-polish` (от `main` 6a72cd6). Функция: доработки след ai-statuses-redesign.

## Production
- `main` = 6a72cd6 (PR #2 merge-нат); Vercel production READY; `PLANTNET_API_KEY` е в Production.
- Хостнат flora3 (`lfmkjxcaokndltdylama`), проверено само с четене:
  - приложени: init, explicit_grants, identification_status, editors_no_delete (2026-10-02, authenticated вече няма DELETE върху editors);
  - **НЕ е приложена: `drop_self_confirm`** — `apply_migration` е отказан два пъти при потвърждението; пуска се от собственика в SQL Editor (README → „Миграции на хостнатия проект“, т. 3). 0 растения с status='confirmed'; кодът не ползва колоните, затова не бърза.
  - 97 растения, 117 снимки. *Cistus* sp. остава без снимка — собственикът се отказа от нея (2026-10-02).
- Advisors (очаквано): api_usage без политики; consume_identify_quota/is_editor security definer; leaked password protection изключена (собственикът я пропуска).
- Версиите в supabase_migrations не съвпадат с имената на файловете — не ползвай `supabase db push` към хоста.

## fix/ai-polish (план: `docs/superpowers/plans/2026-10-02-flora3-post-merge.md`)
| Задача | Commit |
|---|---|
| B1 AI предложенията следват реално изпратените снимки | c969a3c |
| B2 заключен „Разпознай по снимките“; Evidence busy във finally | 464a9e1 |
| B3 четим печат за статуса (≥ 11 px) | fa41027 |

Тестове (2026-10-02, пълен набор): pgTAP 76/76, unit 147/147, integration 49/49, e2e 16/16, svelte-check 0, build OK.

## Решения на собственика (2026-10-02)
- A4 (снимката на Cistus) и A5 (махане на import-legacy.yml и NEW_SUPABASE_SECRET_KEY): отказани.
- A7 (Sensitive ключ във Vercel, leaked password protection): пропуснати.
- A6 (backup secret): прави го собственикът.
