---
name: flora-svelte5-conventions
description: Как се пише код точно в repo-то на Флора 3 — Svelte 5 runes, load функции и form actions, Supabase клиент, requireEditor, UserFacingError, zod схеми, server-only външни API, структура на тестовете и mock-ване. Ползвай при всяка нова страница, компонент, endpoint, server функция или тест в src/ и tests/.
---

# Флора 3 — конвенции в кода

Взето от кода в `main`, не от общата документация. Ако документацията на Svelte/SvelteKit казва друго, следвай repo-то и отбележи разликата.

## Структура
| Път | Какво |
|---|---|
| `src/hooks.server.ts` | Supabase клиент в `locals.supabase`, `locals.user`; пренасочване към `/login?next=` за непублични пътища (`$lib/auth/guard`) |
| `src/lib/server/` | Само сървър: `auth.ts` (`isEditor`, `requireEditor`), `plants.ts`, `review.ts`, `verification.ts`, `signed-urls.ts`, `http.ts` (`toHttpError`), `external/` (GBIF, wiki, iNat, Pl@ntNet, `fetch.ts`) |
| `src/lib/schemas/` | zod схеми за форми и id |
| `src/lib/supabase/` | `server.ts`, `browser.ts` |
| `src/lib/components/` | Svelte компоненти (PascalCase) |
| `src/lib/database.types.ts` | генерира се с `npm run db:types`; не се пише на ръка |
| `tests/unit` · `tests/integration` · `tests/e2e` · `supabase/tests` | Vitest unit · Vitest integration (локална база) · Playwright · pgTAP |

## Svelte 5
- Runes са включени за целия проект (`vite.config.ts`). Без `export let`, `$:` и stores за локално състояние.
- Props: `type Props = {…}; let { a, b = default }: Props = $props();`
- Изведени стойности: `$derived(...)`; състояние: `$state(...)`; странични ефекти рядко, с `$effect`.
- Стилът е в компонента, с CSS променливи (`--accent`, `--muted`, `--space-*`, `--text-*`). Без твърди цветове и размери.
- Статусът не разчита само на цвят: виж `StatusBadge.svelte` (празен/половин/пълен кръг + текст).
- Достъпност: бутони ≥ 44 px, видим focus, `aria-hidden` за декорации.
- Текстовете в UI са на български.

## Load функции и actions
- Данни се зареждат в `+page.server.ts`, не в клиента.
- Всяка страница или action, която пише или е само за редактора: първо `await requireEditor(locals)`. RLS е втората защита, не единствената.
- Грешки от `lib/server` са `UserFacingError` (`$lib/errors`): в load → `.catch(toHttpError)`; в action → `fail(400, { values, errors, message: e.message })`.
- Форми: `parsePlantForm(form)` / zod `safeParse`; при грешка `fail(400, …)` с върнатите стойности, за да не се губи въведеното.
- Основният запис е важен, страничните стъпки не: след успешен `createPlant` грешка в AI запис или GBIF проверка се логва и не проваля action-а (виж `plants/new/+page.server.ts`).
- Снимки се показват само през подписани URL (`signPaths`); bucket `photos` е частен.

## API endpoints (`src/routes/api/**`)
Виж `.claude/rules/api-routes.md`: zod за входа, `is_editor()` за запис, `consume_identify_quota` преди Pl@ntNet, без автоматичен запис на резултат.

## Външни API
- Само сървърно, през `externalFetch()` от `$lib/server/external/fetch`.
- Функциите приемат `fetchFn` като параметър, за да се тестват без мрежа.
- Грешка от външна услуга → `UserFacingError` с български текст; детайлът е в `detail`, не в съобщението.
- В тестове и e2e: `FLORA_OFFLINE_EXTERNAL=1`; реални заявки никога.

## Тестове
- TDD: първо падащ тест.
- Unit (`tests/unit/*.test.ts`): чисти функции и външни клиенти с `vi.fn` за `fetchFn`; фикстури в `tests/unit/fixtures/*.json`. Образец: `gbif.test.ts`.
- Integration: срещу локалния Supabase (`npm run db:start`, `env:local`); последователно (`fileParallelism: false`); помощник в `tests/helpers/supabase.ts`.
- e2e: `tests/e2e/flora.spec.ts`, мобилен Chromium (Pixel 7).
- pgTAP: всяка миграция има тест за RLS (редактор може, зрител не може) — `/new-migration`.
- След промяна: най-малкият релевантен тест (hook-ът `related-tests.sh` пуска свързаните unit тестове). Преди PR: `/preflight`.
- Не отслабвай assertion, не слагай `.skip`.

## Svelte MCP
Сървърът `svelte` (`.mcp.json`, безплатен, без ключ) е одобрен. При нов или променен `.svelte`/`.svelte.ts` файл: `svelte-autofixer` до чист резултат; при съмнение за API на Svelte 5/SvelteKit — `list-sections` и `get-documentation`. Резултатът му не заменя `npm run check` и тестовете.

## Не прави
- Нов пакет (§5.1) — предложи го с причина.
- Secret или service-role ключ в `src/lib` извън `server/`, в `+page.svelte` или в `$env/static/public`.
- Ръчна промяна на `database.types.ts`.
- Редакция на приложена миграция.
