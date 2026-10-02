# Флора 3 — оставащо след пускането: план

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Да завършим пренасянето, да махнем временните неща, да включим backup и да затворим двата отложени дефекта.

**Architecture:** Част A са операции в GitHub, Supabase и Vercel. Всяка стъпка, която пише навън, иска изрично одобрение по Project Instructions: точна фраза „Одобрявам: …“, а не общо „одобрявам всичко“. Част B са малки промени в кода на отделен клон от `main`, с TDD. Хостнатата база се променя само чрез отделно одобрение.

**Tech Stack:** SvelteKit 2.70, Supabase (Postgres/RLS/Storage), Vercel, GitHub Actions, pgTAP, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-01-flora3-design.md`; статус: `docs/STATUS-2026-10-02.md` и Project Knowledge `claude/STATUS-2026-10-02-flora3.md`.

## Global Constraints

- `flora3` = Supabase `lfmkjxcaokndltdylama`; Vercel `prj_DcJab4MBgOqAOAbwoFNOP3vvOzPG`; repo `Bocko2727/flora3`.
- Собственик и единствен редактор: `5135dc97-a09c-47b0-a7fc-4f5a6fd20912`.
- Старият проект `sxuxtsbyqjaodyuqebux` само се чете; `File_017.png` и `IMG_5512.jpg` остават непроменени.
- Secret ключове никога не минават през чата и не влизат в кода.
- Никакъв AI текст като потвърден факт: всички пренесени растения са `unverified`.
- $0: само безплатните лимити на Supabase, Vercel и GitHub.

## Review Focus

1. Повторно пускане на apply при частично пренасяне трябва да добави само липсващото: 0 нови растения, 1 нова снимка, 0 дубликати (проверка в A1).
2. Изтриването на временния Action не трябва да засегне `backup.yml` (проверка в A3).
3. pgTAP трябва да минава и след integration тестовете, без `db:reset` между тях (тест в B1).
4. Влязъл потребител не може да изтрие ред от `editors`, дори чужд (тест в B2).
5. Зрител (без ред в `editors`) вижда каталога, но не вижда бутони за писане. Вече е покрит от e2e, не се пипа.

---

## Част A — операции

### A1: Довършване на пренасянето (липсва 1 снимка)

Факт: apply run `36971848495` записа 97/97 растения и 117/118 снимки. Качването на снимката на *Cistus* sp. (`461c2620-…`) получи **HTTP 520** от Supabase Storage в 06:14:33 UTC. Това е временна грешка: файлът е наред и мина в локалната репетиция. Скриптът е идемпотентен, така че повторното пускане опитва само липсващото.

- [ ] **Стъпка 1 (ти):** GitHub → flora3 → Actions → Legacy import (one-off) → Run workflow → mode **apply**.
- [ ] **Стъпка 2 (аз):** run-ът е `success`, а отчетът показва plants `created 0 / skippedExisting 97`, photos `created 1 / skippedDuplicate 117`, errors 0, `plantsWithoutPhotos: []`.
- [ ] **Стъпка 3 (аз, SQL само за четене):** 97 растения, 118 снимки, 97 основни, 236 файла в `photos`, 0 `confirmed`, 0 растения без снимка, *Sedum album* липсва.
- [ ] **Ако пак е 520:** не пипам кода. Опитваме още веднъж след 10 минути. След трети неуспех добавяме повторен опит за качването в `scripts/import/run.ts` (отделна задача с тест).

### A2: Визуална проверка — „да видим цветя“

- [ ] **Стъпка 1 (ти):** отвори `https://flora3.vercel.app` на телефона си. Ако Vercel те пита за вход, първо влез във Vercel, после във Флора с твоя акаунт.
- [ ] **Стъпка 2 (ти):** провери, че каталогът показва 97 растения с миниатюри, че Незабравката има снимка и че отварянето на растение показва снимката и панела „AI чернова — непроверено“.
- [ ] **Стъпка 3 (ти → мен):** пращаш ми какво не изглежда наред. Screenshot без лични данни е достатъчен.

### A3: Махане на временния Action

- [ ] **Стъпка 1 (ти):** GitHub → flora3 → `.github/workflows/import-legacy.yml` → иконата кошче → Commit в `main`.
- [ ] **Стъпка 2 (ти):** Settings → Secrets and variables → Actions → `NEW_SUPABASE_SECRET_KEY` → Remove.
- [ ] **Стъпка 3 (аз):** в Actions остава само „Weekly database backup“ и `backup.yml` е непроменен.
- Връщане назад: файлът е в историята на git (commit `c65a531`).

### A4: Седмичен backup

`backup.yml` вече е в `main` (неделя → понеделник 03:17 UTC). Липсва му само secret.

- [ ] **Стъпка 1 (ти):** Supabase → flora3 → **Connect** → **Session pooler** → копираш connection string-а и слагаш паролата на базата. Не го пращай в чата.
- [ ] **Стъпка 2 (ти):** GitHub → Settings → Secrets → Actions → New: `SUPABASE_DB_URL` = този string.
- [ ] **Стъпка 3 (ти):** Actions → Weekly database backup → Run workflow.
- [ ] **Стъпка 4 (аз):** run-ът е `success` и има artifact `flora3-backup` с размер > 0.
- Ограничение: backup-ът пази редовете в базата, не снимките в Storage. Оригиналите остават на телефона ти и в стария проект.

### A5 (по избор): Site URL в Supabase

Нужно е само за имейл линкове. Входът с парола работи и без него.

- [ ] **Стъпка 1 (ти):** Supabase → Authentication → URL Configuration → Site URL = `https://flora3.vercel.app` → Save.

---

## Част B — код (клон `fix/post-launch-hardening` от `main`)

### B1: pgTAP с отделни тестови имейли

Сега `supabase/tests/database.test.sql` ползва `editor@flora.test` / `viewer@flora.test`, същите като `tests/helpers/supabase.ts:34-35`. Ако integration тестовете са минали преди pgTAP, вмъкването в `auth.users` пада на unique email.

**Files:**
- Modify: `supabase/tests/database.test.sql:6-7,139` (имейлите)

- [ ] **Стъпка 1:** възпроизведи: `npm run db:reset && npm run test:integration && npm run test:db`. Очаквано: FAIL (duplicate key на `users_email_partial_key` или подобно).
- [ ] **Стъпка 2:** смени на `editor@pgtap.test`, `viewer@pgtap.test`, `editor2@pgtap.test`. UUID-тата не се сменят.
- [ ] **Стъпка 3:** същата команда като в стъпка 1. Очаквано: pgTAP 50/50 PASS.
- [ ] **Стъпка 4:** commit `test(db): pgTAP fixtures use their own emails`.

### B2: Отнемане на DELETE върху `editors`

`init` отнема insert и update върху `editors`, но не и delete. RLS вече блокира изтриването, защото няма delete policy. Това е втори слой защита.

**Files:**
- Create: `supabase/migrations/20261003090000_editors_no_delete.sql` — съдържа само `revoke delete on public.editors from authenticated;`
- Modify: `supabase/tests/database.test.sql` — `plan(50)` → `plan(51)` и нов assert.

- [ ] **Стъпка 1:** добави теста:
  ```sql
  select ok(not has_table_privilege('authenticated', 'public.editors', 'DELETE'), 'authenticated cannot DELETE from editors');
  ```
- [ ] **Стъпка 2:** `npm run db:reset && npm run test:db`. Очаквано: FAIL само на новия assert.
- [ ] **Стъпка 3:** създай миграцията.
- [ ] **Стъпка 4:** `npm run db:reset && npm run test:db`. Очаквано: 51/51 PASS. После `npm run test:unit && npm run test:integration && npm run test:e2e`, всичко PASS.
- [ ] **Стъпка 5:** commit `fix(db): revoke DELETE on editors from authenticated`.
- [ ] **Стъпка 6 (одобрение):** прилагане на хостнатия `flora3` през SQL Editor (ти), с точния SQL от миграцията. Проверка (аз, само четене): `has_table_privilege('authenticated','public.editors','DELETE') = false`. Връщане назад: `grant delete on public.editors to authenticated;`
- [ ] **Стъпка 7 (одобрение):** PR `fix/post-launch-hardening` → `main`, merge commit.

---

## Част C — по-късно (всяко с отделен brainstorm и план)

- **Достъп за приятелката ти:** акаунт с Auto Confirm без ред в `editors`, плюс решение за Vercel Authentication. Сега `all_except_custom_domains` пуска само влезли във Vercel. Вариантите са „само за preview“ или собствен домейн.
- **Старият проект:** таблицата `plants` се чете анонимно с публичния ключ. Какво да правим със стария сайт е отделна тема.
- **P1 снимки:** opt-in „✨ Подобри качество“, само недеструктивно.
- **P2 таксономия:** GBIF autocomplete и статуси на проверката; Pl@ntNet само opt-in.
- **SvelteKit 3.x миграция:** след като 3.x се стабилизира.

## Съзнателно НЕ правим

- **Повторен опит при качване в скрипта за пренасяне:** скриптът се ползва веднъж и е идемпотентен, затова повторното пускане е достатъчно. Става задача само ако A1 се провали 3 пъти.
- **Предупреждението `url.parse()` в лога:** идва от зависимост, а не от нашия код, и не влияе на резултата.
