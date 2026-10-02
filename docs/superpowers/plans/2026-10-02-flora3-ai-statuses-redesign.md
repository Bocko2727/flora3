# Флора 3 — AI предложение, статуси и тъмна визия: план

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Автоматично Pl@ntNet предложение при качване, три изчислени статуса на проверка (draft / ai_gbif / community) и тъмен редизайн с каталог на страници по 6/12.

**Architecture:** Базата добавя протоколи `identifications`, GBIF/iNaturalist колони и изчислено поле `id_status(plants)`. Външните API се викат само от сървъра (SvelteKit endpoint + form actions) с инжектируем `fetch` за тестове. UI-ят се пренаписва стилово в един тъмен набор от токени.

**Tech Stack:** SvelteKit 2.70 / Svelte 5 runes, TypeScript, Supabase (Postgres, RLS, pgTAP), zod 4, Vitest 4, Playwright 1.56.1 (Pixel 7).

**Spec:** `docs/superpowers/specs/2026-10-02-flora3-ai-statuses-redesign-design.md`

## Global Constraints

- Работи се на клон `feat/ai-statuses-redesign` (от `fix/post-launch-hardening`). Никакви commit-и в `main`, никакъв push, никакви промени по хостнатия Supabase или Vercel.
- Тестове преди всеки commit: съответният targeted suite. Локалната база: `npm run db:reset` преди `npm run test:db`; e2e и integration ползват `.env` от `npm run env:local`.
- Нито един нов npm пакет.
- Целият видим текст е на български; латинските имена са в курсив.
- Никога „потвърдено“ / „Потвърдено“ за нещо различно от `id_status = 'community'`.
- Етикети (точно): `AI чернова`, `Чернова`, `AI · прието име`, `Потвърдено · iNaturalist`.
- Праг: `0.30` (само в SQL функцията `id_status`). Квота: `100` на потребител на UTC ден (само в `consume_identify_quota`).
- Снимка за разпознаване: JPEG, най-дълга страна `1024`, качество `0.8`; 1–5 снимки на заявка; сървърът отхвърля файл > `2 * 1024 * 1024` байта или тип различен от `image/jpeg`/`image/png`.
- Timeout-и: Pl@ntNet `15_000` ms, GBIF `5_000` ms, iNaturalist `5_000` ms (`AbortSignal.timeout`).
- Pl@ntNet URL: `https://my-api.plantnet.org/v2/identify/all?api-key=<KEY>&nb-results=5&include-related-images=false`; multipart полета `images` и `organs=auto` по веднъж за всяка снимка. Без `lang`.
- GBIF: `https://api.gbif.org/v1/species/match?name=<name>&strict=true` и `https://api.gbif.org/v1/species/<key>`.
- iNaturalist: `https://api.inaturalist.org/v1/observations/<id>`; regex за вход: `^(?:https?://(?:www\.)?inaturalist\.org/observations/)?(\d{1,12})/?$`.
- `PLANTNET_API_KEY` се чете само от `$env/dynamic/private`, никога не се логва и не стига до браузъра.
- Атрибуция под кандидатите: `Разпознаването използва Pl@ntNet API.`
- Външните API в автоматичните тестове винаги са подменени (инжектиран `fetchFn` или `page.route`).

## Review Focus

1. **Латинско име с автор или разлики в главни букви** (`Myosotis Arvensis`, „Myosotis arvensis (L.) Hill“) — изборът на кандидат и `name_source`/`id_status` трябва да сравняват trim + lower-case по `scientific_name` без автор. Тест в Task 3 (`deriveNameSource`) и Task 1 (pgTAP, главни букви).
2. **Растение без снимки или със снимки само в HEIC** — AI панелът не трябва да виси в „Разпознаване…“; ако нито една снимка не се декодира, показва `bad_request` съобщението. Тест в Task 6 (unit за `prepareImages`: всички конвертирания се провалят → `[]`, а панелът тогава показва `bad_request`).
3. **Двойно натискане / повторно избиране на снимки, докато предишното разпознаване тече** — само последният резултат се показва (по-стар отговор не презаписва по-нов). Тест в Task 6 (unit на `latestOnly`).
4. **GBIF/iNaturalist недостъпни при запис** — растението се записва, статусът остава `draft`, а страницата показва бутона за повторна проверка. Тест в Task 5 (integration с `fetchFn`, който хвърля).
5. **Страница извън обхвата в URL** (`?p=99`, `?n=7`, `?s=xyz`) — каталогът показва последната валидна страница / 12 / всички, без грешка. Тест в Task 2 (`parseCatalogParams`, `paginate`).

---

## File Structure

| Файл | Отговорност |
|---|---|
| `supabase/migrations/20261004090000_identification_status.sql` | нови колони, `identifications`, `api_usage`, `id_status()`, `consume_identify_quota()`, права |
| `supabase/migrations/20261004100000_drop_self_confirm.sql` | маха `status`, `confirmed_at` |
| `supabase/tests/identification.test.sql` | pgTAP за новото |
| `src/lib/status.ts` | `IdStatus`, `NameSource`, етикети и обяснения |
| `src/lib/components/StatusBadge.svelte` | значката (форма + текст) |
| `src/lib/catalog/filter.ts` | филтър по `id_status`, `paginate`, `parseCatalogParams` |
| `src/lib/identify/types.ts` | `Candidate`, `IdentifyResult`, съобщения, `identificationSchema`, `deriveNameSource` |
| `src/lib/server/external/{plantnet,gbif,inat}.ts` | чисти клиенти с инжектируем `fetchFn` |
| `src/lib/server/identify.ts` + `src/routes/api/identify/+server.ts` | handler + тънък endpoint |
| `src/lib/server/verification.ts` | `refreshNameCheck`, `linkInat`, `unlinkInat`, `useAcceptedName` |
| `src/lib/identify/client.ts` | `toIdentifyJpeg`, `requestIdentification`, `latestOnly` |
| `src/lib/components/AiSuggestions.svelte` | панелът с кандидати |
| `src/lib/components/Evidence.svelte` | блокът „Доказателства“ + предупреждения |
| `src/lib/components/Pagination.svelte` | 6/12 + номера на страници |

---

### Task 1: База — протоколи, проверки, изчислен статус, квота

**Files:**
- Create: `supabase/migrations/20261004090000_identification_status.sql`
- Create: `supabase/tests/identification.test.sql`
- Modify: `src/lib/database.types.ts` (регенерира се с `npm run db:types`)

**Interfaces:**
- Produces: колони на `plants` (`name_source`, `gbif_match`, `gbif_key`, `gbif_accepted_key`, `gbif_accepted_name`, `gbif_checked_at`, `inat_observation_id`, `inat_quality_grade`, `inat_taxon_name`, `inat_checked_at`); таблица `identifications(id, plant_id, owner_id, provider, model_version, photo_count, candidates, chosen_index, created_at)`; SQL `public.id_status(public.plants) returns text` (достъпно в PostgREST select като `id_status`); RPC `consume_identify_quota() returns boolean`.

- [ ] **Step 1: Напиши pgTAP файла (провал очакван)** `supabase/tests/identification.test.sql`, със собствени потребители `editor3@pgtap.test` (`33333333-…`) и `viewer3@pgtap.test` (`44444444-…`), editor3 в `editors`, транзакция `begin … rollback`. Проверки (точно тези, `plan(N)` = техният брой):
  - нова таблица/колони: `has_column('public','plants','name_source')`, `has_table('public','identifications')`, `has_function('public','id_status',array['plants'])`;
  - като editor3: създава растение `Myosotis arvensis` → `id_status = 'draft'`;
  - добавя `identifications` с кандидат `{"scientific_name":"Myosotis arvensis","score":0.62,"gbif_key":5341258}` и задава `gbif_match='accepted', gbif_key=5341258, gbif_accepted_key=5341258` → `'ai_gbif'`;
  - същото, но score `0.29` (отделно растение) → `'draft'`; score `0.30` → `'ai_gbif'`;
  - съвпадение по име при разлика в главни букви (`MYOSOTIS ARVENSIS` в кандидата, `gbif_key` null) → `'ai_gbif'`;
  - `gbif_match='synonym'` с `gbif_accepted_key`, равен на `gbif_key` на кандидата → `'ai_gbif'`; `gbif_match='doubtful'` → `'draft'`;
  - `inat_quality_grade='research', inat_taxon_name='Myosotis arvensis'` → `'community'` (дори без идентификация); `inat_taxon_name='Myosotis sylvatica'` → не е `'community'`; `inat_quality_grade='needs_id'` → не е `'community'`;
  - viewer3: чете `identifications`; `insert` в `identifications` → `42501`; `consume_identify_quota()` → `false`;
  - editor3: `update`/`delete` върху `identifications` не променят нищо (0 реда засегнати или 42501);
  - квота: 100 извиквания `consume_identify_quota()` като editor3 връщат всички `true` (`select bool_and(public.consume_identify_quota()) from generate_series(1,100)`), 101-вото → `false`; `select count from api_usage` → `100` (като `postgres`);
  - `has_table_privilege('authenticated','public.api_usage','select')` → false;
  - `anon` няма select на `identifications`;
  - изтриване на растението каскадно трие неговите `identifications` (през `delete_plant`).
- [ ] **Step 2:** `npm run db:reset && npm run test:db` → FAIL в `identification.test.sql`.
- [ ] **Step 3: Напиши миграцията** точно по spec §4 (колони, backfill `name_source='legacy_ai' where legacy_ai is not null`, двете таблици, функцията `id_status` с `stable` и `set search_path = ''`). Допълнително:
  - `identifications`: RLS включен; политики `select to authenticated using (true)` и `insert to authenticated with check ((select public.is_editor()) and owner_id = (select auth.uid()) and exists (select 1 from public.plants p where p.id = plant_id and p.owner_id = (select auth.uid())))`; `revoke all … from anon`; `grant select on public.identifications to authenticated`; `grant insert (plant_id, model_version, photo_count, candidates, chosen_index) on public.identifications to authenticated`; `grant all on public.identifications to service_role`; индекс `(plant_id, created_at desc)`.
  - `api_usage`: RLS включен, без политики; `revoke all on public.api_usage from anon, authenticated`.
  - `consume_identify_quota()`: `language plpgsql security definer set search_path = ''`; ако `not public.is_editor()` → `false`; иначе `insert … values (auth.uid(), (now() at time zone 'utc')::date, 1) on conflict (user_id, day) do update set count = public.api_usage.count + 1 where public.api_usage.count < 100 returning count into used; return used is not null;`. `revoke all … from public, anon; grant execute … to authenticated`.
  - `id_status`: `revoke all … from public, anon; grant execute … to authenticated, service_role`.
  - Колонни права за `plants`: `grant insert (name_source, gbif_match, gbif_key, gbif_accepted_key, gbif_accepted_name, gbif_checked_at, inat_observation_id, inat_quality_grade, inat_taxon_name, inat_checked_at) on public.plants to authenticated;` и същият списък за `update`.
- [ ] **Step 4:** `npm run db:reset && npm run test:db` → всички файлове PASS (стария `database.test.sql` също). После `npm run db:types` и `npm run check` → 0 грешки; `npm run test:unit && npm run test:integration` → PASS.
- [ ] **Step 5: Commit** `feat(db): identifications, GBIF/iNaturalist evidence, computed id_status and identify quota`.

### Task 2: Статуси в приложението, махане на „Потвърди“, логика за каталога

**Files:**
- Create: `supabase/migrations/20261004100000_drop_self_confirm.sql`, `src/lib/status.ts`, `src/lib/components/StatusBadge.svelte`
- Modify: `src/lib/types.ts`, `src/lib/server/plants.ts`, `src/lib/catalog/filter.ts`, `src/routes/+page.server.ts`, `src/routes/+page.svelte`, `src/lib/components/PlantCard.svelte`, `src/routes/plants/[id]/+page.server.ts`, `src/routes/plants/[id]/+page.svelte`, `scripts/import/map.ts`, `supabase/tests/database.test.sql`, `src/lib/database.types.ts`
- Test: `tests/unit/status.test.ts`, `tests/unit/filter.test.ts`, `tests/integration/plants.test.ts`, `tests/integration/import.test.ts`, `tests/e2e/flora.spec.ts`

**Interfaces:**
- Consumes: Task 1 колони и `id_status`.
- Produces:
  - `src/lib/status.ts`: `export type IdStatus = 'draft' | 'ai_gbif' | 'community'`; `export type NameSource = 'manual' | 'ai' | 'legacy_ai'`; `export type StatusView = { tone: 'draft' | 'ai_gbif' | 'community'; label: string; explanation: string }`; `export function statusView(status: IdStatus, nameSource: NameSource): StatusView`; `export function isIdStatus(v: unknown): v is IdStatus`.
  - `StatusBadge.svelte` props `{ status: IdStatus; nameSource: NameSource; explain?: boolean }` — рендерира `<span class="status-badge {tone}">` с `<i aria-hidden>` и етикета; при `explain` добавя `<p class="status-explain">`.
  - `filter.ts`: `export type StatusFilter = 'all' | IdStatus`; `filterPlants<T extends { name_bg: string; scientific_name: string; id_status: IdStatus }>(plants: T[], query: string, status: StatusFilter): T[]`; `export const PAGE_SIZES = [6, 12] as const; export type PageSize = 6 | 12`; `export function paginate<T>(items: T[], page: number, size: PageSize): { items: T[]; page: number; pages: number }` (pages ≥ 1; page се клампва в [1, pages]); `export function parseCatalogParams(params: URLSearchParams): { q: string; s: StatusFilter; n: PageSize; p: number }` (по подразбиране `'' / 'all' / 12 / 1`; невалидното → по подразбиране; `p` < 1 или не цяло → 1).
  - `plants.ts`: `PlantListItem = Pick<PlantRow, 'id' | 'scientific_name' | 'name_bg' | 'family' | 'name_source'> & { id_status: IdStatus; primaryThumbPath: string | null }`; `PlantWithPhotos = PlantRow & { id_status: IdStatus; photos: PhotoRow[] }`; `createPlant(db, id, input, nameSource: NameSource = 'manual')`; `updatePlant(db, id, input, nameSource?: NameSource)` (без `nameSource` не пипа колоната); `setPlantStatus` е премахната.
  - Каталогът (`+page.server.ts`) връща за всяко растение `{ id, name_bg, scientific_name, family, id_status, name_source, thumbUrl, photoState }`.

- [ ] **Step 1: Тестове (провал очакван):**
  - `tests/unit/status.test.ts`: `statusView('draft','ai')` и `('draft','legacy_ai')` → `{ tone:'draft', label:'AI чернова', explanation:'Предложено от AI. Не е проверено от човек.' }`; `('draft','manual')` → `label:'Чернова', explanation:'Въведено ръчно. Не е проверено.'`; `('ai_gbif', any)` → `label:'AI · прието име', explanation:'Името е валидно според GBIF. Видът е предложен от AI и не е потвърден от човек.'`; `('community', any)` → `label:'Потвърдено · iNaturalist', explanation:'Наблюдение с Research Grade в iNaturalist за същия вид.'`; никой етикет освен на `community` не съдържа „отвърд“.
  - `tests/unit/filter.test.ts`: пренапиши със `id_status`; филтър `'ai_gbif'`; `paginate` на 13 елемента: (p1,n12) → 12 елемента/pages 2; (p2,n12) → 1; (p99,n12) → page 2; (p1,n6) на 0 елемента → `{items:[],page:1,pages:1}`; `parseCatalogParams(new URLSearchParams('n=7&p=-3&s=xyz&q=%20лай'))` → `{ q:' лай', s:'all', n:12, p:1 }` (q не се trim-ва тук; нормализира се във филтъра); `'n=6&p=3&s=community'` → `{ q:'', s:'community', n:6, p:3 }`.
  - `tests/integration/plants.test.ts`: замени confirm/unconfirm с: ново растение → `listPlants` дава `id_status:'draft', name_source:'manual'`; `createPlant(..., 'ai')` → `name_source:'ai'`; `updatePlant` без `nameSource` запазва `'ai'`; viewer не може да `updatePlant` (както досега).
  - `tests/integration/import.test.ts:97`: очаква `{ name_source: 'legacy_ai' }` вместо `status/confirmed_at`.
  - `supabase/tests/database.test.sql`: махни двете проверки за `status`/`confirmed_at` (редове 39–44), добави `hasnt_column('public','plants','status')` и `hasnt_column('public','plants','confirmed_at')`; коригирай `plan(…)`.
  - `tests/e2e/flora.spec.ts`: тестът „…and confirms it“ става „…and sees the draft status“: без кликове „Потвърди“; на страницата се вижда текстът `Чернова`; зрителят не вижда бутон `Потвърди` (бутонът вече не съществува за никого) и POST към `?/unconfirm` дава 4xx (действието го няма). Сравнението от ред 169–170 става `select('name_bg, name_source')` → `{ name_bg:'Обикновена паричка', name_source:'manual' }`.
- [ ] **Step 2:** пусни unit + `db:reset && test:db` → FAIL.
- [ ] **Step 3: Имплементация:** миграцията (`alter table public.plants drop constraint plants_confirmed_consistency, drop column confirmed_at, drop column status;`); `npm run db:types`; `status.ts`; `StatusBadge.svelte` (стилът засега с текущите токени: пунктир/рамка/запълнено с `--accent`); `types.ts` маха `PlantStatus`; `plants.ts` селектира `id_status` и `name_source` изрично (ако типизираният select не приема `id_status`, кастни реда на една граница с коментар `// computed field id_status(plants)`); маха `setPlantStatus` и действията `confirm`/`unconfirm` и бутона; `PlantCard` и страницата на растение показват `StatusBadge` (на страницата с `explain`); каталогът ползва новите филтри с етикети `Всички · Чернови · Прието име · Потвърдени` (стойности `all/draft/ai_gbif/community`); `scripts/import/map.ts` задава `name_source: 'legacy_ai'`.
- [ ] **Step 4:** `npm run db:reset && npm run test:db && npm run test:unit && npm run test:integration && npm run check && npm run test:e2e` → PASS.
- [ ] **Step 5: Commit** `feat: computed verification status replaces self-confirmation`.

### Task 3: Договори и чисти клиенти за Pl@ntNet, GBIF, iNaturalist

**Files:**
- Create: `src/lib/identify/types.ts`, `src/lib/server/external/plantnet.ts`, `src/lib/server/external/gbif.ts`, `src/lib/server/external/inat.ts`
- Test: `tests/unit/identify-types.test.ts`, `tests/unit/plantnet.test.ts`, `tests/unit/gbif.test.ts`, `tests/unit/inat.test.ts`, fixtures в `tests/unit/fixtures/{plantnet-ok.json,gbif-match-accepted.json,gbif-match-synonym.json,gbif-species-accepted.json,gbif-match-higherrank.json,inat-obs.json}`

**Interfaces:**
- Consumes: `NameSource` от `$lib/status`; `UserFacingError` от `$lib/errors`.
- Produces (`src/lib/identify/types.ts`, без server-only импорти):
  - `export type Candidate = { scientific_name: string; authorship: string | null; family: string | null; genus: string | null; common_names: string[]; score: number; gbif_key: number | null }`
  - `export type IdentifyErrorCode = 'no_match' | 'quota' | 'not_configured' | 'upstream' | 'bad_request' | 'forbidden'`
  - `export type IdentifyOk = { ok: true; modelVersion: string | null; candidates: Candidate[] }`; `export type IdentifyFail = { ok: false; code: IdentifyErrorCode; message: string }`; `export type IdentifyResult = IdentifyOk | IdentifyFail`
  - `export const IDENTIFY_MESSAGES: Record<IdentifyErrorCode, string>` = `no_match: 'AI не разпозна растението. Попълни името сам.'`, `quota: 'Лимитът за разпознаване за днес е изчерпан.'`, `not_configured: 'AI разпознаването не е настроено.'`, `upstream: 'AI не отговори.'`, `bad_request: 'Снимките не можаха да се изпратят. Опитай пак.'`, `forbidden: 'Нямаш права за това действие.'`
  - `export function fail(code: IdentifyErrorCode): IdentifyFail`
  - `export const identificationSchema` (zod): `{ modelVersion: string max 100 | null, photoCount: int 1..5, candidates: array(candidateSchema) max 10, chosenIndex: int ≥ 0 | null }` с refine `chosenIndex === null || chosenIndex < candidates.length`; `export type IdentificationInput = z.output<typeof identificationSchema>`
  - `export function parseIdentificationField(raw: FormDataEntryValue | null): IdentificationInput | null` (празно/липсва → null; невалиден JSON или схема → null)
  - `export function sameName(a: string, b: string): boolean` (trim, сгъстени интервали, `toLocaleLowerCase('en')`)
  - `export function deriveNameSource(ident: IdentificationInput | null, submittedName: string, previous: { name: string; source: NameSource } | null): NameSource` — избран кандидат със `sameName` → `'ai'`; иначе ако `previous` и `sameName(previous.name, submittedName)` → `previous.source`; иначе `'manual'`.
- Produces (сървър):
  - `plantnet.ts`: `export function parsePlantNetResponse(json: unknown): { modelVersion: string | null; candidates: Candidate[] }` (най-много 5, по `score` низходящо, пропуска невалидни, `score` клампнат в [0,1]); `export async function identifyWithPlantNet(images: Blob[], apiKey: string, fetchFn: typeof fetch = fetch): Promise<IdentifyResult>` — 200 → ok (празни кандидати → `no_match`); 404 → `no_match`; 429 → `quota`; 401/403 → `not_configured`; друго/timeout/мрежа → `upstream`. Никога не включва ключа в съобщение или лог.
  - `gbif.ts`: `export type GbifCheck = { match: 'accepted' | 'synonym' | 'doubtful' | 'none'; key: number | null; acceptedKey: number | null; acceptedName: string | null }`; `export function mapGbifMatch(json: unknown): { match: GbifCheck['match']; key: number | null; acceptedKey: number | null; canonicalName: string | null }` (правилата от spec §7); `export async function checkNameWithGbif(name: string, fetchFn: typeof fetch = fetch): Promise<GbifCheck>` — при `synonym` прави втората заявка за `acceptedName`; мрежа/timeout/не-2xx → `throw new UserFacingError('Името не можа да се провери в GBIF.', detail)`.
  - `inat.ts`: `export function parseInatObservationId(input: string): number | null`; `export type InatObservation = { qualityGrade: 'research' | 'needs_id' | 'casual'; taxonName: string | null }`; `export async function fetchInatObservation(id: number, fetchFn: typeof fetch = fetch): Promise<InatObservation | null>` (празни `results` → null; непознат `quality_grade` → `'casual'`; мрежа/не-2xx → `UserFacingError('iNaturalist не отговори. Опитай пак.')`).

- [ ] **Step 1: Тестове (провал очакван)** с fixtures (реалистични JSON-и, написани по договора от spec §7):
  - `parsePlantNetResponse(plantnet-ok)` → 5 кандидата, първият `{ scientific_name:'Myosotis arvensis', authorship:'(L.) Hill', family:'Boraginaceae', genus:'Myosotis', score:0.62, gbif_key:5341258 }`, `modelVersion` от `version`; 7 резултата в JSON → 5 в изхода; резултат без `species` се пропуска.
  - `identifyWithPlantNet` с подменен `fetchFn`: проверява URL-а (точно Global Constraints, ключът е в query), метод POST, `FormData` с 2 `images` и 2 `organs=auto`; статус 404 → `{ok:false, code:'no_match'}`; 429 → `quota`; 401 → `not_configured`; `fetchFn` хвърля → `upstream`; message на грешка не съдържа ключа.
  - `mapGbifMatch`: accepted EXACT SPECIES → `accepted`; synonym → `synonym` с `acceptedKey`; `matchType:'FUZZY'` → `none`; `matchType:'HIGHERRANK'` → `none`; `rank:'GENUS'` EXACT → `none`; `DOUBTFUL` → `doubtful`.
  - `checkNameWithGbif('Myosotis scorpioides')` при synonym прави 2 заявки и връща `acceptedName` от втората; при 500 → `UserFacingError`; URL кодира името (`encodeURIComponent`).
  - `parseInatObservationId`: `'https://www.inaturalist.org/observations/123456'` → 123456; `'inaturalist.org/observations/1'` → null (без протокол и без www не минава — regex-ът го иска; провери го точно по regex-а); `'123'` → 123; `'https://inaturalist.org/observations/77/'` → 77; `'https://evil.com/observations/1'` → null; `'1234567890123'` → null.
  - `fetchInatObservation`: research → `{ qualityGrade:'research', taxonName:'Myosotis arvensis' }`; `{results:[]}` → null.
  - `identificationSchema`/`parseIdentificationField`: валиден → обект; `chosenIndex:5` при 2 кандидата → null; `'not json'` → null; `photoCount:6` → null.
  - `deriveNameSource`: кандидат `Myosotis arvensis` избран, подадено `' myosotis  ARVENSIS '` → `'ai'`; избран, но подадено `Myosotis sylvatica` → `'manual'`; без идентификация, previous `{ name:'Bellis perennis', source:'legacy_ai' }` и същото име → `'legacy_ai'`; сменено име → `'manual'`.
- [ ] **Step 2:** `npm run test:unit` → FAIL.
- [ ] **Step 3:** Имплементирай по Interfaces; `AbortSignal.timeout` със стойностите от Global Constraints.
- [ ] **Step 4:** `npm run test:unit && npm run check` → PASS.
- [ ] **Step 5: Commit** `feat: Pl@ntNet, GBIF and iNaturalist clients with typed contracts`.

### Task 4: `/api/identify` с квота

**Files:**
- Create: `src/lib/server/identify.ts`, `src/routes/api/identify/+server.ts`
- Test: `tests/integration/identify.test.ts`

**Interfaces:**
- Consumes: Task 3 `identifyWithPlantNet`, `fail`, `IdentifyResult`; Task 1 RPC `consume_identify_quota`; `Db` от `$lib/server/plants`.
- Produces: `export const IDENTIFY_MAX_FILES = 5; export const IDENTIFY_MAX_BYTES = 2 * 1024 * 1024;` `export async function handleIdentify(db: Db, files: unknown[], apiKey: string | undefined, fetchFn: typeof fetch = fetch): Promise<{ status: number; body: IdentifyResult }>`. Endpoint `POST /api/identify` (multipart `images`) → `json(body, { status })`.

- [ ] **Step 1: Integration тестове (провал очакван)** с локален Supabase (ползвай `ensureUser`/клиентите от `tests/helpers/supabase.ts`) и подменен `fetchFn`:
  - 0 файла или 6 файла → `400 bad_request`, `fetchFn` не е викан; файл `image/gif` → 400; файл > 2 MB → 400;
  - без ключ → `503 not_configured`, квотата **не** е консумирана;
  - зрител с ключ → `403 forbidden`, `fetchFn` не е викан;
  - редактор: успех → `200`, `ok:true`, кандидати; Pl@ntNet 404 → `200` с `code:'no_match'`; Pl@ntNet 429 → `429 quota`; `fetchFn` хвърля → `502 upstream`;
  - квотата: след като `api_usage` за редактора е зададен на 100 (през `adminClient`) → `429 quota`, `fetchFn` не е викан. Почисти `api_usage` за потребителя в `afterEach`.
- [ ] **Step 2:** `npm run test:integration -- identify` → FAIL.
- [ ] **Step 3:** Ред на проверките в `handleIdentify`: файлове (брой, тип, размер; `files` елементите трябва да са `Blob`) → ключ → `db.rpc('consume_identify_quota')` (грешка от RPC → 502 upstream с `console.error`; `false` → ако `is_editor` е false → 403 forbidden, иначе 429 quota — ползвай `db.rpc('is_editor')`) → Pl@ntNet. Статуси: ok/no_match 200, quota 429, not_configured 503, upstream 502, bad_request 400, forbidden 403. Endpoint: `requireEditor(locals)` първо, после `request.formData()` (грешка → 400), `env.PLANTNET_API_KEY` от `$env/dynamic/private`.
- [ ] **Step 4:** `npm run test:integration && npm run check` → PASS.
- [ ] **Step 5: Commit** `feat: /api/identify endpoint with daily quota`.

### Task 5: Проверка на името в GBIF, връзка с iNaturalist, „Доказателства“

**Files:**
- Create: `src/lib/server/verification.ts`, `src/lib/components/Evidence.svelte`
- Modify: `src/lib/server/plants.ts` (`getPlant` добавя `latestIdentification`), `src/routes/plants/[id]/+page.server.ts`, `src/routes/plants/[id]/+page.svelte`
- Test: `tests/integration/verification.test.ts`, `tests/e2e/flora.spec.ts`

**Interfaces:**
- Consumes: Task 3 `checkNameWithGbif`, `parseInatObservationId`, `fetchInatObservation`, `sameName`, `Candidate`; Task 2 `StatusBadge`, `statusView`.
- Produces:
  - `verification.ts`: `export async function refreshNameCheck(db: Db, plantId: string, scientificName: string, fetchFn?: typeof fetch): Promise<boolean>` (GBIF успех → записва `gbif_match, gbif_key, gbif_accepted_key, gbif_accepted_name, gbif_checked_at=now`, връща true; GBIF грешка → `console.error`, нищо не пише, връща false; грешка на базата → `UserFacingError`); `export async function useAcceptedName(db: Db, plantId: string, fetchFn?: typeof fetch): Promise<void>` (чете `gbif_accepted_name`; ако го няма → `UserFacingError('Няма прието име за смяна.')`; иначе `update scientific_name` + `name_source:'manual'` и `refreshNameCheck`); `export async function linkInat(db: Db, plantId: string, input: string, fetchFn?: typeof fetch): Promise<void>` (невалиден → `UserFacingError('Това не е линк към наблюдение в iNaturalist.')`; null от API → `UserFacingError('Наблюдението не е намерено.')`; иначе записва 4-те `inat_*`); `export async function unlinkInat(db: Db, plantId: string): Promise<void>`. Всички хвърлят `UserFacingError('Растението не е намерено или нямаш права да го променяш.')`, ако update засегне 0 реда.
  - `getPlant` → `PlantWithPhotos & { latestIdentification: { created_at: string; model_version: string | null; candidates: Candidate[]; chosen_index: number | null } | null }`.
  - Действия на `/plants/[id]`: `checkName`, `useAccepted`, `linkInat` (поле `inat`), `unlinkInat` — всяко с `requireEditor`, `UserFacingError` → `fail(400, { message })`.
  - `Evidence.svelte` props `{ plant: { scientific_name: string; id_status: IdStatus; name_source: NameSource; gbif_match: string | null; gbif_accepted_name: string | null; gbif_key: number | null; gbif_checked_at: string | null; inat_observation_id: number | null; inat_quality_grade: string | null; inat_taxon_name: string | null }; latest: {…} | null; isEditor: boolean; message?: string }`.

- [ ] **Step 1: Тестове (провал очакван):**
  - integration: `refreshNameCheck` с accepted fixture → ред с `gbif_match:'accepted'` и `id_status` остава `draft` без идентификация; след insert на идентификация с кандидат 0.62 → `ai_gbif`; `fetchFn` хвърля → връща false, `gbif_checked_at` остава null, растението съществува; `linkInat('https://www.inaturalist.org/observations/42')` с research fixture за същия вид → `id_status:'community'`; за друг вид → не е `community`; невалиден линк → `UserFacingError` с точния текст; `unlinkInat` → четирите колони null; зрител → `UserFacingError` за права; `useAcceptedName` при synonym → `scientific_name` = прието име.
  - e2e: на растението от предишните тестове редакторът вижда бутона `Провери името в GBIF` (GBIF не се вика в e2e — бутонът само се вижда) и полето `Линк към наблюдение в iNaturalist`; зрителят не вижда нито едното, но вижда заглавието `Доказателства`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Имплементация. `Evidence.svelte` показва `dl` с три реда: **AI** (последна идентификация: `Pl@ntNet · NN % · дата` за кандидата със `sameName` на текущото име, иначе `Pl@ntNet не предлага това име` или `няма`), **Име** (`GBIF · прието` / `GBIF · синоним на <em>X</em>` / `GBIF · съмнително` / `GBIF не намери точно това име` / `Името не е проверено в GBIF.`), **Общност** (`iNaturalist · Research Grade · <em>X</em>` като линк `https://www.inaturalist.org/observations/<id>` / `iNaturalist · <grade>` / `няма iNaturalist наблюдение`). Предупрежденията от spec §5 (синоним + бутон `Смени на <X>`; iNaturalist за друг вид; AI предлага друг вид, когато топ кандидатът ≥ 0.30 не е `sameName` на текущото име). За редактор: форми за `checkName` (бутон `Провери името в GBIF`), `linkInat` (input с label `Линк към наблюдение в iNaturalist`, бутон `Свържи`), `unlinkInat` (бутон `Премахни връзката`). Линк към GBIF: `https://www.gbif.org/species/<gbif_accepted_key ?? gbif_key>`.
- [ ] **Step 4:** `npm run test:integration && npm run test:e2e && npm run check` → PASS.
- [ ] **Step 5: Commit** `feat: GBIF name check, iNaturalist link and evidence panel`.

### Task 6: AI панел в добавяне и редакция

**Files:**
- Create: `src/lib/identify/client.ts`, `src/lib/components/AiSuggestions.svelte`
- Modify: `src/lib/components/PlantForm.svelte` (`values` става `$bindable`), `src/routes/plants/new/+page.svelte`, `src/routes/plants/new/+page.server.ts`, `src/routes/plants/[id]/edit/+page.svelte`, `src/routes/plants/[id]/edit/+page.server.ts`, `src/lib/server/plants.ts` (`insertIdentification`)
- Test: `tests/unit/identify-client.test.ts`, `tests/integration/plants.test.ts`, `tests/e2e/flora.spec.ts`, `tests/e2e/fixtures/identify-ok.json`

**Interfaces:**
- Consumes: Task 3 типове/`parseIdentificationField`/`deriveNameSource`/`IDENTIFY_MESSAGES`; Task 2 `createPlant`/`updatePlant` с `nameSource`; Task 5 `refreshNameCheck`; `fitWithin` от `$lib/photos/process`.
- Produces:
  - `client.ts`: `export const IDENTIFY_MAX_EDGE = 1024; export const IDENTIFY_QUALITY = 0.8;` `export async function toIdentifyJpeg(source: Blob): Promise<Blob>` (createImageBitmap с `imageOrientation:'from-image'` → canvas `fitWithin(…,1024)` → `image/jpeg` 0.8; затваря bitmap-а; грешка → `UserFacingError(IDENTIFY_MESSAGES.bad_request)`); `export async function requestIdentification(images: Blob[], fetchFn: typeof fetch = fetch): Promise<IdentifyResult>` (POST `/api/identify`, `redirect: 'manual'`; JSON с `ok` → върни го; 401/403/opaqueredirect → `fail('forbidden')`; друго/мрежа → `fail('upstream')`); `export async function prepareImages(sources: Blob[], convert: (b: Blob) => Promise<Blob> = toIdentifyJpeg): Promise<Blob[]>` (първите 5 източника; пропуска провалените с `console.warn`; връща успешните); `export function latestOnly<A extends unknown[], R>(fn: (...args: A) => Promise<R>): (...args: A) => Promise<{ stale: boolean; value: R }>` (по-стар отговор се маркира `stale: true`).
  - `AiSuggestions.svelte` props `{ sources: Blob[]; runKey: number; onpick: (candidate: Candidate, index: number) => void; onresult: (result: IdentifyOk | null) => void; pickedIndex: number | null }`; пуска разпознаване при всяка смяна на `runKey` > 0: `prepareImages(sources)` → ако `[]` → грешка `bad_request` без заявка; иначе `requestIdentification` през `latestOnly` (stale резултати се игнорират); състояния `idle | loading | ok | error`; бутон `Опитай пак` при `upstream`/`bad_request`; показва атрибуцията.
  - `insertIdentification(db: Db, plantId: string, ident: IdentificationInput): Promise<void>` в `plants.ts` (мапва към колоните `model_version, photo_count, candidates, chosen_index`).
  - Форми: скрито поле `identification` (JSON на `IdentificationInput`) в new и edit.

- [ ] **Step 1: Тестове (провал очакван):**
  - unit: `requestIdentification` — 200 JSON ok → същият обект; 429 JSON quota → `code:'quota'`; `fetchFn` хвърля → `upstream`; `{ type:'opaqueredirect', status:0 }` → `forbidden`. `latestOnly`: две извиквания, първото се resolve-ва второ → първото `stale:true`, второто `stale:false`. `prepareImages` с convert, който хвърля за всички → `[]`; за 1 от 3 → 2 blob-а; 7 източника → convert е викан 5 пъти. (`toIdentifyJpeg` не се unit-тества — изисква canvas; покрито от e2e.)
  - integration: създаване през `createPlant(…,'ai')` + `insertIdentification` с кандидат 0.62 + ръчно задаване на GBIF колоните (през `refreshNameCheck` с fixture `fetchFn`) → `id_status:'ai_gbif'`.
  - e2e (`page.route('**/api/identify', …)` връща `identify-ok.json` с кандидати `Bellis perennis` 0.71 и `Bellis sylvestris` 0.12): ново растение → избор на `leaf-a.jpg` в полето `Снимки` → вижда се `Bellis perennis` и `71 %` и текстът `Разпознаването използва Pl@ntNet API.` → клик върху кандидата → полето `Латинско име` има `Bellis perennis` → попълва `Българско име` `Паричка` → `Запази растението` → на страницата на растението се вижда `AI чернова` (GBIF не е наличен в e2e → draft с `name_source:'ai'`), а в базата има 1 ред в `identifications` с `chosen_index: 0`. Втори e2e: route връща 503 `not_configured` → вижда се `AI разпознаването не е настроено.` и растението пак се записва.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Имплементация:**
  - `/plants/new`: полето за снимки (label `Снимки`) е над формата; при смяна: `selected = files`, `runKey++`. `AiSuggestions` над `PlantForm`. `onpick` задава `values.scientific_name` и `values.family` (ако кандидатът има семейство) и `pickedIndex`. `onresult` пази `IdentifyOk` за скритото поле (без `ok:true` → поле празно). Действието: `parseIdentificationField(form.get('identification'))` → `deriveNameSource(ident, parsed.data.scientific_name, null)` → `createPlant` → `insertIdentification` (само ако има ident с ≥1 кандидат; грешка тук → `console.error`, записът продължава) → `refreshNameCheck` (резултатът се игнорира). Качването на снимки остава след записа както досега.
  - `/plants/[id]/edit`: `AiSuggestions` над `PlantForm`; `PhotoUploader.onsettled` при `done ≥ 1` → `invalidateAll()` и после стартира разпознаване с до 5 снимки на растението (най-новите първо), взети през `fetch(photo.url)` на оптимизираната версия (добави `url` към `load` — signed URL на `photo.path`) и `toIdentifyJpeg`; бутон `Разпознай по снимките` прави същото ръчно (скрит, ако няма снимки). Действието `update`: `deriveNameSource(ident, newName, { name: oldName, source: oldSource })` (зареди старите стойности с `getPlant`) → `updatePlant(…, nameSource)` → `insertIdentification` (ако има) → `refreshNameCheck`, само ако `!sameName(oldName, newName)` или идентификация е подадена.
- [ ] **Step 4:** `npm run test:unit && npm run test:integration && npm run test:e2e && npm run check` → PASS.
- [ ] **Step 5: Commit** `feat: automatic Pl@ntNet suggestions when adding and editing`.

### Task 7: Тъмна визия, каталог по 6/12, хербарен лист

**Files:**
- Create: `src/lib/components/Pagination.svelte`
- Modify: `src/app.html` (Google Fonts), `src/app.css`, `src/routes/+layout.svelte`, `src/routes/+page.svelte`, `src/routes/+page.server.ts` (ако трябва), `src/lib/components/PlantCard.svelte`, `src/lib/components/StatusBadge.svelte`, `src/routes/plants/[id]/+page.svelte`, `src/lib/components/Evidence.svelte`, `src/lib/components/Gallery.svelte`, `src/lib/components/AiSuggestions.svelte`, `src/routes/plants/new/+page.svelte`, `src/routes/login/+page.svelte`
- Test: `tests/e2e/flora.spec.ts`

**Interfaces:**
- Consumes: Task 2 `paginate`, `parseCatalogParams`, `PAGE_SIZES`; всички компоненти от Task 2–6.
- Produces: `Pagination.svelte` props `{ page: number; pages: number; size: PageSize; href: (p: number, n: PageSize) => string }` — рендерира `nav aria-label="Страници"` с превключвател `6 / 12` (линкове с `aria-current` на активния) и номера на страници (линкове, текущата с `aria-current="page"`); скрива номерата при `pages === 1`.

- [ ] **Step 1: e2e тестове (провал очакван):** в нов `describe` създай 13 растения през `adminClient` (имена `Тест 01`…`Тест 13`, `scientific_name` `Testus 01`…, собственик — редакторът), после: `/?n=6` → 6 карти и линк `2` с `aria-current` липсващ; клик `3` → 1 карта и URL съдържа `p=3`; клик `12` → 12 карти и URL `n=12`; търсене `Тест 13` → 1 карта и URL без `p=` (или `p=1`); `/?p=99` → показва последната страница без грешка. `body` има изчислен фон `rgb(14, 23, 20)`. Изтрий тестовите растения в `afterAll`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Имплементация по spec §9:**
  - `app.html`: `<link rel="preconnect" href="https://fonts.googleapis.com">`, `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`, stylesheet `https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,500;0,7..72,600;1,7..72,500&family=Onest:wght@400;500;600&display=swap`; `<meta name="theme-color" content="#0e1714">`.
  - `app.css`: замени двете палитри с една тъмна (`color-scheme: dark`): `--bg:#0e1714; --surface:#16221e; --surface-2:#1d2b26; --text:#e6ede8; --muted:#93a39b; --border:#26352f; --accent:#d9bf6a; --accent-contrast:#1a1606; --danger:#ff8a80; --danger-contrast:#1a0d0d; --warn-bg:#3a3112; --warn-text:#f4dc8f; --font-display:'Literata', Georgia, serif; --font-body:'Onest', system-ui, sans-serif; --radius:14px`. `em, .latin` → `font-family: var(--font-display); font-style: italic`. Заглавия → `--font-display`.
  - Каталог: търсенето и чиповете обновяват URL с `goto(…, { replaceState: true, keepFocus: true, noScroll: true })` и нулират `p`; състоянието се чете от `page.url` чрез `parseCatalogParams`; решетка `repeat(2,1fr)` → `@media (min-width:640px)` 3 → `@media (min-width:1024px)` 4; `Pagination` под решетката.
  - `PlantCard`: снимка 3:4 с градиент отдолу и текстът върху нея (бг име, латинско курсив, `StatusBadge`); без снимка → повърхност с текста.
  - `StatusBadge`: `draft` = пунктирана рамка `--muted`, празен кръг; `ai_gbif` = рамка `--accent`, полукръг; `community` = фон `--accent`, текст `--accent-contrast`, плътен кръг.
  - Страница на растение: `article.sheet` (фон `--surface`, вътрешен отстъп, лека сянка) → основната снимка (бутон към галерията) → `div.specimen-label` с рамка 1px `--text`: семейство (главни, `letter-spacing:.12em`, малък), латинско име (курсив, 1.6rem), бг име, ред `det.: …` → печат вдясно (кръг 72px, рамка `--accent`, завъртян −8°, текст = етикета на статуса). После `Evidence`, действия, миниатюри на останалите снимки, текстове, `LegacyAiPanel`.
  - Добавяне: лента със снимки (4 колони квадратни миниатюри на избраните файлове чрез `URL.createObjectURL`, освобождавани при смяна/унищожаване), `AiSuggestions` като `.box` с кандидати (латинско курсив, %, линия `--accent`, избраният с рамка `--accent`).
  - Без промяна на поведението, извън описаното; съществуващите e2e продължават да минават.
- [ ] **Step 4:** `npm run check && npm run test:unit && npm run test:e2e` → PASS. Направи по 1 screenshot на Pixel 7 за `/`, растение и `/plants/new` (Playwright, временен скрипт в scratchpad, не се commit-ва) и ги прегледай за препълване/нечетим текст.
- [ ] **Step 5: Commit** `feat(ui): dark herbarium redesign with 6/12 catalog pages`.

### Task 8: Документация и конфигурация

**Files:**
- Modify: `.env.example`, `README.md`, `docs/STATUS-2026-10-02.md`

- [ ] **Step 1:** `.env.example` добавя `# Server-only. Pl@ntNet key from my.plantnet.org (never PUBLIC_).` и `PLANTNET_API_KEY=`. README: раздел „AI разпознаване“ — регистрация, ключ във Vercel като `PLANTNET_API_KEY` (Production), лимити (100 на ден в приложението, 500 при Pl@ntNet), атрибуция, ред за прилагане на двете миграции през SQL Editor (с проверката `select count(*) from public.plants where status = 'confirmed'` = 0 преди втората) и връщане назад. STATUS: кратък раздел за клона, задачите и тестовете.
- [ ] **Step 2:** `npm run check && npm run build` → PASS.
- [ ] **Step 3: Commit** `docs: AI identification setup and migration rollout`.
