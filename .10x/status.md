# Статус — Флора 3
Обновено: 2026-10-06. Клон: `chore/claude-automation` (от `main` 6146094).

## Production (пренесено от предишния статус; в тази сесия не е проверявано наново)
- `main` = 6146094 (PR #6 `chore/github-tooling` е влят). Deploy-ът във Vercel за този commit не е проверяван в тази сесия.
- Хостнат flora3 (Supabase): в `supabase_migrations` са 5: init, explicit_grants, identification_status, editors_no_delete, legacy_review. В repo-то има 7 файла: `delete_plant` (функцията е налична в хоста, проверено 06.10) и `drop_self_confirm` (приложена през SQL Editor) липсват в историята.
- 98 растения (97 стари + 1 от телефона), 118 снимки.
- Преглед на старите растения (`/review`): решени 94 от 96; остават двете гъби (*Agaricales* sp., *Russula* sp.).
- Backup: `backup.yml` е зелен — ръчен run #1 (2 окт.) и първи планиран run #2 (5 окт.) (по екранна снимка от собственика, 06.10). `Legacy import (one-off)`: run #1 зелен, run #2 червен; еднократен, отложен по решение на собственика.
- Не ползвай `supabase db push` към хоста (версиите не съвпадат с имената на файловете).

## Работен процес (Project Instructions §5)
- Свободно: клонове `feat/fix/chore` (commit, push), PR (отваряне), CI файлове на клон, четене.
- Кратко „Одобрявам: …“: миграции в хоста, единични обратими промени в production данни, настройки във Vercel, Pl@ntNet над 20 заявки.
- Пълен Approval Gate: secrets, пари/пакети/MCP, необратима загуба на данни, merge в `main`, force-push, стария проект.
- Merge в `main` е само на собственика. Същото важи за GitHub/Supabase/Vercel MCP инструментите.

## chore/claude-automation (този PR)
Добавя: MCP `deny` правила, `guard-mcp.sh` (без запис през GitHub MCP в `main`), `related-tests.sh` (PostToolUse, vitest related), `status-reminder.sh` (Stop), умения `/preflight` и `/new-migration`, точка 8 в `reviewer.md`, `*.bundle` в `.gitignore`.
Не добавя (чака собственика): MCP `ask` правила (auto mode отказа редакцията — собственикът ги добавя ръчно), Svelte MCP, обновяване на зависимости, `jq`.

## Локална среда (машината на собственика, 06.10)
- Няма Node.js, `node_modules`, Docker и `jq` в Git Bash → тестовете не могат да се пуснат локално; `related-tests.sh` тихо се пропуска.

## Отворени задачи
1. MCP `ask` правила в `.claude/settings.json` (ръчно, от собственика).
2. Node.js 22 + `npm ci` на тази машина; Docker за локален Supabase (Approval Gate — лиценз на Docker Desktop в организация).
3. Фаза B на CI: локален Supabase + `db:reset` + `test:db` + `test:integration` + `test:e2e`.
4. Двете гъби в `/review` (решение на собственика).
5. Нов дизайн на `feat/redesign` (P1), след избор на посока.
6. Svelte MCP (Approval Gate); Playwright MCP — не е нужен засега.
