# Флора 3

Личен ботанически каталог: SvelteKit 2 + Supabase (Postgres, Auth, Storage), хостинг на Vercel. Собственикът добавя и редактира растения и снимки; поканените зрители само разглеждат.

Архитектура: `docs/superpowers/specs/2026-10-01-flora3-design.md` (v1), `docs/superpowers/specs/2026-10-02-flora3-ai-statuses-redesign-design.md` (AI предложение и статуси) · Визия „Хербарий“ и следващи екрани: `docs/prototype/HANDOFF.md` · Текущо състояние: `.10x/status.md`

## Локална разработка

Изисквания: Node 22.x, Docker.

```bash
npm install
npm run db:start     # локален Supabase в Docker
npm run env:local    # записва .env за локалния stack
npm run db:reset     # прилага миграциите
npm run dev          # http://localhost:5174
```

Тестови потребители се създават от integration/e2e тестовете (`editor@flora.test`, `viewer@flora.test`).

## Тестове

| Команда | Какво проверява |
|---|---|
| `npm run test:unit` | чисти функции: размери, кодиране, пътища, схеми, търсене, mapping |
| `npm run test:integration` | услугите срещу локалния Supabase (растения, снимки, пренасяне) |
| `npm run test:db` | pgTAP: RLS, triggers, RPC, bucket |
| `npm run test:e2e` | Playwright на мобилен екран: вход, качване, AI панел (подменен), каталог 6/12, галерия, редакция, права на зрителя. Сървърът върви с `FLORA_OFFLINE_EXTERNAL=1`, така че тестовете не стигат до външни API |
| `npm run check` | типове и Svelte |

CI (`.github/workflows/ci.yml`) върви на всеки PR: `fast` (`check`, `test:unit`, `build`), после `db-e2e` (локален Supabase на runner-а: `db:reset`, `test:db`, `test:integration`, `test:e2e`) и `secrets-scan` (gitleaks). Node е закрепен на `22.x`. Преди PR локално върви целият набор: `db:reset` → `test:db` → `test:unit` → `test:integration` → `test:e2e` → `check` → `build`.

## Пускане в употреба (всяка стъпка изисква твоето одобрение)

1. **GitHub:** създай repo-то като **private** преди първия push — кодът и artifact-ите на backup-а не трябва да са публични.
2. **Supabase:** нов проект `flora3` (Free, eu-central-1). Миграциите от `supabase/migrations/` се прилагат по ред през `apply_migration` или в SQL Editor, всяка с отделно одобрение. **Не ползвай `supabase db push` към хоста:** версиите в `supabase_migrations` не съвпадат с имената на файловете. Провери, че bucket-ът е частен: `select public from storage.buckets where id = 'photos';` → `false`.
3. **Auth:** Authentication → Sign In / Providers. Доставчикът **Email** остава **включен** — изключваш само „Allow new users to sign up“ и „Allow anonymous sign-ins“. Ако изключиш самия Email provider, спира входът за всички. Препоръчително: „Minimum password length“ → 12.
4. **Потребители:** Authentication → Users → Add user → Create new user (с „Auto Confirm User“) за теб и за зрителя. После в SQL Editor:
   `insert into public.editors (user_id) select id from auth.users where email = 'ТВОЯТ_ИМЕЙЛ';`
   Провери: `select count(*) from public.editors;` трябва да върне 1.
5. **Vercel:** нов проект от GitHub repo-то; Environment Variables: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Project Settings → API Keys → Publishable). Secret ключ никога не влиза във Vercel. Функциите са настроени за регион `fra1` (Франкфурт, близо до Supabase eu-central-1) от `vite.config.ts`. След първия deploy: Supabase → Authentication → URL Configuration → Site URL = адресът във Vercel.
6. **Пренасяне:** пусни `scripts/export-legacy.sql` в SQL Editor на стария проект и запиши резултата в `legacy-export.json`. Създай `.env.import` с `NEW_SUPABASE_URL`, `NEW_SUPABASE_SECRET_KEY` (Project Settings → API Keys → Secret) и `OWNER_USER_ID` (твоето UID от Authentication → Users). Първо `npm run import:legacy -- --source legacy-export.json --overrides scripts/import/overrides.flora3.json` (dry-run). Файлът с overrides пази редакторските решения: *Sedum album* не се пренася, а дубликатът `File_010.png` отпада от *Pulmonaria officinalis*. Преди `--apply` dry-run-ът трябва да покаже `plants.total` 97, `photos.total` 118, 0 пропуснати, 0 грешки, празен `plantsWithoutPhotos` и код на изход 0; едва тогава пусни същото с `--apply`. Изтрий `.env.import` след това.
7. **Backup:** добави GitHub secret `SUPABASE_DB_URL` = connection string от Supabase → Connect → **Session pooler** (GitHub runners нямат IPv6); замени `[YOUR-PASSWORD]` с паролата, URL-кодирана, ако съдържа специални знаци. Пусни ръчно „Weekly database backup“ веднъж и провери artifact-а.
   **Какво пази backup-ът:** само редовете в базата (растения, записи за снимки, редактори). Самите файлове на снимките в Storage и потребителските акаунти **не** са в него. Възстановяване в нов проект изисква същите потребители (същите UUID).

## AI разпознаване и статуси

**Статуси** (изчисляват се в базата от доказателства, не се задават на ръка):

| Статус | Кога |
|---|---|
| AI чернова / Чернова | по подразбиране (AI име или въведено ръчно) |
| AI · прието име | избраният вид е сред кандидатите на Pl@ntNet с ≥ 30 % **и** GBIF го приема (или е синоним). Името е валидно; видът не е потвърден от човек |
| Потвърдено · iNaturalist | свързано наблюдение с Research Grade за същия вид |

**Настройка (еднократно, с твое одобрение):**
1. Регистрация в [my.plantnet.org](https://my.plantnet.org) (безплатно, некомерсиално) → API key.
2. Vercel → Project → Settings → Environment Variables → `PLANTNET_API_KEY` (Production). Без `PUBLIC_` — ключът остава на сървъра. Redeploy.
3. Без ключ приложението работи; AI панелът казва „AI разпознаването не е настроено.“

**Лимити:** приложението спира на 100 разпознавания на ден за потребител (функцията `consume_identify_quota`); Pl@ntNet позволява 500 на ден. Една заявка = до 5 снимки. Под предложенията стои задължителната атрибуция „Разпознаването използва Pl@ntNet API.“ GBIF и iNaturalist се четат без ключ. Шрифтовете (Literata, Onest) се зареждат от Google Fonts.

**Миграции на хостнатия проект** (SQL Editor, по ред, всяка с отделно одобрение):
1. `20261003090000_editors_no_delete.sql` (ако още не е приложена). Връщане: `grant delete on public.editors to authenticated;`
2. `20261004090000_identification_status.sql`. Проверка: `select public.id_status(p) from public.plants p limit 1;` връща `draft`; `select count(*) from public.plants where name_source = 'legacy_ai';` = броя пренесени растения. Връщане: `drop function public.consume_identify_quota(); drop function public.id_status(public.plants); drop table public.api_usage; drop table public.identifications;` и `alter table public.plants drop column name_source, drop column gbif_match, drop column gbif_key, drop column gbif_accepted_key, drop column gbif_accepted_name, drop column gbif_checked_at, drop column inat_observation_id, drop column inat_quality_grade, drop column inat_taxon_name, drop column inat_checked_at;`
3. Преди третата: `select count(*) from public.plants where status = 'confirmed';` трябва да е **0**. После `20261004100000_drop_self_confirm.sql`. Връщане: `alter table public.plants add column status text not null default 'unverified' check (status in ('unverified','confirmed')), add column confirmed_at timestamptz, add constraint plants_confirmed_consistency check ((status = 'confirmed') = (confirmed_at is not null));` и deploy на предишната версия на приложението.

Миграции 2 и 3 и новият код вървят заедно: първо миграциите, веднага след това deploy.
4. `20261005090000_legacy_review.sql` — **преди** merge на кода за прегледа (новият код чете новите колони; старият работи и с тях). Проверка: `select count(*) from public.plants p where name_source='legacy_ai' and public.id_status(p) <> 'draft';` = 0; растенията с избран кандидат пазят статуса си. Връщане: `drop policy "identifications: editor decides own review" on public.identifications; drop index public.identifications_one_review; alter table public.identifications drop constraint identifications_decision_review_only, drop column source, drop column decision, drop column wiki; alter table public.plants drop column description_source, drop column wiki_url;` и предишната версия на `public.id_status` от `20261004090000_identification_status.sql`.

## Ограничения на безплатните планове

- Supabase Free: 500 MB база, 1 GB файлове, проектът се паузира след 7 дни без активност (събужда се от dashboard).
- Vercel Hobby: само лична, некомерсиална употреба.
- Вход с парола, защото вграденият имейл на Supabase изпраща само до членове на организацията. Magic link изисква собствен SMTP.
