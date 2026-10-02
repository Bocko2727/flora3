# Флора 3 — след merge на AI статусите: план

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (Native, без subagent-и — изрично решение на собственика заради разхода). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Да довършим пускането на `ai-statuses-redesign` в хостнатия flora3 и да затворим четирите отложени дребни дефекта от QA.

**Architecture:** Част A е операции върху Supabase, Vercel и GitHub. Всяка стъпка, която пише навън, иска точна фраза „Одобрявам: …“ (Project Instructions §8). Част B е малка промяна по кода в клон `fix/ai-polish` от `main`, с TDD. Тестваме само засегнатото и пускаме пълния набор веднъж преди PR.

**Tech Stack:** SvelteKit 2.70 / Svelte 5, Supabase (Postgres/RLS), Vercel, Vitest, Playwright, pgTAP.

**Spec:** `docs/superpowers/specs/2026-10-02-flora3-ai-statuses-redesign-design.md`; дефектите са в `.10x/reviews/2026-10-02-qa-report.md` → „Отложени дребни бележки“.

## Проверено състояние (2026-10-02, само четене)

- `main` = 6a72cd6 (PR #2 merge-нат). Production deploy от него е READY. `PLANTNET_API_KEY` е в Production.
- Хостнатият flora3 има 97 растения и 117 снимки. Без снимка е само *Cistus* sp. (`461c2620-…`).
- В хостнатия flora3 миграциите са в различно състояние:
  - `identification_status` е приложена;
  - `drop_self_confirm` е одобрена в предишния чат, но не е приложена (отказана при потвърждението);
  - `editors_no_delete` не е приложена и няма одобрение;
  - 0 растения със `status='confirmed'`.
- `api_usage` е празна: Pl@ntNet още не е викан на живо.
- В `main` са и двата workflow-а, `backup.yml` и `import-legacy.yml`. Backup-ът никога не е пускан.

## Global Constraints

- `flora3` = Supabase `lfmkjxcaokndltdylama`; Vercel `prj_DcJab4MBgOqAOAbwoFNOP3vvOzPG`; repo `Bocko2727/flora3`.
- $0: само безплатните лимити. Pl@ntNet най-много 100 заявки на ден (`consume_identify_quota`).
- Без subagent-и. Тестваме само засегнатото, а пълния набор пускаме веднъж преди PR.
- `main` не се пипа директно. Merge-а го прави собственикът в GitHub, както при PR #2.
- Secrets никога не минават през чата и не влизат в кода.
- AI резултат никога не се показва като потвърден вид. „Потвърдено“ идва само от iNaturalist Research Grade.
- Не ползвай `supabase db push` към хоста: версиите в `supabase_migrations` не съвпадат с имената на файловете.

## Review Focus

1. Зарежда се снимка, AI дава кандидати, после изборът се изчиства. Растението трябва да се запише **без** ред в `identifications`. Тест: B1, стъпка 1.
2. От 3 избрани снимки една не се конвертира. В `identifications.photo_count` трябва да е 2, а не 3. Тест: B1, стъпка 1 (unit).
3. Двоен клик върху „Разпознай по снимките“ докато AI мисли. Трябва да има точно 1 заявка към `/api/identify`, за да не се хаби квота. Тест: B2, стъпка 1.
4. Статусът на хербарния лист, четен на телефон с 360 px ширина. Текстът трябва да е поне 11 px и да не излиза от кръга. Тест: B3, стъпка 1.
5. След `drop_self_confirm` каталогът и страницата на растение трябва да се отварят, а броят растения да остане 97. Проверка: A1, стъпка 3.

---

## Част A — операции

### A1: `drop_self_confirm` (одобрена; трябва само да кажеш „пусни“)

- [ ] **Стъпка 1 (аз, четене):** `select count(*) from public.plants where status='confirmed'` = 0.
- [ ] **Стъпка 2 (аз):** `apply_migration` с името `drop_self_confirm` и точния SQL от `supabase/migrations/20261004100000_drop_self_confirm.sql`. При потвърждението натисни „Allow“.
- [ ] **Стъпка 3 (аз, четене):**
  - колоните `status` и `confirmed_at` вече ги няма;
  - `count(*) from plants` = 97;
  - `select public.id_status(p) from public.plants p limit 1` = `draft`;
  - `flora3.vercel.app` отваря каталога без грешка в runtime логовете на Vercel.
- Връщане назад: README → „Миграции на хостнатия проект“, т. 3.

### A2: `editors_no_delete` (иска `Одобрявам: editors_no_delete`)

- [ ] **Стъпка 1 (аз):** `apply_migration` с името `editors_no_delete` и SQL `revoke delete on public.editors from authenticated;`.
- [ ] **Стъпка 2 (аз, четене):** `has_table_privilege('authenticated','public.editors','DELETE')` = `false`. Пускам Supabase Advisors (security).
- Връщане назад: `grant delete on public.editors to authenticated;`

### A3: Ръчна проверка на живо (ти, на телефона)

- [ ] **Стъпка 1:** „+ Растение“ → една истинска снимка. Трябва да видиш 3–5 кандидата с % и текста „Разпознаването използва Pl@ntNet API.“
- [ ] **Стъпка 2:** избираш кандидат и записваш. На страницата на растението „Провери името в GBIF“ трябва да даде прието име или синоним.
- [ ] **Стъпка 3 (ако имаш iPhone):** същото със снимка в HEIC през Safari.
- [ ] **Стъпка 4 (аз, четене):** в `api_usage` има ред с брой ≥ 1. В `identifications` има ред за новото растение и `photo_count` съвпада с броя изпратени снимки.

### A4: Снимката на *Cistus* (по избор, когато решиш)

- [ ] **Стъпка 1 (ти):** Actions → „Legacy import (one-off)“ → Run workflow → **apply**.
- [ ] **Стъпка 2 (аз, четене):**
  - run-ът е `success`;
  - отчетът показва plants `created 0`, photos `created 1`, 0 грешки;
  - в базата има 118 снимки и 0 растения без снимка.
- Ако пак е 520, опитваме още веднъж след 10 минути. След трети неуспех става отделна задача с повторен опит в скрипта.

### A5: Махане на временния import (след A4 или ако се откажеш от него)

- [ ] **Стъпка 1 (ти):** GitHub → `.github/workflows/import-legacy.yml` → кошчето → Commit в `main`.
- [ ] **Стъпка 2 (ти):** Settings → Secrets → Actions → `NEW_SUPABASE_SECRET_KEY` → Remove.
- [ ] **Стъпка 3 (аз, четене):** в `main` остава само `backup.yml`.
- Връщане назад: файлът е в историята на git (commit `c65a531`).

### A6: Седмичен backup

- [ ] **Стъпка 1 (ти):** Supabase → Connect → Session pooler → копираш string-а и слагаш паролата. Не го пращай в чата.
- [ ] **Стъпка 2 (ти):** GitHub → Settings → Secrets → Actions → New: `SUPABASE_DB_URL`.
- [ ] **Стъпка 3 (ти):** Actions → „Weekly database backup“ → Run workflow.
- [ ] **Стъпка 4 (аз):** run-ът е `success` и има artifact `flora3-backup` с размер > 0.
- Ограничение: backup-ът пази редовете, не файловете в Storage.

### A7 (по избор): дребни настройки

- [ ] **Vercel:** Vercel маркира `PLANTNET_API_KEY` с `readable-secret`. Създаваш го наново с отметка **Sensitive**: Delete → Add, същата стойност, само Production → Redeploy.
- [ ] **Supabase:** Leaked password protection (Authentication → Policies). Ако безплатният план не я позволява, пропускаме.

---

## Част B — код (клон `fix/ai-polish` от `main`)

Подготовка, веднъж: `npm ci && npm run db:start && npm run env:local && npm run db:reset`.

### B1: AI предложенията следват реално изпратените снимки

Покрива дефекти 1 и 2: изчистеният избор оставя старите предложения, а `photo_count` брои и снимките, които не са се конвертирали.

**Files:**
- Modify: `src/lib/identify/client.ts` (нова `identifyBlobs`)
- Modify: `src/lib/components/AiSuggestions.svelte` (ползва `identifyBlobs`; празен `sources` → `idle`; нов подпис на `onresult`)
- Modify: `src/routes/plants/new/+page.svelte` (`pick` вдига `runKey` и при 0 файла; `receive` взема броя от `onresult`)
- Modify: `src/routes/plants/[id]/edit/+page.svelte` (`receive` по същия начин)
- Test: `tests/unit/identify-client.test.ts`, `tests/e2e/flora.spec.ts`

**Interfaces:**
- Produces:
  - `identifyBlobs(blobs: Blob[], convert?: (b: Blob) => Promise<Blob>, request?: (images: Blob[]) => Promise<IdentifyResult>): Promise<{ result: IdentifyResult; sent: number }>`. Конвертира с `prepareImages`. При 0 изображения връща `{ result: fail('bad_request'), sent: 0 }` и **не** вика `request`.
  - `AiSuggestions` prop `onresult: (result: IdentifyOk | null, sent: number) => void`.

- [ ] **Стъпка 1: тестове, които падат.**
  - unit `identifyBlobs counts only converted images`: 3 blob-а, `convert` хвърля на втория, `request` е заместител, който връща `{ ok: true, modelVersion: null, candidates: [] }`. Очаква се `sent === 2`, а `request` е извикан веднъж с 2 изображения.
  - unit `identifyBlobs does not call the API when nothing converts`: `convert` винаги хвърля. Очаква се `sent === 0`, `result.code === 'bad_request'`, `request` не е викан.
  - e2e `clearing the photos drops the AI suggestions and saves no identification`, по образеца на теста на ред 215:
    - `setInputFiles([leaf-a])`, видимо е „Bellis perennis“;
    - `setInputFiles([])`, „Bellis perennis“ вече не се вижда (`toBeHidden`);
    - Българско име „Изчистено“ → „Запази растението“;
    - `identifications` за новото id има 0 реда, а `plants.name_source` = `manual`.
- [ ] **Стъпка 2:** `npx vitest run --project unit tests/unit/identify-client.test.ts` дава FAIL („identifyBlobs is not a function“). `npx playwright test -g "clearing the photos"` дава FAIL на `toBeHidden`.
- [ ] **Стъпка 3:** реализация.
  - `identifyBlobs` в `client.ts`.
  - В `AiSuggestions.run()`: при `sources.length === 0` слагаш `phase='idle'`, `candidates=[]`, `onresult(null, 0)` и `return` без заявка. Иначе викаш `identifyBlobs` през `latestOnly` и подаваш `sent` към `onresult`.
  - Двете страници: `identPhotoCount = sent`, като `photoCount` се праща само при `ident` ≠ null.
  - `new/+page.svelte` `pick`: `runKey += 1` винаги, не само при избрани снимки.
- [ ] **Стъпка 4:** същите две команди дават PASS. После и `npx playwright test -g "AI suggestions"` (двата съществуващи теста) дава PASS.
- [ ] **Стъпка 5:** commit `fix(ai): suggestions follow the photos actually sent`.

### B2: Без двойни заявки и без заседнал „busy“

Покрива дефекти 3 и 4: „Разпознай по снимките“ не е заключен, докато AI мисли, а `Evidence` не освобождава `busy` при грешка.

**Files:**
- Modify: `src/lib/components/AiSuggestions.svelte` (prop `busy = $bindable(false)`, `true` докато `phase === 'loading'`)
- Modify: `src/routes/plants/[id]/edit/+page.svelte`:
  - `bind:busy={identifying}`;
  - бутонът е `disabled={fetchingPhotos || identifying}`;
  - `identifyPhotos` връща веднага, ако някое от двете е `true`.
- Modify: `src/lib/components/Evidence.svelte:57-64` (`busy = null` във `finally`)
- Test: `tests/e2e/flora.spec.ts`

- [ ] **Стъпка 1: тест, който пада.** e2e `identify button stays locked while AI is thinking`:
  - `page.route(IDENTIFY_URL)` брои извикванията и отговаря с `identifyOk` след 1500 ms;
  - на `${aiPlantUrl}/edit` бутонът се натиска, после `toBeDisabled()`;
  - втори клик с `force: true`, после се чака „Bellis perennis“;
  - бутонът е `toBeEnabled()` и броячът е точно 1.

  Тестът се слага след „AI suggestions can be requested…“, защото ползва `aiPlantUrl`.
- [ ] **Стъпка 2:** `npx playwright test -g "stays locked"` дава FAIL (бутонът е enabled по време на заявката).
- [ ] **Стъпка 3:** реализация според Files.

  Evidence няма автоматичен тест: при мрежова грешка SvelteKit не хвърля от `update()`, затова дефектът не се възпроизвежда без да подменяме вътрешностите на framework-а. Промяната е само `try { await update(...) } finally { busy = null }`.
- [ ] **Стъпка 4:** PASS на `npx playwright test -g "stays locked|evidence panel"`.
- [ ] **Стъпка 5:** commit `fix(ai): lock identify while a request is running; always release evidence busy`.

### B3: Четим печат за статуса

Покрива дефект 5: печатът е с текст 9–10 px.

**Files:**
- Modify: `src/routes/plants/[id]/+page.svelte:164-188`:
  - `.stamp` става 88×88 px, а `font-size: var(--text-xs)` (12 px);
  - `.stamp.community span:last-child` става `0.6875rem` (11 px).
- Test: `tests/e2e/flora.spec.ts`

- [ ] **Стъпка 1: тест, който пада.** e2e `status stamp text is at least 11px`. Слага се след AI тестовете, защото ползва `aiPlantUrl`:
  - на `aiPlantUrl` при viewport 360×780 се взема `.stamp` с `page.locator('.stamp')`;
  - `getComputedStyle(el.lastElementChild).fontSize` трябва да е ≥ 11;
  - `el.scrollWidth <= el.clientWidth`, т.е. текстът не излиза от кръга.
- [ ] **Стъпка 2:** `npx playwright test -g "stamp"` дава FAIL (10 < 11).
- [ ] **Стъпка 3:** CSS според Files. Ако „Потвърдено · iNaturalist“ не се събира на 11 px, текстът се пренася на 2 реда (`max-width: 9ch`). Шрифтът не се намалява.
- [ ] **Стъпка 4:** PASS. Screenshot при 360 px и при 1280 px, проверен на око.
- [ ] **Стъпка 5:** commit `style(plant): readable status stamp`.

### B4: Пълна проверка, документация, PR

- [ ] **Стъпка 1:** веднъж пълния набор:
  ```
  npm run db:reset && npm run test:db && npm run test:unit && npm run test:integration && npm run test:e2e && npm run check && npm run build
  ```
  Очаквано: pgTAP 76/76, unit 147/147, integration 49/49, e2e 16/16, check 0, build OK.
- [ ] **Стъпка 2:** обнови `.10x/status.md` и `.10x/handoff.md` с реалното състояние след Част A и B. Сега и двата описват положението отпреди merge-а. Махни реда за дефектите от QA доклада. Commit `docs(state): post-merge status`.
- [ ] **Стъпка 3 (одобрение):** `Одобрявам: push и PR fix/ai-polish`. Тогава push и PR към `main`. Merge-а го правиш ти в GitHub. Vercel пуска production сам.
- [ ] **Стъпка 4 (аз, четене):** production deploy от новия `main` е READY и в runtime логовете няма грешки.

---

## Ред на изпълнение

1. A1 и A2, само чакат твоите думи.
2. A3, ръчният тест: най-ценен е, защото Pl@ntNet още не е викан на живо.
3. B1, B2, B3, B4.
4. A4, A5 и A6, когато ти е удобно. Те не зависят от кода.

## Съзнателно НЕ правим

- Повторен опит при качване в import скрипта: правим го само ако A4 падне 3 пъти.
- Достъп за приятелката ти, решение за Vercel Authentication, старият проект, GBIF autocomplete: всяко става с отделен brainstorm.
- `supabase db push` и изравняване на номерата на миграциите в хоста: отделна задача, ако някога потрябва.
