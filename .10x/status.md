# Статус — Флора 3
Клон: `feat/ai-statuses-redesign` (от `fix/post-launch-hardening`), само локално, не е push-нат.
Функция: ai-statuses-redesign

| Фаза | Състояние |
|---|---|
| 0 Brainstorming + spec | ✅ одобрено 2026-10-02 |
| 1 Strategy | ✅ |
| 2 Design (ADR-001) | ✅ |
| 3 Planning | ✅ 8 задачи |
| 4 Implementation | ✅ задачи 1–8 |
| 5 Verification | ✅ QA + security (`.10x/reviews/`) |
| 6 Delivery | 🟡 клоновете са push-нати; `identification_status` приложена в flora3 (2026-10-02, версия 20261002111038); `drop_self_confirm` чака merge+deploy; ключ и PR чакат |

Тестове (2026-10-02, проверено): pgTAP 76/76, unit 145/145, integration 49/49, e2e 13/13, svelte-check 0, build OK.

## Хостнат flora3 (проверено само с четене след миграцията)
97 растения, 97 с name_source='legacy_ai', 97 със статус draft, 0 identifications; anon няма достъп до identifications, authenticated няма UPDATE върху identifications и SELECT върху api_usage; RLS е включен и на двете таблици.
Advisors: api_usage RLS без политики (нарочно); consume_identify_quota/is_editor са security definer, достъпни за authenticated (нарочно); leaked password protection изключена.
`editors_no_delete` още НЕ е приложена (authenticated има DELETE върху editors) — отделно одобрение.
Версиите в supabase_migrations не съвпадат с имената на файловете в repo-то (както и при init/explicit_grants) — не ползвай `supabase db push` към хоста без да ги изравниш.
