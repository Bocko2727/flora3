# Флора 3 — личен ботанически каталог

SvelteKit 2 / Svelte 5 (TypeScript) · Supabase (Postgres, Auth, Storage, RLS) · Vercel (`fra1`) · Pl@ntNet (разпознаване) · GBIF (проверка на име).
Bucket `photos` е частен (подписани URL). Само собственикът пише (`editors` + `is_editor()` + RLS); всеки друг влязъл е зрител.

## Команди
- Dev: `npm run dev` (порт 5174) · Build: `npm run build`
- Типове/Svelte: `npm run check`
- Unit: `npm run test:unit` · Integration: `npm run test:integration`
- E2E (мобилен Chromium, Pixel 7): `npm run test:e2e`
- pgTAP: `npm run test:db` · Локална база: `npm run db:start`, `npm run env:local`, `npm run db:reset`
- Преди PR веднъж целият набор: `db:reset` → `test:db` → `test:unit` → `test:integration` → `test:e2e` → `check` → `build`.
- Външните API са изключени в тестове с `FLORA_OFFLINE_EXTERNAL=1`.

## Граници (Project Instructions §5)
- **Свободно, без питане:** клонове `feat/…`, `fix/…`, `chore/…` (commit, push); PR (отваряне, обновяване); триене на вече влети клонове; CI файлове на клон; read-only scheduled tasks; Figma, artifacts, Project Knowledge; Pl@ntNet до 20 заявки на задача; всичко само с четене.
- **Кратко „Одобрявам: …“** (какво, команда/SQL, rollback в 2–3 реда): миграции в хоста, единични обратими промени в production данни, настройки във Vercel, Pl@ntNet над 20 заявки.
- **Пълен Approval Gate:** secrets; пари, нови пакети, MCP сървър/connector/външна услуга; необратима загуба на данни; **merge в `main`**, force-push, пренаписване на история; старият Supabase проект (само четене).
- Никога не пипай `main` директно и не merge-вай PR. Merge е на собственика; `main` = production deploy.
- Не ползвай `supabase db push` към хоста (версиите в `supabase_migrations` не съвпадат с файловете).
- Stop list (без отделен план и одобрение): масова обработка на снимки, нов import, обновяване на зависимости, SvelteKit 3, платени услуги.

## Правила
- Нова таблица = RLS включен; запис само през `is_editor()`. Миграции: само нови файлове + pgTAP тест + rollback SQL; приложени не се редактират.
- Secrets само в env; никога в код, логове, чат или client код. Не чети `.env*`.
- Pl@ntNet се вика само след действие на потребителя; без двойни заявки (една заявка = до 5 снимки); квота 100/ден (`consume_identify_quota`); нищо не се записва автоматично.
- Оригиналните снимки никога не се презаписват или трият. Без точни GPS/EXIF координати в публичните производни.
- Ботаника: AI/API резултат е „възможен кандидат“, никога „потвърден вид“. „Потвърдено“ идва само от iNaturalist Research Grade или решение на собственика. Рискове и опасни двойници се показват винаги, с източник; употребите само като документирана история при висока увереност или потвърден вид; никога „ядливо“, дози или лечебни препоръки (подробно: skill `botanik`).
- Един логически проблем = един малък commit. Без странични refactor-и. TDD за код. Макс. 3 опита за дефект, всеки с нова хипотеза.
- „Готово“ = командите по-горе минават; покажи изхода. Не отслабвай и не изтривай неуспешен тест.
- UI: tokens в CSS променливи, светъл и тъмен режим, бутони ≥ 44 px, контраст AA, screenshot-и при 360 и 1280 px.

## Екип и работен процес
Подагенти в `.claude/agents/`: `researcher`, `botanist`, `designer`, `developer`, `qa`, `release`, `reviewer`. Ползвай ги автоматично, когато подобряват качеството, скоростта или проверката; независимите задачи вървят паралелно. Конвейер: проучване → дизайн/код → QA → ревизия (друг агент, не авторът) → push на клона и отворен PR.
Правила по пътища: `.claude/rules/`. Умения: `/preflight` (целият набор преди PR), `/new-migration <име>`; автоматични: `flora-baseline` (старт/статус), `flora-approval-gate` (ниво по §5 и блок за одобрение), `flora-release-pr` (PR без merge), `flora-svelte5-conventions` (код и тестове), `botanik` (растения). Технически защити: `.claude/settings.json` и `.claude/hooks/` (guard-bash.sh, protect-files.sh, guard-mcp.sh за GitHub MCP; related-tests.sh пуска свързаните unit тестове след редакция; status-reminder.sh напомня за `.10x/`). Svelte MCP (`.mcp.json`) е одобрен: ползвай `svelte-autofixer` при `.svelte` код; Playwright MCP още не е одобрен. CI: `ci.yml` има `fast` (check, unit, build) и `secrets-scan` (gitleaks, само диапазона на PR-а). Dependabot (`.github/dependabot.yml`, седмично, major игнорирани) отваря PR-и; агентите не ги merge-ват и не правят масови обновявания (Stop list). Идеи за P1 дизайн: `docs/design/`. MCP инструментите (GitHub, Supabase, Vercel) не са покрити от Bash правилата — същите граници важат и за тях.

## Памет между сесии
Handoff формат (подагент → оркестратор и `.10x/handoff.md`):
```
## <дата> · <роля> · <задача>
Статус: DONE / FAIL / BLOCKED
Резултат: <факти>
Променени файлове: <пътища или „няма“>
Доказателства: <тестове, линкове, SHA>
Рискове / несигурност: <конкретно>
Следващ: <роля и защо>
```
Всеки отчет отива в `.10x/handoff.md`; в края на задачата се обновява `.10x/status.md`. Документите в Project Knowledge (claude.ai) са справочни; при противоречие важат кодът и проверка само с четене.

## Документите показват само настоящето
- `.10x/status.md` съдържа само текущото състояние, следващите задачи, чакащите решения и отложеното. Свършеното отпада от него; историята е в git и в PR-ите.
- `.10x/handoff.md` пази само отчети за незавършена работа. Когато задачата е влята в `main`, отчетът ѝ се маха.
- **Смяна на решение от собственика се отразява в същата задача навсякъде, където е записано:** `CLAUDE.md`, `.claude/agents/`, `.claude/skills/`, `.claude/rules/`, `.10x/status.md`, `docs/`, README. Старата формулировка се заменя, не се оставя до новата. Ако решението засяга Project Instructions в claude.ai, кажи на собственика точно кой ред да смени.

# Compact instructions
Запази: променени файлове, тестови команди и резултати, текущия клон, отворени проблеми.
