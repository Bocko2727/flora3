---
name: flora-baseline
description: Стартова проверка само с четене за Флора 3 — production SHA спрямо main, миграции в хоста срещу файловете, advisors, runtime грешки, backup, отворени клонове и PR-и. Ползвай в началото на сесия или при „статус“, „baseline“, „къде сме“, „какво е състоянието“. Не за поправки и не за записи.
---

# Флора 3 — Baseline

Целта е за няколко минути да се разбере реалното състояние, без да се пипа нищо. Документите (`.10x/status.md`, Project Knowledge) стареят бързо; проверката е по-надеждна от тях. Ако се разминават, кажи го с факта и източника.

## Правила
- **Само четене.** Никакви commit-и, миграции, настройки, Pl@ntNet заявки. През `execute_sql` — само `SELECT`; всичко друго е §5.2/§5.1.
- Независимите проверки пускай паралелно.
- Не чети `.env*`, не показвай ключове и URL с токени.
- Не повтаряй проверка без нова хипотеза.

## Проверки

| # | Какво | Как | Очаквано |
|---|---|---|---|
| 1 | `main` | `git fetch` + `git log -1 origin/main` или GitHub MCP `list_branches` | SHA и последният PR |
| 2 | Production | Vercel `list_deployments` (проект `prj_DcJab4MBgOqAOAbwoFNOP3vvOzPG`, target production) | READY, SHA = `main` |
| 3 | Runtime грешки | Vercel `get_runtime_errors` за 7 дни | 0 или изброени с път |
| 4 | Миграции | Supabase `list_migrations` (`lfmkjxcaokndltdylama`) срещу `supabase/migrations/` | Разлики се изброяват. **Известно:** `delete_plant` и `drop_self_confirm` са приложени, но липсват в историята — не е тревога. |
| 5 | Advisors | Supabase `get_advisors` (security + performance) | SECURITY DEFINER функции (`is_editor`, `consume_identify_quota`, `delete_plant`) и `api_usage` без политики са **очаквани** — не ги отчитай като проблем, освен ако има нов. |
| 6 | Данни | `select count(*)` от `plants` и `photos` (само четене) | Сравни с `.10x/status.md` |
| 7 | Backup | `gh run list --workflow backup.yml -L 3` | Последният run е зелен и не по-стар от 8 дни |
| 8 | CI | `gh run list --workflow ci.yml -L 3` | Зелен на `main` |
| 9 | Клонове и PR-и | `list_branches`, `list_pull_requests state=open` | Влети клонове: триенето е свободно по §5.3, но `git push --delete` е блокиран в settings → изброй ги за собственика |
| 10 | Квота | `select * from api_usage order by day desc limit 1` | Колко Pl@ntNet заявки са ползвани днес |

Ако инструмент липсва: `[BLOCKED: <инструмент>. Safe fallback: <какво друго провери>]` и продължи.

## Отчет

```text
Baseline status: READY / PARTIAL / BLOCKED
Current priority: P0 / P1 / P2 / P3 — [конкретна задача]
Confirmed facts: [до 5 точки, всяка с източник: SHA, run #, брой]
Open risks/blockers: [само конкретни]
Drift: [документ → казва X, проверката показва Y]
Safe next actions: [какво правиш сам]
Approval required now: yes/no — [за какво]
```

След отчета: ако няма Approval Gate, започни безопасната работа веднага. Ако е намерен drift в `.10x/status.md`, предложи поправката в следващия commit на текущия клон.
