# Флора 3 — AI предложение, статуси на проверка и нова визия (spec)

Дата: 2026-10-02 · Статус: дизайнът е одобрен в разговор („Одобрявам всичко“), spec-ът е записан за преглед в края
Предишен spec: `2026-10-01-flora3-design.md` (остава валиден, освен където този го сменя)

## 1. Цел и обхват

Три свързани промени в един дизайн:

1. **AI предложение при качване на снимка.** Pl@ntNet се пуска автоматично. Показва 3–5 кандидата с увереност. Нищо не се записва без „Запази“.
2. **Статуси на проверка.** Три нива, които базата изчислява от доказателства. AI резултат никога не се показва като потвърден факт.
3. **Нова визия.** Цялото приложение е тъмно. Каталогът се показва на страници по 6 или 12 растения, а страницата на растение е като хербарен лист.

**Успех:**
- Собственикът добавя растение от телефона: избира снимки, след няколко секунди вижда кандидати, докосва един и записва.
- Зрителят вижда статусите, но не и бутоните за писане.
- 0 AI резултата се показват като „потвърдено“.
- Разходът остава $0.

**Не влиза:**
- Vercel Authentication и достъпът на приятелката;
- масово разпознаване на старите 97 растения;
- офлайн режим;
- светла тема;
- регионален Pl@ntNet проект;
- български имена от Pl@ntNet (вж. §11).

## 2. Решения

| Решение | Защо | Цена, ако е грешно |
|---|---|---|
| Pl@ntNet се пуска **автоматично** при качване. Снимките от едно качване (до 5) отиват в 1 заявка | Изборът на собственика (вариант A). Няколко снимки на едно растение дават по-точен резултат и броят 1 идентификация | Повече заявки. Лимитът е 500 на ден, а нашата граница е 100 |
| Pl@ntNet се вика от **SvelteKit endpoint** (`/api/identify`, Vercel fra1) | Ключът остава на сървъра. Edge Function добавя още едно място за deploy | — |
| Браузърът праща **JPEG копие с най-дълга страна 1024 px и качество 0,8** | Около 200 KB на снимка, далеч под лимита на Vercel (4,5 MB). Оригиналът не напуска телефона | По-ниска точност от пълен размер. Решава се с една константа |
| Статусът е **изчислено поле** `id_status(plants)` (PostgREST computed field), не колона | Не може да се разминава с доказателствата и няма тригери за синхрон | Изчислява се при всяко четене. При 100 растения е пренебрежимо |
| **Средно ниво „AI · прието име“** = кандидат на Pl@ntNet с ≥ 0,30 за същия вид **и** GBIF казва „прието“ или „синоним“ | GBIF е справочник за имена, не втора идентификация. Етикетът казва точно това | Прагът се сменя с една константа в SQL |
| **Махаме `status`/`confirmed_at`** („потвърдено от мен“) | Собственикът каза, че не може да проверява сам. „Потвърдено“ идва само от общността | Растение, което той познава със сигурност, остава най-много „прието име“ |
| GBIF приема само **`matchType = EXACT`** на ниво вид или по-ниско | FUZZY може тихо да вземе друг вид при печатна грешка | Печатна грешка дава „не е намерено“ и собственикът поправя името |
| **iNaturalist:** собственикът поставя линк, сървърът чете публичното API | Без ключ, само четене, без копиране на снимки | — |
| **Защита на лимита:** брояч в базата, 100 разпознавания на потребител на ден | Грешка в кода не може да изгори 500-те безплатни заявки | — |
| **Тъмна тема само**, шрифтове Literata (заглавия и латински имена) + Onest (текст) през Google Fonts | Изборът на собственика: „цялото приложение тъмно, като C“. И двата шрифта имат кирилица | Външна заявка за шрифт. Ако се замени, губим само вида |
| Каталог: **страници по 6 или 12** (12 по подразбиране), състоянието е в URL | Изрично искане | — |
| Страница на растение: **хербарен лист** (вариант B) в тъмните цветове на C | Тълкувание на „като на втората снимка“ | Преработка само на тази страница |

## 3. Архитектура

```
Браузър
  ├─ избор на снимки → копия 1024 px JPEG → POST /api/identify (FormData images[])
  │                                      └─ сървър: editor? → consume_identify_quota() → Pl@ntNet → кандидати
  ├─ избор на кандидат → попълва полетата (само в браузъра)
  └─ „Запази“ → form action: createPlant/updatePlant
                  → identifications (кандидатите + избора)
                  → GBIF species/match → gbif_* колони (при грешка: не спира записа)
Страница на растение (редактор): ?/checkName (GBIF отново), ?/linkInat, ?/unlinkInat, ?/useAccepted
```

- Външните заявки са на сървъра, с timeout: Pl@ntNet 15 s, GBIF 5 s, iNaturalist 5 s.
- `PLANTNET_API_KEY` е в `$env/dynamic/private`. Ако липсва, `/api/identify` връща 503 `not_configured`, а UI-ят казва „AI разпознаването не е настроено“. Записът работи и без ключ.
- Атрибуция: под кандидатите пише „Разпознаването използва Pl@ntNet API.“ (изискване на условията им). Линк към GBIF стои до статуса на името, а линк към наблюдението до iNaturalist.

## 4. Модел на данните

Миграция `20261004090000_identification_status.sql`:

```sql
alter table public.plants
  add column name_source text not null default 'manual'
    check (name_source in ('manual', 'ai', 'legacy_ai')),
  add column gbif_match text check (gbif_match in ('accepted', 'synonym', 'doubtful', 'none')),
  add column gbif_key bigint,
  add column gbif_accepted_key bigint,
  add column gbif_accepted_name text check (char_length(gbif_accepted_name) <= 200),
  add column gbif_checked_at timestamptz,
  add column inat_observation_id bigint check (inat_observation_id > 0),
  add column inat_quality_grade text check (inat_quality_grade in ('research', 'needs_id', 'casual')),
  add column inat_taxon_name text check (char_length(inat_taxon_name) <= 200),
  add column inat_checked_at timestamptz;

update public.plants set name_source = 'legacy_ai' where legacy_ai is not null;

create table public.identifications (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id),
  provider text not null default 'plantnet' check (provider = 'plantnet'),
  model_version text check (char_length(model_version) <= 100),
  photo_count integer not null check (photo_count between 1 and 5),
  candidates jsonb not null check (jsonb_typeof(candidates) = 'array' and jsonb_array_length(candidates) <= 10),
  chosen_index integer check (chosen_index >= 0),
  created_at timestamptz not null default now()
);

create table public.api_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);
```

Кандидат в `candidates`: `{ "scientific_name", "authorship", "family", "genus", "common_names": [..], "score": 0..1, "gbif_key": int|null }`.

**Изчисляем статус:**

```sql
create function public.id_status(p public.plants) returns text
language sql stable set search_path = '' as $$
  select case
    when p.inat_quality_grade = 'research'
     and lower(p.inat_taxon_name) = lower(coalesce(p.gbif_accepted_name, p.scientific_name))
      then 'community'
    when p.gbif_match in ('accepted', 'synonym') and exists (
      select 1 from public.identifications i, jsonb_array_elements(i.candidates) c
      where i.plant_id = p.id
        and (c->>'score')::numeric >= 0.30
        and ( (c->>'gbif_key')::bigint in (p.gbif_key, p.gbif_accepted_key)
           or lower(c->>'scientific_name') = lower(p.scientific_name) ))
      then 'ai_gbif'
    else 'draft'
  end
$$;
```

**Квота:** `consume_identify_quota()` е `security definer` и прави следното:
- брои за `auth.uid()` в UTC деня;
- връща `true`, ако след увеличението броят е ≤ 100;
- иначе връща `false` и не увеличава;
- само `is_editor()` може да я ползва, другите получават `false`.

Таблицата `api_usage` няма права за `authenticated`.

**Права и RLS:**
- `identifications`:
  - SELECT за authenticated;
  - INSERT само ако `is_editor()` и `owner_id = auth.uid()` и растението е негово;
  - няма UPDATE и DELETE от клиента (протоколът е неизменим);
  - изтрива се каскадно с растението.
- Новите колони на `plants` се дават на `authenticated` за insert/update по колони, както досега, с изключение на `name_source` при update. Той се сменя само от сървърното действие, но и то минава през сесията. Затова и `name_source` е в update grant-а. Заплахата е случайна грешка, не злонамерен редактор (има само един).

Втора миграция `20261004100000_drop_self_confirm.sql`:
- `drop constraint plants_confirmed_consistency`;
- `drop column confirmed_at`;
- `drop column status`.

Преди прилагането в продукция се проверява само с четене, че `count(*) where status = 'confirmed'` е 0.

## 5. Статуси в UI

| `id_status` | Етикет | Форма | Обяснение под етикета |
|---|---|---|---|
| `draft` и `name_source ∈ {ai, legacy_ai}` | AI чернова | пунктирана рамка, празен кръг | „Предложено от AI. Не е проверено от човек.“ |
| `draft` и `name_source = manual` | Чернова | пунктирана рамка | „Въведено ръчно. Не е проверено.“ |
| `ai_gbif` | AI · прието име | плътна рамка, полукръг | „Името е валидно според GBIF. Видът е предложен от AI и не е потвърден от човек.“ |
| `community` | Потвърдено · iNaturalist | запълнен | „Наблюдение с Research Grade в iNaturalist за същия вид.“ |

**Предупреждения на страницата на растение:**
- GBIF казва синоним: „GBIF: синоним на *X*“ + бутон „Смени на *X*“ (само за редактор).
- iNaturalist е Research Grade, но за друг вид: „iNaturalist потвърждава *Y*, а тук пише *X*.“
- Последното разпознаване на AI сочи друг вид с ≥ 0,30: „AI предлага друг вид: *Z* (NN %).“

Никъде не пише „потвърдено“ без iNaturalist. Блокът със старите AI текстове остава непроменен.

## 6. Потоци

**Ново растение (`/plants/new`):**
1. Най-горе е полето „Снимки“. Изборът на файлове стартира обработката за разпознаване. AI панелът показва: „Разпознаване…“ → кандидати | „AI не разпозна растението“ | грешка с „Опитай пак“ | „не е настроено“ | „лимитът за днес е изчерпан“.
2. Кандидатът показва латинско име (курсив), семейство, % и линия, и „други имена“ (common names на английски). Докосването попълва „Латинско име“ и „Семейство“. Българското име остава за собственика.
3. Формата изпраща скрито поле `identification` (JSON: `modelVersion`, `photoCount`, `candidates`, `chosenIndex`).
4. Действието на сървъра:
   - валидира с zod;
   - `createPlant` с `name_source = 'ai'`, ако избраният кандидат съвпада (без значение главни/малки) с подаденото латинско име, иначе `'manual'`;
   - вмъква `identifications`;
   - пуска GBIF проверката. Грешка в GBIF не спира записа.
5. После снимките се качват както досега (`PhotoUploader`).

**Редакция (`/plants/[id]/edit`):**
- Когато `PhotoUploader` приключи с поне 1 качена снимка, AI панелът се пуска автоматично с последните до 5 снимки на растението. Взима ги от signed URL-ите на оптимизираните версии и ги намалява до 1024 px.
- Бутон „Разпознай по снимките“ пуска същото ръчно. Това е за 97-те стари растения: една заявка, само при клик.
- Изборът на кандидат попълва полетата. „Запази“ изпраща и `identification`.
- При промяна на латинското име `update` пуска GBIF отново и преизчислява `name_source`.

**Страница на растение (само за редактор):**
- `?/checkName`: GBIF отново (за стари растения или след грешка).
- `?/useAccepted`: сменя `scientific_name` с `gbif_accepted_name` и пуска проверката отново.
- `?/linkInat`: приема URL или число, валидира с `^(?:https?://(?:www\.)?inaturalist\.org/observations/)?(\d{1,12})/?$`, чете `https://api.inaturalist.org/v1/observations/{id}` и записва `quality_grade`, `taxon.name` и `checked_at`.
- `?/unlinkInat`: изчиства четирите `inat_*` колони.

## 7. Външни API (точни договори; проверяват се в първия ръчен тест)

- **Pl@ntNet:** `POST https://my-api.plantnet.org/v2/identify/all?api-key=KEY&nb-results=5&include-related-images=false`. Тялото е multipart с `images` (1–5) и `organs=auto` за всяка снимка.
  - Отговор: `results[].score`, `results[].species.scientificNameWithoutAuthor`, `.scientificNameAuthorship`, `.genus.scientificNameWithoutAuthor`, `.family.scientificNameWithoutAuthor`, `.commonNames[]`, `results[].gbif.id`, `version`, `remainingIdentificationRequests`.
  - HTTP 404 означава, че видът не е разпознат (`no_match`). 429 е изчерпан лимит (`quota`). 401 означава грешен ключ (`not_configured`). Всичко друго и timeout са `upstream`.
- **GBIF:** `GET https://api.gbif.org/v1/species/match?name=…&strict=true`.
  - Приема само `matchType = EXACT` и `rank ∈ {SPECIES, SUBSPECIES, VARIETY, FORM}`.
  - `status = ACCEPTED` → `accepted`. Синоними (`SYNONYM`, `HETEROTYPIC_SYNONYM`, `HOMOTYPIC_SYNONYM`, `PROPARTE_SYNONYM`) → `synonym` с `acceptedUsageKey`. `DOUBTFUL` → `doubtful`. Всичко друго → `none`.
  - Името на приетия вид е `canonicalName` на приетия ключ: при синоним се прави втора заявка `GET /v1/species/{acceptedUsageKey}`.
- **iNaturalist:** `GET https://api.inaturalist.org/v1/observations/{id}` → `results[0].quality_grade`, `results[0].taxon.name`. Празни `results` → „Наблюдението не е намерено.“

## 8. Грешки

| Ситуация | Какво вижда собственикът | Записва ли се? |
|---|---|---|
| Pl@ntNet не разпознава | „AI не разпозна растението. Попълни името сам.“ | да, без протокол |
| Лимит (наш или на Pl@ntNet) | „Лимитът за разпознаване за днес е изчерпан.“ | да |
| Timeout / мрежа / 5xx | „AI не отговори.“ + „Опитай пак“ | да |
| Няма ключ | „AI разпознаването не е настроено.“ | да |
| GBIF не отговаря при запис | статусът остава чернова; на страницата: „Името не е проверено в GBIF.“ + бутон | да |
| Невалиден линк към iNaturalist | „Това не е линк към наблюдение в iNaturalist.“ | не |

Техническите подробности отиват в `console.error` на сървъра. Ключът никога не се логва.

## 9. Визия

- **Цветове (само тъмна тема):**
  - фон `#0e1714`, повърхност `#16221e`, по-светла повърхност `#1d2b26`;
  - текст `#e6ede8`, приглушен `#93a39b`, линии `#26352f`;
  - акцент (пълен цвят) `#d9bf6a`, текст върху акцент `#1a1606`;
  - опасно `#ff8a80`, предупреждение `#f4dc8f`.
- **Шрифтове:** Literata за заглавия и всички латински имена (курсив), Onest за текста. Fallback: Georgia / system-ui.
- **Каталог:**
  - търсене и чипове за статус (Всички · Чернови · Прието име · Потвърдени);
  - решетка от карти: снимка 3:4 с градиент отдолу, върху нея българско име, латинско в курсив и значка за статус;
  - 2 колони под 640 px, 3 колони до 1024 px, 4 колони над това;
  - превключвател „6 / 12“ и номерирани страници; URL `?n=12&p=2&q=…&s=…`;
  - промяна на търсенето или филтъра връща на страница 1.
- **Растение (хербарен лист):**
  - на повърхността лежи основната снимка; под нея е етикет с рамка: семейство (главни, разредени), латинско име (голямо, курсив), българско име и ред „det.: Pl@ntNet NN % · име: GBIF прието | синоним | не е проверено“;
  - вдясно е печатът за статус;
  - следват блокът „Доказателства“ (AI / Име / Общност), действията на редактора, миниатюрите на галерията, текстовете на собственика и старият AI блок.
- **Добавяне:** най-горе лента със снимки 4:1, AI панелът с кандидатите и атрибуцията, после формата.
- Достъпност:
  - статусът се разпознава по форма, не само по цвят;
  - фокусът е видим;
  - докосваемите зони са поне 44 px;
  - `prefers-reduced-motion` се спазва.

## 10. Тестове

- **pgTAP:**
  - `id_status` за трите нива и граничните случаи: 0,29 срещу 0,30, синоним, iNaturalist за друг вид;
  - RLS и права за `identifications` и `api_usage`;
  - квотата: 100 минават, 101-вата е `false`, зрител получава `false`;
  - `name_source` на старите растения;
  - липсата на `status`.
- **Unit:**
  - парсване на отговорите от Pl@ntNet, GBIF и iNaturalist (fixtures);
  - регулярният израз за iNaturalist;
  - етикетите на статусите;
  - филтърът и страниците на каталога;
  - schema-та на `identification`;
  - правилото за `name_source`.
- **Integration (локален Supabase, подменен `fetch`):**
  - identify handler: квота, грешки, без ключ;
  - name check;
  - linkInat;
  - създаване с протокол.
- **e2e (Pixel 7, `page.route` подменя `/api/identify`):**
  - добавяне със снимка → кандидати → избор → запис → значка;
  - каталогът по 6, страница 2;
  - зрителят не вижда бутоните;
  - съществуващите тестове се обновяват (махат се „Потвърди“).
- Един ръчен тест с истинския ключ след deploy.

## 11. Ограничения и следващи стъпки

- **Български имена:** Pl@ntNet се пита без `lang` (английски common names), защото не е проверено дали поддържа `bg`. Ръчният тест може да опита `lang=bg`. Ако работи, това е промяна на една константа.
- **Регионален проект** (вместо `all`) може да е по-точен за България. Това е отделна проверка.
- **Миграциите** в продукция ги прилага собственикът през SQL Editor, всяка с отделно одобрение. Преди втората се проверява, че няма `confirmed`.
- **Собственикът сам:**
  - регистрация в my.plantnet.org (безплатно, некомерсиално);
  - ключ в Vercel като `PLANTNET_API_KEY` (без `PUBLIC_`).
- **Нов текст за Project Instructions §7** (заменя реда за Pl@ntNet):
  > Pl@ntNet се пуска автоматично при качване на снимки: една заявка за пакет до 5 снимки, най-много 100 на ден. Показва 3–5 кандидата с увереност и атрибуция. Нищо не се записва без „Запази“. Статусът „AI · прието име“ означава само, че AI предложението е валидно име в GBIF, не че видът е потвърден. „Потвърдено“ идва само от iNaturalist Research Grade.
