# Security review — ai-statuses-redesign (2026-10-02)

**Verdict:** без критични и важни находки.

| Област | Проверено | Резултат |
|---|---|---|
| Ключ на Pl@ntNet | `$env/dynamic/private`; само в URL към Pl@ntNet; при грешка се логва само `error.name`; тест проверява, че ключът не е в отговор/лог | ✅ |
| `/api/identify` | `requireEditor` преди парсване; 1–5 файла, jpeg/png, ≤ 2 MiB; квота в БД преди външната заявка; CSRF — проверката на origin в SvelteKit е включена по подразбиране | ✅ |
| Квота | `consume_identify_quota` security definer, `search_path=''`, атомарен upsert с `where count < 100`; `api_usage` без права за anon/authenticated | ✅ |
| `identifications` | RLS: четене за влезли; запис само от редактор за собствено растение; без UPDATE/DELETE (неизменим протокол); `revoke all` преди grants | ✅ |
| Действия на растение | всяко с `requireEditor` + RLS; 0 засегнати реда → грешка, не тиха | ✅ |
| Външни линкове | href към GBIF/iNaturalist се строи само от числови id; няма `{@html}` | ✅ |
| Вход от потребителя | iNaturalist regex с котви; GBIF името е `encodeURIComponent`; скритото поле `identification` минава през zod | ✅ |

## Приети рискове
1. **Редакторът може да запише доказателствата сам** (column grants за `gbif_*`, `inat_*`, `name_source`), например да зададе `inat_quality_grade='research'` през API. Редакторът е един (собственикът). Заплахата е случайна грешка, не злонамерен потребител. Ако се появи втори редактор, тези колони трябва да се пишат само през security-definer RPC.
2. Квотата се брои и когато Pl@ntNet върне грешка (по-безопасно за безплатния лимит).
3. Google Fonts получава IP адреса на посетителя.
4. Vercel Authentication все още пуска само влезли във Vercel. Това е отделна тема, извън тази функция.
