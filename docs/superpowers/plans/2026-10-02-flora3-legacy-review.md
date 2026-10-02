# Преглед на старите растения — план

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (Native, без subagent-и — решение на собственика). Steps use checkbox (`- [ ]`) syntax.

**Goal:** екран „За преглед“, който пуска Pl@ntNet пакетно върху старите растения, сравнява старото име с кандидатите и записва решенията на собственика. Към тях предлага български текст от Wikidata и Уикипедия.

**Architecture:** една адитивна миграция плюс затегнато `id_status`. Сървърен модул `review.ts` с чисти функции и функции за запис. Външен клиент `wiki.ts`. Endpoints `/api/review/*`. Страница `/review`, която върти пакета в браузъра чрез съществуващите `toIdentifyJpeg` и `requestIdentification`.

**Tech Stack:** SvelteKit 2.70 / Svelte 5, Supabase, Vitest, Playwright, pgTAP.

**Spec:** `docs/superpowers/specs/2026-10-02-flora3-legacy-review-design.md`

## Global Constraints
- $0, без генеративен AI. Външни API: Pl@ntNet (вече), GBIF, Wikidata, bg.wikipedia. Всички минават през `externalFetch`, таймаут 8 s.
- Нищо не вдига статус без избор на собственика. `ai_gbif` иска `chosen_index is not null`.
- `notes` и `legacy_ai` никога не се пипат.
- Атрибуции: „Разпознаване: Pl@ntNet API“ и „Текст: Уикипедия, CC BY-SA 4.0“ + линк към статията.
- Зрителят не вижда `/review` (404) и няма UPDATE. Всички endpoints минават през `requireEditor`.
- Тестове: само засегнатото по време на работа, пълният набор веднъж в T6.

## Review Focus
1. **Растение, вече прегледано** (`decision` не е null): не се появява отново и пакетът не харчи квота за него. T3 integration `prepareReview returns exists`, T5 e2e брои заявките.
2. **„Приеми всички“ с ръчно подменен identId**, който не е `match`: сървърът го пропуска. T4 integration `matchAll skips non-matches`.
3. **Име, което GBIF връща като синоним:** „Съвпада“ трябва да даде `ai_gbif`. T1 pgTAP със `gbif_match='synonym'` и съвпадение по `gbif_accepted_key`.
4. **Wikipedia extract с HTML или дълъг:** записва се чист текст, ≤ 1500 знака. T2 unit `findWiki trims extract`.
5. **Смяна на име, когато в Уикипедия няма българско име:** `name_bg` = латинското име, а не празно. Иначе записът пада на `requiredText`. T3 integration.

---

### T1: Миграция `legacy_review` + pgTAP

**Files:** Create `supabase/migrations/20261005090000_legacy_review.sql`, `supabase/tests/legacy_review.test.sql`. Regenerate `src/lib/database.types.ts` (`npm run db:types`).

**Interfaces — Produces:**
- колони `identifications.source|decision|wiki` и `plants.description_source|wiki_url`;
- индекс `identifications_one_review`;
- политика `identifications: editor update own`;
- `id_status` (нова версия).

- [ ] Тест (падащ): `legacy_review.test.sql`, `plan(12)`:
  - `has_column` ×5;
  - `id_status` = `draft` за растение с `review` ред, `chosen_index` null и съвпадащ кандидат 0.8 при `gbif_match='accepted'`;
  - след `chosen_index=0` → `ai_gbif`;
  - синоним: `gbif_match='synonym'`, кандидат с `gbif_key` = `gbif_accepted_key` → `ai_gbif`;
  - втори `review` ред за същото растение → `throws_ok '23505'`;
  - редакторът `update decision` → 1 ред; редакторът `update candidates` → `throws_ok '42501'`; зрителят `update decision` → 0 реда;
  - `ok(has_column_privilege('authenticated','public.plants','description_source','UPDATE'))`.
- [ ] `npm run db:reset && npm run test:db` → FAIL.
- [ ] Миграцията по spec §1. `id_status` се пише наново с `create or replace`; само в клона `ai_gbif` се добавя:

  ```sql
  i.chosen_index is not null and c.ord - 1 = i.chosen_index
  ```

  (`jsonb_array_elements … with ordinality c(value, ord)`).
- [ ] `npm run db:reset && npm run test:db` → PASS (76 + 12). После `npm run db:types`.
- [ ] Commit `feat(db): legacy review columns, review uniqueness, chosen-only ai_gbif`.

### T2: Външни данни: семейство от GBIF + `wiki.ts`

**Files:**
- Modify `src/lib/server/external/gbif.ts` (`GbifCheck.family`, `mapGbifMatch` → `family: string | null`).
- Create `src/lib/server/external/wiki.ts`, fixtures `tests/unit/fixtures/wikidata-search.json`, `wikidata-entity.json`, `wikipedia-summary.json`.
- Test `tests/unit/gbif.test.ts`, `tests/unit/wiki.test.ts`.

**Interfaces — Produces:**
- `export type WikiInfo = { name_bg: string | null; extract: string | null; url: string | null; title: string | null }`;
- `export async function findWiki(gbifKey: number, fetchFn?: typeof fetch): Promise<WikiInfo | null>`;
- `export const WIKI_EXTRACT_MAX = 1500`.

- [ ] Тестове (падащи):
  - `mapGbifMatch(accepted).family === 'Asteraceae'`; при липса → `null`;
  - `findWiki` (fetch stub по URL):
    - пълен → `{ name_bg: 'Паричка', title: 'Паричка', url: 'https://bg.wikipedia.org/wiki/…', extract }`;
    - search без резултат → `null`;
    - entity без `bgwiki` → `{ name_bg, extract: null, url: null, title: null }`;
    - summary 404 → `extract: null`;
    - fetch хвърля → `null`;
  - `findWiki trims extract`: 3000 знака → дължина ≤ 1500, завършва на цяло изречение или „…“.
- [ ] `npx vitest run --project unit tests/unit/gbif.test.ts tests/unit/wiki.test.ts` → FAIL.
- [ ] Реализация:
  - URL-и както в spec §2, с `User-Agent: Flora3/1.0 (personal botanical catalog)`;
  - ползва се `extract`, а не `extract_html`;
  - грешките се хващат и се логва само `e.name`.
- [ ] PASS. Commit `feat(external): GBIF family and Wikidata/Wikipedia lookup`.

### T3: `review.ts` — класификация и запис

**Files:**
- Create `src/lib/server/review.ts`.
- Modify `src/lib/server/plants.ts`: `updatePlant` слага `description_source='manual'`, когато `description` се променя и не е празно, и `null`, когато е празно.
- Test `tests/unit/review-classify.test.ts`, `tests/integration/review.test.ts`.

**Interfaces — Produces:**
- `export type ReviewKind = { kind: 'match'; index: number } | { kind: 'weak'; index: number; score: number } | { kind: 'mismatch'; sameGenus: number[] } | { kind: 'none' }`;
- `export function classify(plant: { scientific_name: string; gbif_key: number | null; gbif_accepted_key: number | null }, candidates: Candidate[]): ReviewKind`;
- `export async function prepareReview(db: Db, plantId: string, ident: { modelVersion: string | null; photoCount: number; candidates: Candidate[] }, fetchFn?: typeof fetch): Promise<'prepared' | 'exists'>`;
- `export async function decideMatch(db: Db, identId: string, opts: { useWikiName: boolean; useWikiText: boolean }): Promise<void>` — индексът се взема от `classify`, не от клиента;
- `export async function decideChange(db: Db, identId: string, index: number, opts: { nameBg: string | null; useWikiText: boolean }, fetchFn?: typeof fetch): Promise<void>`;
- `export async function decideKeep(db: Db, identId: string): Promise<void>`;
- `export const MATCH_MIN = 0.3`.

Правила:
- Името се сравнява без значение от главни/малки букви, по първите две думи на кандидата и на `scientific_name`, за да не пречи авторът.
- Родът е първата дума. „sp.“ не е вид.
- `decide*` хвърлят `UserFacingError`, ако `decision` вече не е `null` или редът не е `review`.

- [ ] Тестове (падащи):
  - unit `classify`:
    - по ключ → match;
    - по име без ключ → match;
    - 0.29 със същото име → weak;
    - друг вид от същия род → mismatch с `sameGenus=[0]`;
    - `[]` → none;
    - „Cistus sp.“ срещу „Cistus creticus“ → mismatch с `sameGenus`.
  - integration (локален Supabase, `signedInClient(EDITOR)`, fetch stub за GBIF и wiki):
    - `prepareReview` → `prepared`, после `exists`; редът има `wiki`, растението има `gbif_checked_at`;
    - `decideMatch` с `useWikiText` → `id_status='ai_gbif'`, `description_source='wikipedia'`, `wiki_url` записан, `name_bg` непроменено;
    - `decideChange` без българско име в Уикипедия → `name_bg` = латинското, `description=null`, `notes` и `legacy_ai` непроменени, `name_source='ai'`, `decision='changed'`;
    - `decideKeep` → `kept`; втори `decide*` → грешка;
    - зрителят → `prepareReview` хвърля.
- [ ] `npx vitest run --project unit tests/unit/review-classify.test.ts` и `npx vitest run --project integration tests/integration/review.test.ts` → FAIL.
- [ ] Реализация по spec §2.
- [ ] PASS. После `tests/integration/plants.test.ts` (за `updatePlant`) → PASS.
- [ ] Commit `feat(review): classify and record review decisions`.

### T4: Endpoints и actions

**Files:**
- Create `src/routes/api/review/prepare/+server.ts`, `src/routes/api/review/wiki/+server.ts`, `src/routes/review/+page.server.ts`.
- Test `tests/integration/review.test.ts`, допълва се.

**Interfaces:**
- **Consumes:** T3.
- **Produces:**
  - `POST /api/review/prepare` JSON `{ plantId, modelVersion, photoCount, candidates }` → `{ status }`;
  - `GET /api/review/wiki?key=<int>` → `{ wiki: WikiInfo | null; family: string | null }`;
  - `load` → `{ counts: { toPrepare: number; prepared: number; decided: number }; pendingPlantIds: string[]; items: ReviewItem[] }`, като `ReviewItem = { identId, plantId, scientific_name, name_bg, thumbUrl, photoUrl, candidates, kind: ReviewKind, wiki: WikiInfo | null, gbifChecked: boolean }`;
  - actions `match` (`identId`, `useWikiName`, `useWikiText`), `matchAll` (`identIds[]`; `useWikiText` е `true` там, където има extract), `change` (`identId`, `index`, `nameBg`, `useWikiText`), `keep` (`identId`).

Валидация:
- `candidates` се валидира със същата функция като отговора на `/api/identify` (`isIdentifyResult` → изнася се като `parseCandidates` в `src/lib/identify/types.ts`);
- `photoCount` е 1–5, `plantId` е uuid.

- [ ] Тестове (падащи), в integration чрез `fetch` към dev server-а, ако съществуващите integration тестове го правят, иначе директно извикване на handler-ите с `locals`:
  - `matchAll skips non-matches` — смесен списък, само match-ът е записан;
  - зрителят: `POST prepare` → 403, `load` на `/review` → 404;
  - невалиден `candidates` → 400.
- [ ] FAIL → реализация → PASS.
- [ ] Commit `feat(review): endpoints and page actions`.

### T5: UI — `/review`, линк в каталога, етикети на растението

**Files:**
- Create `src/routes/review/+page.svelte`, `src/lib/components/ReviewItem.svelte`, `src/lib/review/prepare.ts`.
- Modify:
  - `src/routes/+page.svelte:48-50` — линк „За преглед (N)“ до „+ Растение“, само при `data.isEditor && data.reviewCount > 0`;
  - `src/routes/+page.server.ts` — `reviewCount`;
  - `src/routes/plants/[id]/+page.svelte` — „Из Уикипедия“ + линк под описанието;
  - `src/lib/components/Evidence.svelte` — ред „Pl@ntNet не потвърди това име“ при `kept`.
- Test `tests/e2e/flora.spec.ts`.

**Interfaces — Produces:** `runPrepare(plants: { id: string; photoUrl: string }[], deps: { identify: (b: Blob[]) => Promise<{ result: IdentifyResult; sent: number }>; save: (body) => Promise<Response>; onProgress: (done: number, total: number) => void; signal: AbortSignal }): Promise<{ prepared: number; skipped: number; stoppedBy: 'done' | 'quota' | 'forbidden' | 'aborted' }>` в `prepare.ts`. По подразбиране `identify` = `identifyBlobs`.

Правила:
- `no_match` записва ред с `candidates: []` и `photoCount: sent`;
- `upstream` и неуспешна снимка → `skipped++`, продължава;
- `quota` и `forbidden` спират.

Текстове в UI (точни):
- бутон „Подготви прегледа“, „Спри“;
- групи „Не съвпадат“, „Съвпадат“, „Без резултат“;
- бутони „Смени с този“, „Остави старото“, „Съвпада“, „Приеми всички N съвпадения“;
- квота: „Лимитът за днес е изчерпан. Продължи утре — ще започне от там, докъдето е стигнало.“;
- без статия: „Няма статия в българската Уикипедия.“;
- атрибуции според Global Constraints.

- [ ] Unit (падащ), `tests/unit/review-prepare.test.ts`:
  - `runPrepare` спира на `quota` с `prepared=1` при отговори `[ok, quota, ok]`;
  - `upstream` → `skipped=1`, продължава;
  - `no_match` → `save` с `candidates: []`.
- [ ] e2e (падащ) `editor reviews legacy plants`:
  - admin вмъква 3 стари растения (`name_source='legacy_ai'`, със снимка, задължително с файл в storage — по образеца на теста за качване) с `gbif_key`, `gbif_match='accepted'`;
  - `page.route('/api/identify')` връща кандидати така, че едното съвпада, второто е друг вид, а третото е `no_match`;
  - „Подготви прегледа“ → видими са трите групи; „Приеми всички 1 съвпадения“ → потвърждение → статус „AI · прието име“ на страницата на растението;
  - при несъвпадението „Остави старото“ → изчезва от списъка.
- [ ] e2e `viewer does not see review`: линкът липсва, а `/review` дава 404.
- [ ] FAIL → реализация → PASS (`npx playwright test -g "review"`). Screenshot на `/review` при 360 px, проверен на око.
- [ ] Commit `feat(review): review screen with batch preparation`.

### T6: Пълна проверка, документация, PR

- [ ] Пълен набор:

  ```
  npm run db:reset && npm run test:db && npm run test:unit && npm run test:integration && npm run test:e2e && npm run check && npm run build
  ```

  Всичко трябва да е PASS. Числата се записват.
- [ ] README → „Миграции на хостнатия проект“: т. 4 `legacy_review` с проверка и rollback по spec §6. `.10x/status.md` и `handoff.md` се обновяват. Commit `docs: legacy review rollout`.
- [ ] **Одобрение:** „Одобрявам: миграция legacy_review“. Миграцията се прилага **преди** merge, защото новият код чете новите колони. Тя е адитивна и сегашният код работи с нея.
  - `apply_migration` в хоста.
  - Проверка с четене: 97 стари растения са `draft`; растението от телефона има същия статус като преди.
- [ ] Push и PR към `main`. Merge прави собственикът, а Vercel пуска production сам.
- [ ] **Одобрение:** „Одобрявам: пакетно разпознаване 96 растения“. Собственикът натиска „Подготви прегледа“.
  - Проверка с четене: 96 реда `review` (или по-малко + пропуснати) и `api_usage` ≤ 100.
