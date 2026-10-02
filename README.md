# Флора 3

Личен ботанически каталог: SvelteKit 2 + Supabase (Postgres, Auth, Storage), хостинг на Vercel. Собственикът добавя и редактира растения и снимки; поканените зрители само разглеждат.

Дизайн: `docs/superpowers/specs/2026-10-01-flora3-design.md` · План: `docs/superpowers/plans/2026-10-01-flora3-v1.md`

## Локална разработка

Изисквания: Node 22, Docker.

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
| `npm run test:e2e` | Playwright на мобилен екран: вход, качване, галерия, редакция, права на зрителя |
| `npm run check` | типове и Svelte |

## Пускане в употреба (всяка стъпка изисква твоето одобрение)

1. **GitHub:** създай repo-то като **private** преди първия push — кодът и artifact-ите на backup-а не трябва да са публични.
2. **Supabase:** нов проект `flora3` (Free, eu-central-1). `npx supabase login`, след това `npx supabase link --project-ref <ref>` (иска паролата на базата) и `npx supabase db push`.
3. **Auth:** Authentication → Sign In / Providers → изключи „Allow new users to sign up” и „Allow anonymous sign-ins”.
4. **Потребители:** Authentication → Users → Add user → Create new user (с „Auto Confirm User”) за теб и за зрителя. После в SQL Editor:
   `insert into public.editors (user_id) select id from auth.users where email = 'ТВОЯТ_ИМЕЙЛ';`
   Провери: `select count(*) from public.editors;` трябва да върне 1.
5. **Vercel:** нов проект от GitHub repo-то; Environment Variables: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Project Settings → API Keys → Publishable). Secret ключ никога не влиза във Vercel. След първия deploy: Supabase → Authentication → URL Configuration → Site URL = адресът във Vercel.
6. **Пренасяне:** пусни `scripts/export-legacy.sql` в SQL Editor на стария проект и запиши резултата в `legacy-export.json`. Създай `.env.import` с `NEW_SUPABASE_URL`, `NEW_SUPABASE_SECRET_KEY` (Project Settings → API Keys → Secret) и `OWNER_USER_ID` (твоето UID от Authentication → Users). Първо `npm run import:legacy -- --source legacy-export.json` (dry-run), след това същото с `--apply`. Изтрий `.env.import` след това.
7. **Backup:** добави GitHub secret `SUPABASE_DB_URL` = connection string от Supabase → Connect → **Session pooler** (GitHub runners нямат IPv6); замени `[YOUR-PASSWORD]` с паролата, URL-кодирана, ако съдържа специални знаци. Пусни ръчно „Weekly database backup” веднъж и провери artifact-а.
   **Какво пази backup-ът:** само редовете в базата (растения, записи за снимки, редактори). Самите файлове на снимките в Storage и потребителските акаунти **не** са в него. Възстановяване в нов проект изисква същите потребители (същите UUID).

## Ограничения на безплатните планове

- Supabase Free: 500 MB база, 1 GB файлове, проектът се паузира след 7 дни без активност (събужда се от dashboard).
- Vercel Hobby: само лична, некомерсиална употреба.
- Вход с парола, защото вграденият имейл на Supabase изпраща само до членове на организацията. Magic link изисква собствен SMTP.
