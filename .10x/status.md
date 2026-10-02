# Статус — Флора 3
Клон: `feat/legacy-review` (от `main` dbea6b8). Функция: преглед на старите растения.

## Production (проверено само с четене, 2026-10-02)
- `main` = dbea6b8 (PR #3); Vercel production READY; `PLANTNET_API_KEY` в Production.
- Хостнат flora3: приложени init, explicit_grants, identification_status, editors_no_delete, drop_self_confirm (през SQL Editor от собственика).
- 98 растения (97 стари + 1 от телефона с AI избор), 1 identification, Pl@ntNet работи на живо.
- Backup: `backup.yml` + secret `SUPABASE_DB_URL`; ръчен run успешен (artifact ~55 KB).
- Решения на собственика: снимката на Cistus и махането на import-legacy.yml — отказани; A7 — пропуснато.
- Не ползвай `supabase db push` към хоста (версиите не съвпадат с имената на файловете).

## feat/legacy-review
Spec: `docs/superpowers/specs/2026-10-02-flora3-legacy-review-design.md`; план: `docs/superpowers/plans/2026-10-02-flora3-legacy-review.md`.
| Задача | Commit |
|---|---|
| T1 миграция legacy_review + pgTAP | bfe8d3e |
| T2 семейство от GBIF + Wikidata/Wikipedia | 44ae4a9, 2df111c |
| T3 classify + решения | b2e7fa5 |
| T4 endpoints + actions | c1bcd61 |
| T5 екран „За преглед“ | 6d633af |

Тестове (пълен набор, 2026-10-02): pgTAP 88/88, unit 165/165, integration 59/59, e2e 18/18, svelte-check 0, build OK. Live smoke: GBIF + Wikidata/bg.wikipedia отговарят (Mirabilis jalapa → „нощна красавица“ + статия).

## Пускане (одобрено от собственика 2026-10-02)
1. Миграция `legacy_review` в хоста — преди merge.
2. PR → merge от собственика → Vercel production.
3. Пакетно разпознаване на 96 растения — собственикът натиска „Подготви прегледа“.
