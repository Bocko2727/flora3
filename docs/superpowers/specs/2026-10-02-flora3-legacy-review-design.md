# Флора 3 — преглед на старите растения: дизайн

**Дата:** 2026-10-02 · **Статус:** чака преглед от собственика
**Цел:** 96-те стари растения със снимка да минат през Pl@ntNet и GBIF. Собственикът потвърждава с едно докосване съвпаденията, решава несъвпаденията и получава описания на български от Уикипедия с източник. Без Gemini и без генеративен AI. $0.

## Какво каза собственикът
- Pl@ntNet се пуска еднократно върху основната снимка на всяко старо растение, като пакет от браузъра (подход 1).
- Нищо не се приема без негово докосване. Съвпаденията се приемат по едно или наведнъж с „Приеми всички“ и потвърждение.
- При несъвпадение има два избора: „Смени с този“ (кандидат) или „Остави старото“ (маркирано).
- Българското име и описанието идват от Wikidata и bg.wikipedia, семейството — от GBIF.
- Gemini и генеративен AI отпадат. „Как да ги различа?“ е извън обхвата.

## Факти от кода
- При пренасянето `description` и `habitat` са `null`. Старият AI текст е в `plants.legacy_ai` (панел „AI чернова“). `name_bg` = `legacy.common_name`, `name_source = 'legacy_ai'`.
- Вече съществуват:
  - `/api/identify` — Pl@ntNet, квота 100 на ден;
  - `insertIdentification`;
  - `refreshNameCheck` — GBIF;
  - `toIdentifyJpeg` — 1024 px в браузъра;
  - `externalFetch` — изключва се с `FLORA_OFFLINE_EXTERNAL`.
- `id_status` сега брои **всеки** кандидат ≥ 0.30 със същото име, дори неизбран. Това трябва да се затегне, иначе пакетът сам вдига статуси.

## 1. Данни (една миграция `legacy_review`)

**`identifications`:**
- `source text not null default 'manual' check (source in ('manual','review'))`;
- `decision text check (decision in ('match','changed','kept'))` — `null` = чака преглед. Важи само за `source='review'`; ръчните редове остават `null`;
- `wiki jsonb` — предложение от Уикипедия за името, с което е подготвен редът: `{ name_bg, extract, url, title }` или `null`;
- `create unique index identifications_one_review on identifications (plant_id) where source = 'review'` — пакетът е идемпотентен;
- RLS политика `update` за редактора на собствените му редове. `grant update (chosen_index, decision) to authenticated`. Зрителите нямат права.

**`plants`:**
- `description_source text check (description_source in ('wikipedia','manual'))` — `null` = няма описание;
- `wiki_url text check (char_length(wiki_url) <= 500)`;
- `grant insert, update (description_source, wiki_url) to authenticated`.

**`id_status` (затегнато):** `ai_gbif` изисква:
- идентификация с `chosen_index is not null`;
- кандидатът на `chosen_index` е ≥ 0.30;
- ключът му в GBIF ∈ (`gbif_key`, `gbif_accepted_key`) или името му = `scientific_name`;
- `gbif_match in ('accepted','synonym')`.

Правилото за `community` не се променя.

Растението, добавено от телефона, има `chosen_index = 0`, затова статусът му не се променя. Растенията с ред `review` и `decision = null` остават `draft`.

**Редакцията на ръка:** ако описанието се промени, `description_source = 'manual'`. Ако се изтрие, става `null`.

## 2. Сървър

**`src/lib/server/external/wiki.ts`:** `findWiki(gbifKey: number, fetchFn): Promise<WikiInfo | null>`.
1. Wikidata `action=query&list=search&srsearch=haswbstatement:P846=<key>` → първи QID.
2. `wbgetentities&ids=<QID>&props=labels|sitelinks&languages=bg&sitefilter=bgwiki` → `name_bg` (етикет bg) и `title` (bgwiki).
3. Ако има `title`: `https://bg.wikipedia.org/api/rest_v1/page/summary/<title>` → `extract` (до 1500 знака), `url` (content_urls.desktop.page).

Детайли:
- Ако няма QID, връща `null`.
- Ако няма статия: `{ name_bg, extract: null, url: null, title: null }`.
- `User-Agent: Flora3/1.0 (personal botanical catalog)`. Таймаут 8 s през `externalFetch`.
- При грешка → `null`. Пише се в лога, без да спира процеса.

**`gbif.ts`:** `GbifCheck` получава и `family: string | null` от полето `family` в match отговора.

**`src/lib/server/review.ts`:**
- `prepareReview(db, plantId, ident: { modelVersion, photoCount, candidates }, fetchFn)`:
  - вмъква ред `source='review'`, `decision=null`, `chosen_index=null`;
  - при unique конфликт връща `'exists'`;
  - после `refreshNameCheck` за сегашното име и `findWiki(gbif_accepted_key ?? gbif_key)`;
  - wiki резултатът се записва в `identifications.wiki`.
- `classify(plant, candidates): ReviewKind` — чиста функция:
  - `{ kind: 'match', index }` — първият кандидат ≥ 0.30 със същия ключ в GBIF или име;
  - `{ kind: 'weak', index, score }` — същото име, но < 0.30;
  - `{ kind: 'mismatch', sameGenus: number[] }` — индексите на кандидатите от същия род;
  - `{ kind: 'none' }` — 0 кандидати.
- `decideMatch(db, identId, index, opts: { useWikiName: boolean; useWikiText: boolean })`:
  - `chosen_index=index`, `decision='match'`;
  - по избор `name_bg` ← wiki и `description` ← extract (`description_source='wikipedia'`, `wiki_url`).
  - Сървърът проверява с `classify`, че индексът наистина е съвпадение.
- `decideChange(db, identId, index, opts: { nameBg: string | null; useWikiText: boolean }, fetchFn)`:
  - `scientific_name` ← кандидатът; `family` ← семейството от GBIF за новото име или това на кандидата; `name_source='ai'`;
  - `name_bg` ← `opts.nameBg` или, ако няма такова, латинското име;
  - `description` ← wiki extract за новия ключ, само при `useWikiText`; иначе `null`. `habitat = null`. `notes` не се пипат. `legacy_ai` не се пипа;
  - `chosen_index=index`, `decision='changed'`, после `refreshNameCheck` за новото име.
- `decideKeep(db, identId)` → `decision='kept'`.

**Endpoints и actions:**
- `POST /api/review/prepare` (editor) — тяло `{ plantId, modelVersion, photoCount, candidates }`, валидирано като `/api/identify` отговор. Отговори:
  - 200 `{ status: 'prepared' | 'exists' }`;
  - 400 при невалиден вход;
  - 403 за зрител.
- `GET /api/review/wiki?key=<gbifKey>` (editor) → `WikiInfo | null` и `family` от GBIF. Ползва се при „Смени с този“.
- `/review` (+page.server.ts, само editor; зрителят получава 404):
  - `load` връща реда `review` с `decision=null`, `classify`, миниатюра и подписан URL на основната снимка;
  - и броячи: подготвени / за подготовка (стари растения със снимка и без `review` ред) / решени.
  - Actions: `match`, `matchAll` (списък identId; сървърът пропуска всичко, което `classify` не дава като `match`), `change`, `keep`.

## 3. Екран „За преглед“ (`/review`)

- В каталога има линк „За преглед (N)“, само за редактора, където N = нерешени съвпадения и несъвпадения (групата „Без резултат“ не се брои: там решение не се иска). Зрителят не го вижда.

**Подготовка:**
- Ред „Подготвени X от Y“ и бутон „Подготви прегледа“.
- Цикъл в браузъра, едно растение по ред:
  1. подписан URL → `toIdentifyJpeg`;
  2. `requestIdentification`;
  3. `POST /api/review/prepare`.
- Ако Pl@ntNet не е разпознал растението (`no_match`), се записва ред с 0 кандидата, за да не се пита отново. Влиза в група „Без резултат“.
- При `upstream` и при неуспешно зареждане на снимка нищо не се записва. Растението се брои като „пропуснато“ и при следващото пускане се опитва пак.
- `quota` → спира с „Лимитът за днес е изчерпан. Продължи утре — ще започне от там, докъдето е стигнало.“
- `forbidden` → спира, линк към вход.
- Лента `aria-live`, бутон „Спри“. Без паралелни заявки. Списъкът се обновява накрая (`invalidateAll`).

**Групи (в този ред):**
1. **„Не съвпадат“** (`mismatch`, `weak`): снимка, старо име, до 3 кандидата с %, семейство и етикет „същият род“.
   - „Смени с този“ → отваря панел:
     - предложение от `/api/review/wiki`: българско име (поле с предложението), описание (откъс + „Из Уикипедия“ + линк) и семейство от GBIF;
     - отметки „Ползвай българското име“ и „Добави описанието“;
     - „Запиши смяната“.
   - „Остави старото“ → `kept`. На страницата на растението се показва „Pl@ntNet не потвърди това име“.
2. **„Съвпадат“** (`match`): снимка, име, % на съвпадащия кандидат, предложение от Уикипедия (ако има) и бутон „Съвпада“. Отметка „Добави описанието от Уикипедия“, включена по подразбиране, ако има extract. Българското име се сменя само с отделна отметка „Ползвай името от Уикипедия: …“, когато е различно.
   - Горе: „Приеми всички N съвпадения“ → потвърждение „N растения ще се маркират като съвпадащи. Описания от Уикипедия ще се добавят на M от тях. Имената не се сменят.“ → `matchAll`.
3. **„Без резултат“** (`none`): снимка, старо име, „Pl@ntNet не разпозна растението“. Растението остава чернова. Решение не се иска.

Изглед:
- Тъмната визия, мобилен изглед първо, бутони ≥ 44 px.
- Атрибуции: „Разпознаване: Pl@ntNet API“ и „Текст: Уикипедия, CC BY-SA 4.0“ с линк към статията.

**Страница на растение:**
- Ако `description_source='wikipedia'`, под описанието има „Из Уикипедия“ + линк.
- `decision='kept'` се показва в блока „Доказателства“.

## 4. Грешки, сигурност, ограничения

- **GBIF недостъпен:** предложението се записва. Името остава непроверено, а „Съвпада“ записва решението. Статусът се вдига по-късно с „Провери името в GBIF“. Екранът го казва.
- **Wikidata/Wikipedia недостъпни или няма статия:** показва се „Няма статия в българската Уикипедия“. Нищо не се попълва.
- **Две подготовки едновременно:** уникалният индекс пази от двоен ред. Втората заявка към Pl@ntNet може да изхарчи 1 квота. Това е приемливо.
- **Сигурност:**
  - всички endpoints и actions минават през `requireEditor`;
  - сървърът валидира `identId` чрез собственост (RLS + owner check) и наново проверява `classify`;
  - зрителят не вижда `/review` и няма UPDATE.
- **Ботаническа честност:** нищо не става „потвърдено“. „AI · прието име“ = избран кандидат на Pl@ntNet ≥ 30 % + прието име в GBIF. Текстът от Уикипедия е с източник и етикет, без твърдения за токсичност.
- **Квота:** 96 растения ≤ 100 на ден. Днес вече е изхарчена 1.

## 5. Тестове

- **pgTAP:**
  - `id_status` не дава `ai_gbif` без `chosen_index`, дава го с избран кандидат;
  - уникален `review` ред на растение;
  - редакторът обновява само `chosen_index` и `decision`, не и `candidates`;
  - зрителят не може да обновява;
  - grants на новите колони.
- **Unit:**
  - `classify`: match по ключ, match по име без ключ, weak 0.29, mismatch с еднакъв род, none;
  - `findWiki` с fixture-и (няма QID, няма bgwiki, пълен резултат, грешка → null);
  - `mapGbifMatch` дава `family`.
- **Integration:**
  - `prepareReview` е идемпотентен (`exists`);
  - `decideMatch` вдига статуса до `ai_gbif`, когато GBIF е `accepted`, и записва описанието при `useWikiText`;
  - `decideChange` сменя името, изчиства описанието, не пипа `notes` и `legacy_ai`;
  - `decideKeep`;
  - зрителят получава 403 и 404.
- **E2E** (`page.route` за `/api/identify`, външните API изключени, GBIF/wiki полета зададени с admin):
  - подготовка на 3 растения → 3 групи;
  - „Приеми всички“;
  - „Смени с този“ и „Остави старото“;
  - зрителят не вижда линка;
  - квота → съобщение и стоп.

## 6. Пускане

1. Код на `feat/legacy-review`, PR и merge от собственика.
2. Миграцията `legacy_review` в хоста с `apply_migration`, след „Одобрявам: миграция legacy_review“. Тя е адитивна, освен затягането на `id_status`. Проверка с четене: 97 стари растения, всички `draft`; растението от телефона пак е със същия статус.
3. Пакетът: собственикът натиска „Подготви прегледа“ след „Одобрявам: пакетно разпознаване 96 растения“ (§5.10). Проверка с четене: 96 реда `review`, `api_usage` ≤ 100.
4. Прегледът: собственикът, от телефона.

**Rollback:** обратна миграция:
- `drop index`, `drop column` за новите колони;
- старата версия на `id_status`;
- `drop policy`.

Плюс Instant Rollback във Vercel. Пакетните редове се трият с `delete from identifications where source='review'`.

## Извън обхвата
- „Как да ги различа?“ и всякакъв генеративен AI.
- Описания от Уикипедия за растения извън прегледа. Това става с отделен бутон по-късно, ако потрябва.
- Пренасяне на текста от `legacy_ai` в полетата.
- Растения без снимка (*Cistus*).
