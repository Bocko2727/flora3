# ADR-001: AI разпознаване на сървъра и изчислен статус на проверка

**Status:** Accepted
**Date:** 2026-10-02
**Feature:** ai-statuses-redesign
**Author:** 10x-Team (Architect + Staff Engineer)

## Context
Собственикът иска автоматично Pl@ntNet предложение при качване и статуси, които никога не представят AI като потвърден факт. Ограничения: $0 (Pl@ntNet 500/ден некомерсиално, Vercel Hobby 4,5 MB тяло), ключът не може да е в браузъра, един редактор, зрители само четат.

## Decision
1. Pl@ntNet се вика от SvelteKit endpoint `/api/identify` (Vercel fra1). Браузърът праща JPEG копия ≤1024 px (1–5 в една заявка). Квота 100/ден/потребител в Postgres (`consume_identify_quota`, security definer).
2. Статусът е изчислено поле `id_status(plants)` в SQL (draft → ai_gbif → community), изведено от доказателства: протоколи `identifications`, GBIF колони, iNaturalist колони. Праг 0,30 само в SQL.
3. Самопотвърждението (`status`, `confirmed_at`) се маха. „Потвърдено“ = само iNaturalist Research Grade за същия вид.
4. Всички външни заявки минават през `externalFetch()`; `FLORA_OFFLINE_EXTERNAL=1` ги изключва (e2e).

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| Supabase Edge Function за Pl@ntNet | близо до базата | още едно място за deploy и secrets | няма печалба |
| Pl@ntNet директно от браузъра | най-просто | ключът е публичен | сигурност |
| Съхранен статус + тригери | бързо четене | разминаване с доказателствата, тригери на 2 таблици | 100 растения — изчислението е евтино |
| „Съгласувано“ = Pl@ntNet + GBIF | думата на собственика | GBIF не е втора идентификация — подвежда | ботаническа честност |

## Consequences
### Positive
- Статусът не може да лъже: изчислява се от данни при всяко четене.
- Ключът и лимитът са защитени на сървъра; записът никога не зависи от външни API.
### Negative
- Собственикът не може сам да маркира растение като потвърдено.
- Външна заявка за шрифтове (Google Fonts).
### Risks
- Договорите на Pl@ntNet/GBIF са по документация, не по жив тест → ръчен smoke test след ключа.
- Квотата се консумира и при upstream грешка.

## Dependencies
- Миграции `20261004090000_identification_status.sql`, `20261004100000_drop_self_confirm.sql` на хостнатия проект (ръчно, с одобрение).
- `PLANTNET_API_KEY` във Vercel.
