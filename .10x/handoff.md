# Handoff
Само отчети за текуща или незавършена работа. Когато задачата е влята в `main`, отчетът ѝ се маха (историята е в git и в PR-а).

## Формат
```
## <дата> · <роля> · <задача>
Статус: DONE / FAIL / BLOCKED
Резултат: <факти>
Променени файлове: <пътища или „няма“>
Доказателства: <тестове, линкове, SHA>
Рискове / несигурност: <конкретно>
Следващ: <роля и защо>
```

## 2026-10-07 · release · PR #32 `chore/ci-full` — CI фаза B
Статус: DONE (чака merge от собственика)
Резултат: job `db-e2e` (след `fast`) — локален Supabase в Docker на runner-а; test:db 88/88, test:integration 64/64, test:e2e 27/27; 4 мин 6 с.
Променени файлове: `.github/workflows/ci.yml`, `CLAUDE.md`, `.10x/status.md`, `.10x/handoff.md`
Доказателства: https://github.com/Bocko2727/flora3/actions/runs/37629208863/job/112819045987; reviewer: APPROVE.
Рискове / несигурност: `supabase/seed.sql` липсва (само предупреждение); trace при провал на e2e не се качва като artifact.
Следващ: собственикът merge-ва; после по желание отделен PR за artifact upload.

## 2026-10-07 · release · PR #31 `chore/node-22x` — Node 22.x
Статус: DONE (чака merge от собственика)
Резултат: `engines.node` `>=22` → `22.x` в `package.json` и `package-lock.json` (Vercel предупреждение за автоматичен major ъпгрейд). test:unit 233/233, check 0/0, `npm ci --dry-run` OK.
Променени файлове: `package.json`, `package-lock.json`
Доказателства: 46c6519; https://github.com/Bocko2727/flora3/pull/31
Рискове / несигурност: няма известни.
Следващ: собственикът merge-ва.

## 2026-10-07 · release · PR #30 `feat/plant-split-layout` — двуколонна страница
Статус: DONE (чака merge от собственика)
Резултат: Vercel preview на 13b1ae1 — success. Локално: test:unit и check OK; build EPERM (Windows symlink, не кода); db/e2e пропуснати (няма Docker).
Доказателства: https://github.com/Bocko2727/flora3/pull/30
Рискове / несигурност: e2e за новите табове не е минавал. Клонът е от преди фаза B — ще мине в CI след rebase/merge на `main` в него или при следващ push.
Следващ: след merge на #32 — обнови клона от `main`, за да мине `db-e2e`; после merge от собственика.

## Dependabot PR #29 (SvelteKit 3) — чака решение
Security alert #1: `cookie` < 0.7.0, severity **low**, само dev/build зависимост (вътре в SvelteKit 2). Поправката в #29 вдига SvelteKit 2 → 3 (Stop list); Vercel build пада (`.svelte-kit/tsconfig.json` не е намерен). Не се merge-ва; затваряне/dismiss — решение на собственика.
