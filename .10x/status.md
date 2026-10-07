# Статус — Флора 3
Обновено: 2026-10-07. Тук е само текущото състояние и предстоящото. Историята е в git (`git log`, PR-ите).

## Сега
- `main` = production (актуалният SHA и отворените PR-и: `git log origin/main`, GitHub). CI (фаза A): `fast` (`check`, `test:unit`, `build`) и `secrets-scan` (gitleaks).
- Tooling: Svelte MCP (`.mcp.json`), `dependabot.yml` (седмично; PR-ите ги merge-ва собственикът), PR шаблон.
- Хостнат Supabase (`lfmkjxcaokndltdylama`): 98 растения, 118 снимки.
- Миграции: в `supabase_migrations` са 5 (init, explicit_grants, identification_status, editors_no_delete, legacy_review). `delete_plant` и `drop_self_confirm` са приложени, но липсват в историята. Не ползвай `supabase db push`.
- `/review`: решени 94 от 96; остават двете гъби (*Agaricales* sp., *Russula* sp.).
- Backup (`backup.yml`, седмичен pg_dump): зелен.
- Визия „Хербарий“: зелена тема, светъл и тъмен режим, шрифтове Literata + Onest; страници 15/30/45; изглед „Семейства“.
- Работен процес: `CLAUDE.md`, 7 агента, hooks и skills (`botanik`, `flora-baseline`, `flora-approval-gate`, `flora-release-pr`, `flora-svelte5-conventions`, `/preflight`, `/new-migration`).

## Следващи задачи (по ред)
1. `feat/upload-many` (§3.5, PR #25) и `feat/picture-now` (§3.6, PR #26, стъпва на #25) — отворени; чакат тестове и screenshot-и от собственика, после merge.
2. `feat/picture-now` — камера на момента, същият поток (§3.6).
3. CI фаза B: локален Supabase + `db:reset` → `test:db` → `test:integration` → `test:e2e`.
4. Тест на точността на `botanik`: 20–30 растения със сигурни имена (Top-1, Top-3, калибровка).
5. P2, с отделен brainstorm: модел „вид → наблюдения → снимки“; бутон, който приема резултата на Ботаника като чернова.
6. P3: `feat/image-enhancer` (§3.7) — готово, PR е отворен; без миграция (подобреното копие е файл `_enh.jpg`). Чака `test:db`/`integration`/`e2e` и screenshot-и от собственика.

## Чака решение от собственика
- Двете гъби в `/review` (кратко одобрение).
- Playwright MCP (пълно одобрение).
- Docker за локален Supabase на служебната машина (пълно одобрение).
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
