# Флора 3 — дизайн (spec)

Дата: 2026-10-01 · Статус: одобрен в разговор, записан за преглед

## 1. Цел и обхват

Личен ботанически каталог, удобен от телефон. Собственикът (Bocka) добавя и редактира; поканени зрители (приятелката му) само разглеждат.

**v1 включва:** вход; каталог с търсене и филтър; добавяне/редакция/изтриване на растение; няколко снимки на растение (оптимизирана версия + миниатюра, основна снимка); галерия на цял екран; потвърждаване на растение; еднократно пренасяне на 98 растения и 120 снимки от проекта `digital-flora`.

**v1 НЕ включва:** офлайн режим (възможна фаза 2), Pl@ntNet, AI функции, GBIF (кандидат за v1.1), Google Drive, Firebase.

**Успех:** собственикът добавя растение с 2 снимки от телефона за под минута; зрителят вижда каталога, но не може да променя нищо; всички 98 растения и 120 снимки са пренесени с 0 грешки; разходът е $0.

## 2. Решения (rulings)

| Решение | Защо | Цена, ако е грешно |
|---|---|---|
| SvelteKit **2.70.x**, Svelte 5 (runes), TypeScript, Vite 8 | SvelteKit 3.0.0 излезе днес (2026-10-01); 2.x е зряла и с пълна поддръжка на adapter-vercel 6 | Миграция към 3.x по-късно (часове, не дни) |
| Вход с **имейл + парола**, не magic link | Вграденият SMTP на Supabase изпраща имейли само до членове на организацията; magic link за приятелката изисква външен SMTP (нов акаунт). Потребителите се създават ръчно в Supabase dashboard, без имейл | Magic link се добавя по-късно със собствен SMTP |
| Таблица `editors` + функция `is_editor()` | Само `owner_id = auth.uid()` би позволило на зрителя да създава свои растения | — |
| WebP 0,85, с **JPEG 0,85 резерва** | Safari може да не кодира WebP през canvas и тихо връща PNG | — |
| Растения: SvelteKit form actions; снимки: директно от браузъра към Storage + ред в `plant_photos` чрез supabase-js | Снимките не минават през Vercel (лимит 4,5 MB на заявка); RLS пази и двата пътя | — |
| Signed URLs се издават на сървъра, наведнъж за страницата, валидни 1 час | Private bucket | — |
| Старият проект `digital-flora` остава непроменен като архив | Обратимост | — |

## 3. Архитектура

```
Браузър (SvelteKit UI, mobile-first)
  │ сесия в cookies (@supabase/ssr)
  ├─► SvelteKit server (Vercel Hobby): load + form actions ─► Supabase Postgres (RLS)
  └─► Supabase Storage, private bucket `photos` (директно качване със сесията)
```

- Приложението ползва само publishable ключа + сесията на потребителя. Secret/service-role ключ никога не е в приложението; ползва го само скриптът за пренасяне, пуснат ръчно.
- Env променливи `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY` се валидират със Zod. Липсва ли стойност → ясна грешка, без резервни/стари данни.
- Всички страници освен `/login` изискват вход (redirect към `/login`).

## 4. Модел на данните

```sql
editors (user_id uuid pk → auth.users)

plants
  id uuid pk (подава се от клиента)
  owner_id uuid not null default auth.uid() → auth.users
  scientific_name text not null (trim, 1..200)
  name_bg text not null (trim, 1..200)
  family text null (≤100)
  description text null (≤5000)  -- текст на собственика
  habitat text null (≤5000)      -- текст на собственика
  notes text null (≤5000)        -- текст на собственика
  status text not null default 'unverified' check in ('unverified','confirmed')
  confirmed_at timestamptz null  -- check: (status='confirmed') = (confirmed_at is not null)
  legacy_ai jsonb null           -- стари AI текстове, само за четене от UI
  created_at, updated_at timestamptz (updated_at чрез trigger)

plant_photos
  id uuid pk (подава се от клиента)
  plant_id uuid not null → plants on delete restrict
  owner_id uuid not null default auth.uid()
  path text not null unique        -- {owner}/{plant}/{photo}.{webp|jpg}
  thumb_path text not null unique  -- {owner}/{plant}/{photo}_thumb.{webp|jpg}
  mime text not null check in ('image/webp','image/jpeg')
  width int, height int, bytes int (> 0)
  sha256 text not null unique (64 hex)  -- хеш на ОРИГИНАЛНИЯ файл
  is_primary boolean not null default false
  taken_at timestamptz null
  created_at timestamptz
  unique index (plant_id) where is_primary
```

- **Trigger:** първата снимка на растение автоматично става основна; при изтриване на основната, най-старата останала става основна.
- **RPC** `set_primary_photo(photo_id uuid)`: сменя основната снимка в една транзакция.
- `legacy_ai` ключове: `recognition, habitat, lookalikes, benefits, risks, uses, fun_fact, confidence, source_file, legacy_id, imported_at`.

## 5. Достъп (RLS)

- `plants`, `plant_photos`: SELECT за `authenticated`; INSERT/UPDATE/DELETE само ако `is_editor()` и `owner_id = auth.uid()`.
- `editors`: SELECT само на собствения ред; никакви записи от клиента.
- Storage `photos` (private, лимит 10 MB, само image/webp и image/jpeg): SELECT за `authenticated`; INSERT/UPDATE/DELETE само ако `is_editor()` и първата папка = `auth.uid()`.
- Регистрацията е изключена (`enable_signup = false`).
- `anon` няма достъп до нищо.

## 6. Снимки (в браузъра, $0)

1. Избор на до 10 файла наведнъж; файл >30 MB или не-изображение → отказ със съобщение.
2. SHA-256 на оригинала (`crypto.subtle`); ако хешът вече съществува → „Тази снимка вече е качена“.
3. `taken_at` от EXIF (`exifr`, само DateTimeOriginal). GPS не се чете и не се пази.
4. `createImageBitmap(file, { imageOrientation: 'from-image' })` → canvas: оптимизирана с най-дълга страна ≤2560 px, миниатюра ≤480 px; без уголемяване. Прекодирането премахва EXIF/GPS.
5. Кодиране WebP 0,85; ако резултатът не е `image/webp` → JPEG 0,85.
6. Качване на двата файла в Storage (фиксиран път по `photo_id`, `upsert: true` → повторен опит е безопасен), после ред в `plant_photos`. Ако записът се провали → качените файлове се трият.
7. Статус на всяка снимка: `чака → обработва се → качва се → готово | грешка` + „Опитай пак“.
8. Декодирането се провали (напр. HEIC в Chrome) → „Форматът не се поддържа от този браузър. Изберете JPEG.“

## 7. Екрани (mobile-first, текстът е на български)

| Път | Съдържание |
|---|---|
| `/login` | имейл + парола |
| `/` | мрежа с миниатюри; търсене по българско/латинско име (без значение главни/малки букви); филтър всички/непотвърдени/потвърдени; бутон „+ Растение“ само за редактор |
| `/plants/new` | форма + избор на снимки; след запис качва снимките и показва статус |
| `/plants/[id]` | галерия (цял екран при докосване), текстове на собственика, сгъваем блок „AI чернова — непроверено“; за редактор: „Редактирай“, „Потвърди“/„Върни като непотвърдено“ |
| `/plants/[id]/edit` | полета, добавяне/изтриване на снимки, избор на основна, „Изтрий растението“ (с потвърждение) |

Състояния: празен каталог („Още няма растения“), липса на резултати при търсене, грешка при зареждане (съобщение + „Опитай пак“), 404 за несъществуващо растение.

AI блокът винаги носи етикета „AI чернова — непроверено. Не е проверено от човек; не разчитай на него за ядливост, токсичност или лечебна употреба.“ Рисковете/ползите/употребата живеят само там.

## 8. Пренасяне (еднократно, ръчно)

- `scripts/export-legacy.sql` се пуска read-only срещу стария проект → `legacy-export.json`.
- `scripts/import-legacy.ts --source legacy-export.json [--apply]` (по подразбиране dry-run) с `NEW_SUPABASE_URL`, `NEW_SUPABASE_SECRET_KEY`, `OWNER_USER_ID` от env.
- Mapping: `common_name → name_bg`, `latin_name → scientific_name`, `family → family`, `status = 'unverified'`, AI полетата + `confidence` + `source_file` + старото id → `legacy_ai`. ID на растението = старото ID.
- Снимки: всеки стар URL се изтегля и се обработва със `sharp` (rotate по EXIF, ≤2560 / ≤480, WebP 85, без метаданни); `sha256` от оригиналните байтове; първата снимка става основна (trigger).
- Идемпотентност: растение със съществуващо id се пропуска; снимка със съществуващ `sha256` се пропуска.
- Отчет `import-report.json`: брой растения/снимки създадени/пропуснати/грешки.
- Приемане: 98 растения, 120 снимки, 0 грешки, всяко растение има точно една основна снимка.

## 9. Грешки, backup, тестове

- Всяка грешка от Supabase се показва на потребителя на български; техническият текст отива в `console.error`.
- Backup: седмичен `pg_dump` чрез GitHub Action (`.github/workflows/backup.yml`) като artifact, пази 30 дни; изисква secret `SUPABASE_DB_URL`. Активира се само след одобрение.
- Тестове: Vitest unit (размери, кодиране, пътища, Zod схеми, mapping); Vitest integration срещу локален Supabase (услуги за растения/снимки); pgTAP (RLS, triggers, RPC); Playwright e2e срещу локален Supabase (вход; добавяне с 2 снимки; галерия; редакция; зрител не може да редактира).

## 10. Разходи

Supabase Free, Vercel Hobby, open-source библиотеки → $0.

## 11. Изпълнение и одобрения

Кодът се пише и тества локално в нов repo `flora3`. Следните външни действия чакат изрично одобрение: създаване на GitHub repo и push; нов Supabase проект `flora3` и прилагане на миграцията; създаване на потребители; Vercel проект и env; пускане на пренасянето с `--apply`; активиране на backup Action.
