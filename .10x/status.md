# Статус — Флора 3
Обновено: 2026-10-07. Тук е само текущото състояние и предстоящото. Историята е в git (`git log`, PR-ите).

## Сега
- `main` = production = `c3f8825` (PR #30); Vercel deploy `READY` (проверено 07.10). Актуалният SHA и отворените PR-и: `git log origin/main`, GitHub.- CI (`ci.yml`): `fast` (`check`, `test:unit`, `build`) → `db-e2e` (локален Supabase в Docker на runner-а: `db:reset`, `test:db`, `test:integration`, `test:e2e`) и `secrets-scan` (gitleaks, само диапазона на PR-а). Node е закрепен на `22.x`.
- Влято в приложението: профил на вида като въпроси и отговори с „AI текст · непроверен“ и лента „Снимки по месеци“ (PR #24); „Качи растение“ — няколко растения (#25); „Снимай сега“ (#26); Image Enhancer — подобрено копие без миграция (#27); двуколонна страница на растението с два таба „Информация“ и „Доказателства“ (#30).
- Tooling: Svelte MCP (`.mcp.json`), `dependabot.yml` (седмично, major игнорирани; PR-ите ги merge-ва собственикът), PR шаблон. Dependabot PR #29 (`cookie`, `adapter-vercel`, `kit`) е затворен без merge.
- Хостнат Supabase (`lfmkjxcaokndltdylama`, проверено 07.10): 98 растения, 118 снимки, 1 редактор.
- Миграции: в `supabase_migrations` са 5 (init, explicit_grants, identification_status, editors_no_delete, legacy_review). `delete_plant` и `drop_self_confirm` са приложени, но липсват в историята. Не ползвай `supabase db push`.
- `/review`: решени 94 от 96; остават двете гъби (*Agaricales* sp., *Russula* sp.).
- Backup (`backup.yml`, седмичен pg_dump): зелен по предишния статус; не е препроверяван на 07.10.
- Визия „Хербарий“: зелена тема, светъл и тъмен режим, шрифтове Literata + Onest; страници 15/30/45; изглед „Семейства“.
- Работен процес: `CLAUDE.md`, 7 агента, hooks и skills (`botanik`, `flora-baseline`, `flora-approval-gate`, `flora-release-pr`, `flora-svelte5-conventions`, `/preflight`, `/new-migration`).
- Одитът на средата на Claude Code (плъгини, connector-и, permissions) е в `docs/audit/2026-10-07-claude-code-environment.md`. Забележка: твърдението в него, че `status.md` е остарял за PR #32, е поправено с този файл.

## Следващи задачи (по ред)
1. Зелен run на `db-e2e` на `main` (job-ът е нов; два теста са поправени в PR #30 след първия run) — провери в GitHub Actions.
2. Тест на точността на `botanik`: 20–30 растения със сигурни имена (Top-1, Top-3, калибровка).
3. P2, с отделен brainstorm: модел „вид → наблюдения → снимки“; бутон, който приема резултата на Ботаника като чернова.
4. Допълване на защитите от одита (отделна chore задача): `deny/ask` за `rm -rf`, `git merge`, `vercel --prod`, write-инструментите на Vercel; hook за снимките; `settings.local.json` без `enableAllProjectMcpServers`.

## Чака решение от собственика
- Двете гъби в `/review` (кратко одобрение).
- Playwright MCP (пълно одобрение): плъгинът е зареден в машината на собственика с `@latest`, а `CLAUDE.md` казва „още не е одобрен“ — одобри със закрепена версия или махни плъгина.
- Docker за локален Supabase на служебната машина (пълно одобрение).
- Изчистване на плъгини и connector-и по одита (ръчно в claude.ai/настройките; нищо не е изпълнено).
- Изтриване на влетите клонове в GitHub (сам; или „Automatically delete head branches“ в настройките).
- Dependabot alerts в настройките на repo-то (ръчно; `dependabot.yml` вече е в `main`).

## Отложено (не се повдига, докато собственикът не каже)
- Махане на `NEW_SUPABASE_SECRET_KEY` и `import-legacy.yml`.
- Собствен домейн или промяна на Vercel Authentication; достъпът за зрител.
- Гъбите като отделна категория.

## Локална среда (машината на собственика)
- Node.js 22 и gh са преносими, само за потребителя; няма Docker и `jq`.
- `build` компилира, но adapter-vercel пада на symlink (EPERM) под Windows без Developer Mode; в CI и Vercel не засяга.
- GitHub MCP connector-ът няма право да пише; push и PR минават през `git`/`gh` (PR през REST, не GraphQL).
- `.claude/settings.json` блокира `git push --delete` и `git branch -D`; влетите клонове ги трие собственикът.
