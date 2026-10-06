# Статус — Флора 3
Обновено: 2026-10-06. Клон: `feat/library-pagination` (от `main` d08ef34).

## Production (пренесено от предишния статус; в тази сесия не е проверявано наново)
- `main` = d08ef34 (влети #7 `fix/hooks-without-jq`, #8 `chore/claude-automation`, #9 `chore/prototype-handoff`). Deploy-ът във Vercel за този commit не е проверяван в тази сесия.
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

## Прототип „Хербарий“ (docs/prototype/HANDOFF.md §3) — всяка точка е отделен клон и PR
- **3.1 `feat/library-pagination` (този PR):** `PAGE_SIZES = [15, 30, 45]`, `DEFAULT_PAGE_SIZE = 15`; стари `?n=6/12` → 15. Unit + e2e обновени. e2e **не е пускан** (няма Docker; CI фаза A не пуска e2e).
- 3.2 `feat/family-index`: готово, клон качен, чака PR (база: след #10).
- 3.3 `feat/green-theme` — **преди старт питай собственика** за шрифтовете (Spectral/IBM Plex vs Literata/Onest) и светлия режим (HANDOFF §2).
- 3.4–3.7 по реда в HANDOFF.
- Извън 3.1, за отделна точка: „‹ Назад · Напред ›“ в пагинацията (има го в прототипа).

## Локална среда (машината на собственика, 06.10)
- Node.js 22.23.3 и gh 2.102.0 — преносими, само за потребителя (`%LOCALAPPDATA%\Programs\nodejs`, `...\Programs\gh\bin`, user PATH; MSI през winget спира на UAC). `npm ci` OK.
- `check`: 0 errors · `test:unit`: 169/169 · `build`: компилира, но adapter-vercel пада на symlink (EPERM) — Windows иска Developer Mode; в CI/Vercel не засяга.
- Няма Docker и `jq`. gh е логнат (Bocko2727, scope `repo`), но не е в PATH на Claude Code сесията — вика се с пълен път. GitHub MCP connector-ът няма право да пише в PR (403) — описания на PR се обновяват с `gh pr edit`.
- В repo-то е зададен `user.email` = gmail адреса (локално, не глобално). По-старите commit-и до 5d8b8e9 са с служебния адрес.
- `.claude/settings.json`: `git branch -D` е в `deny`; `git branch -d` пита (deny `git push * --delete*` блокира и триенето на влети клонове — собственикът ги трие сам).

## Отворени задачи
1. 9 влети клона в `origin` за изтриване (собственикът, ръчно): chore/github-tooling, chore/prototype-handoff, claude/design-polish-543trt, feat/ai-statuses-redesign, feat/flora3-v1, feat/legacy-review, fix/ai-polish, fix/hooks-without-jq, fix/post-launch-hardening.
2. Docker за локален Supabase (Approval Gate — лиценз на Docker Desktop в организация).
3. Фаза B на CI: локален Supabase + `db:reset` + `test:db` + `test:integration` + `test:e2e`.
4. Двете гъби в `/review` (решение на собственика).
5. Нов дизайн на `feat/redesign` (P1), след избор на посока.
6. Svelte MCP (Approval Gate); Playwright MCP — не е нужен засега.
