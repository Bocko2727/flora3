---
name: new-migration
description: Създава нова Supabase миграция за Флора 3 заедно с pgTAP тест и rollback SQL — нов файл с timestamp, RLS и is_editor() по подразбиране. Аргумент — кратко име в snake_case.
disable-model-invocation: true
argument-hint: <snake_case_име>
---

# /new-migration $ARGUMENTS

Работи само на `feat/…`, `fix/…` или `chore/…` клон. Следвай `.claude/rules/migrations.md`.

## 1. Файлове
- Timestamp: `YYYYMMDDHHMMSS` (UTC сега), по-голям от последния в `supabase/migrations/`.
- `supabase/migrations/<ts>_$ARGUMENTS.sql`
- `supabase/tests/$ARGUMENTS.test.sql`
- Никога не редактирай съществуваща миграция (hook-ът `protect-files.sh` ще блокира).

## 2. Миграция — шаблон
```sql
-- <Едно изречение: какво и защо.>

-- Нова таблица: RLS винаги включен; четене за влезли, запис само за редактора.
create table public.<name> (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);
alter table public.<name> enable row level security;

grant select on public.<name> to authenticated;
grant insert, update on public.<name> to authenticated;   -- без delete, ако не е нужно

create policy "<name>: authenticated read" on public.<name>
  for select to authenticated using (true);
create policy "<name>: editor writes own" on public.<name>
  for insert to authenticated
  with check ((select public.is_editor()) and owner_id = (select auth.uid()));
```
Изтрий неприложимите части. Колони с граници → `check (...)`. Wrap-вай `auth.uid()`/`is_editor()` в `(select …)` (RLS performance).

## 3. pgTAP тест — шаблон (както в `supabase/tests/legacy_review.test.sql`)
```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(<N>);

insert into auth.users (id, email, aud, role, instance_id) values
  ('77777777-0000-0000-0000-000000000007', 'editor7@pgtap.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('88888888-0000-0000-0000-000000000008', 'viewer8@pgtap.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
insert into public.editors (user_id) values ('77777777-0000-0000-0000-000000000007');

select has_table('public', '<name>', '<name> exists');
select is((select relrowsecurity from pg_class where oid = 'public.<name>'::regclass), true, 'RLS enabled');

-- Редактор може да пише
set local role authenticated;
set local request.jwt.claims = '{"sub":"77777777-0000-0000-0000-000000000007","role":"authenticated"}';
select lives_ok($$ insert into public.<name> default values $$, 'editor can insert');

-- Зрител не може
set local request.jwt.claims = '{"sub":"88888888-0000-0000-0000-000000000008","role":"authenticated"}';
select throws_ok($$ insert into public.<name> default values $$, '42501', null, 'viewer cannot insert');
reset role;

select * from finish();
rollback;
```
Ползвай UUID-и, които не се срещат в другите тестове (`grep -r <uuid> supabase/tests`).

## 4. Rollback SQL
Не е файл в `migrations/`. Напиши го в описанието на PR и в `.10x/handoff.md`:
```sql
-- Rollback <ts>_$ARGUMENTS
drop policy if exists "<name>: editor writes own" on public.<name>;
drop policy if exists "<name>: authenticated read" on public.<name>;
drop table if exists public.<name>;
```

## 5. Проверка
`npm run db:reset` → `npm run test:db` → `npm run db:types` (ако схемата е сменена) → `npm run check`. Покажи изхода.

## 6. Хост
Не прилагай към хостнатия Supabase. Без `supabase db push`, без Supabase MCP `apply_migration`. Подготви кратко „Одобрявам: …“ (какво, SQL, rollback в 2–3 реда) за собственика.
