# Статус — Флора 3
Обновено: 2026-10-06. Клон: `chore/github-tooling` (от `main` 2ec452c).

## Production (проверено само с четене, 2026-10-06)
- `main` = 2ec452c (PR #5). Последният production deploy във Vercel е READY и е от същия commit.
- Хостнат flora3 (Supabase): в `supabase_migrations` са 5: init, explicit_grants, identification_status, editors_no_delete, legacy_review. В repo-то има 7 файла: `delete_plant` (функцията е налична в хоста, проверено 06.10) и `drop_self_confirm` (приложена през SQL Editor) липсват в историята.
- 98 растения (97 стари + 1 от телефона), 118 снимки.
- Преглед на старите растения (`/review`): решени 94 от 96; остават двете гъби (*Agaricales* sp., *Russula* sp.).
- Backup: `backup.yml` е зелен — ръчен run #1 (2 окт.) и първи планиран run #2 (5 окт.) (по екранна снимка на таба Actions от собственика, 06.10.2026). `Legacy import (one-off)`: run #1 зелен, run #2 червен; еднократен, отложен по решение на собственика.
- Не ползвай `supabase db push` към хоста (версиите не съвпадат с имената на файловете).

## Работен процес (Project Instructions §5)
- Свободно: клонове `feat/fix/chore` (commit, push), PR (отваряне), CI файлове на клон, четене.
- Кратко „Одобрявам: …“: миграции в хоста, единични обратими промени в production данни, настройки във Vercel, Pl@ntNet над 20 заявки.
- Пълен Approval Gate: secrets, пари/пакети/MCP, необратима загуба на данни, merge в `main`, force-push, стария проект.
- Merge в `main` е само на собственика.

## chore/github-tooling (този PR)
Добавя: `CLAUDE.md`, `.claude/agents/` (7 роли), `.claude/rules/`, `.claude/settings.json` + hooks, `.github/workflows/ci.yml` (фаза A), `.devcontainer/`, обновен `.10x/`, `.gitignore`.
Не добавя: `.mcp.json` (нов MCP е §5.1), project skills (отделен PR `chore/skills`), CI фаза B (отделен малък PR).

## Отворени задачи
1. Фаза B на CI: локален Supabase + `db:reset` + `test:db` + `test:integration` + `test:e2e`.
2. Двете гъби в `/review` (решение на собственика).
3. Нов дизайн на `feat/redesign` (P1), след избор на посока.
4. Svelte MCP и Playwright MCP — само след „Одобрявам“.
