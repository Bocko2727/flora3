# Одит на средата на Claude Code — Флора 3

Дата: 2026-10-07 · ****Клон: `feat/plant-split-layout`. · Claude Code 2.1.292 · Режим: само четене (нищо не е променено, освен този файл).
Secrets: има файлове с ключове (виж т. 12), стойностите са скрити и не са четени.

## 1. Извод

1. **Контекстът е претоварен:** 76 активни плъгина (77 заредени) добавят ≈ **86 000 токена при всяка сесия** (оценка на `claude plugin details`), а над 58 от тях нямат нищо общо с Флора 3. Те идват от синхронизацията с claude.ai (`@synced`), не от `settings.json`, затова редакция на `~/.claude/settings.json` не ги маха.
2. **Правилата на проекта са добри** (deny за push към main, merge, `supabase db push`, `.env`; 5 hooks; 7 агента; 7 skills). Пропуските са: няма `deny/ask` за `rm -rf`, `DROP`, `vercel --prod`, `git merge`; повечето write-инструменти на Vercel/Drive/v0/Magic Patterns не са покрити; плъгинът `playwright` е зареден, макар `CLAUDE.md` да казва „още не е одобрен“.
3. **Счупено е:** плъгин `github` (HTTP 400, лош Authorization header), `agent-memory` (липсва Python), липсват `uv/uvx`, `supabase`, `vercel`, `docker`, `python`. `.10x/status.md` е остарял (CI фаза B е влята като PR #32).

## 2. Таблица А — всички елементи

Бележки за четене: „токени“ е `Always-on` от `claude plugin details <име>` (описания на skills и агенти, изпращани при всяка сесия). Skills, агентите и hooks на плъгините са групирани в реда на плъгина си (общо 796 skills, 131 агента, 60 hooks, 24 MCP сървъра на плъгини, 1 LSP). Единични описания не съм четял един по един, затова „какво прави“ е от описанието на плъгина/skill-а в списъка на сесията. Припокриване: „TDD/ревю/дебъг“ = дублира `superpowers`.

### 2.1 Плъгини (76 активни, 77 заредени)

Общо: **≈ 86 018 токена**. Оценки: ПОЛЕЗЕН 7 · ПО ИЗБОР 9 · СЧУПЕН 2 · ИЗЛИШЕН 58 · ЗАДЪЛЖИТЕЛЕН 0 (задължителното е в самото репо, виж 2.2).

| Плъгин | Токени | Съдържание | Оценка | Риск / припокриване |
|---|---:|---|---|---|
| superpowers (user, директория) | 840 | 15 skills, 1 hook | ПОЛЕЗЕН | процес: TDD, дебъг, ревю, worktrees; припокриват го sixth-sense, skillquiver, zsl, supermatt, sweetclaude, 10x-Team |
| supabase@synced | 636 | 2 skills, 1 MCP (HTTP, чака вход) | ПОЛЕЗЕН | RLS/Postgres съвети; дублира connector-а Supabase и `supabase-expert` |
| security-guidance | 0 | 5 hooks | ПОЛЕЗЕН | предупреждава за небезопасен код при редакция; hooks без токени |
| typescript-native-lsp | 0 | 1 LSP | ПОЛЕЗЕН | TypeScript диагностика; `svelte-check` остава за `.svelte` |
| context7 (плъгин) | 0 | 1 MCP (чака вход) | ПОЛЕЗЕН | дублира connector-а claude.ai Context7 (той е свързан); пази се един |
| playwright | 0 | 1 MCP (`npx @playwright/mcp@latest`, свързан) | ПОЛЕЗЕН, но не е одобрен | `CLAUDE.md`: „Playwright MCP още не е одобрен“; `@latest` = нова версия без преглед; пълен Approval Gate |
| frontend-design | 80 | 1 skill | ПОЛЕЗЕН | UI качество; дублира design-skills/ultrapowers/zizi |
| design-skills | 1 297 | 10 skills (a11y, UX, ux-writing) | ПО ИЗБОР | a11y одит за AA; дублира `design`, `vectorlab-ux-skills` |
| design@synced | 619 | 7 skills, 9 MCP (Slack, Figma, Linear, Atlassian, Notion, Intercom, Gmail, Calendar; нужен вход) | ПО ИЗБОР | външни услуги; не са нужни за личен каталог |
| engineering@synced | 873 | 10 skills, 10 MCP (Datadog, Gmail, Calendar…) | ПО ИЗБОР | `deploy-checklist`, `testing-strategy`; MCP-тата не са нужни |
| modern-web-guidance | 759 | 2 skills | ПО ИЗБОР | съвети за уеб платформа |
| claude-md-optimizer | 243 | 1 skill | ПО ИЗБОР | само ако `CLAUDE.md` порасне (сега 8,8 KB) |
| token-shield | 669 | 7 skills | ПО ИЗБОР | измерва токени; полезен за самия одит |
| claude-code-setup | 141 | 1 skill | ПО ИЗБОР | препоръки за автоматизации |
| skill-doctor | 206 | 3 skills | ПО ИЗБОР | диагностика на skills |
| supabase-expert | 179 | 1 skill | ПО ИЗБОР | дублира `supabase` |
| github | 0 | 1 MCP (`api.githubcopilot.com`) | **СЧУПЕН** | HTTP 400 „Authorization header is badly formatted“; дублира connector-а Github |
| agent-memory | 29 | 1 skill, 2 hooks, 1 MCP (`python …mcp_server.py`) | **СЧУПЕН** | `CONNECTION_CLOSED`; на машината няма Python |
| agent-architecture-designer | **12 305** | 62 skills, 60 агента (полски: кулинария, кариера, K8s…) | ИЗЛИШЕН | най-голям разход; нищо общо с проекта |
| zizi-skills | 7 753 | 30 skills | ИЗЛИШЕН | дублира TDD/ревю/дизайн |
| sweetclaude | 5 442 | 122 skills, 11 агента, 5 hooks | ИЗЛИШЕН | цял собствен жизнен цикъл (`/go`, `/master`) → конфликт с конвейера на Флора |
| zsl | 4 213 | 32 skills | ИЗЛИШЕН | TDD/ревю/commit дубли |
| pge-orchestrator | 3 784 | 16 skills, 10 агента, 1 MCP (свързан) | ИЗЛИШЕН | дублира се и от `~/.claude/agents`, `~/.claude/commands` |
| ultrapowers-dev | 3 689 | 55 skills (Angular, Rails, Django…) | ИЗЛИШЕН | чужди стекове |
| join-the-team | 2 830 | 25 skills, 1 hook | ИЗЛИШЕН | корпоративен процес |
| docker-skills | 2 589 | 11 skills | ИЗЛИШЕН | няма Docker на машината |
| supermatt | 2 558 | 39 skills | ИЗЛИШЕН | дублира superpowers |
| plugin-dev | 2 351 | 8 skills, 3 агента | ИЗЛИШЕН | само за писане на плъгини |
| togetherai-skills | 2 009 | 14 skills | ИЗЛИШЕН | платена външна услуга |
| skillquiver | 1 797 | 24 skills | ИЗЛИШЕН | дублира superpowers |
| sixth-sense | 1 753 | 16 skills, 9 агента, 2 hooks | ИЗЛИШЕН | дублира superpowers; сменя модели |
| agentics-beyond-code | 1 717 | 7 skills | ИЗЛИШЕН | Atlassian/Productboard/M365 |
| vectorlab-ux-skills | 1 686 | 21 skills | ИЗЛИШЕН | дублира design-skills |
| qa-my-app | 1 608 | 7 skills, 2 hooks | ИЗЛИШЕН | дублира собствения агент `qa` |
| icons8 | 1 571 | 9 skills, 1 MCP (свързан) | ИЗЛИШЕН | външна услуга с лимити |
| writing-skills | 1 552 | 16 skills (Yoda, Shrek…) | ИЗЛИШЕН | развлекателни стилове |
| workflow-toolkit | 1 536 | 21 skills, 2 агента, 7 hooks | ИЗЛИШЕН | GitHub issues DB, 7 hooks |
| atomic-agents | 1 507 | 7 skills, 2 агента | ИЗЛИШЕН | Python framework |
| unreal-engine-skills-for-claude-code | 1 313 | 3 skills, 1 hook | ИЗЛИШЕН | игри |
| claude-context-optimizer | 1 234 | 22 skills, 1 агент, 6 hooks | ИЗЛИШЕН | hooks върху всяка сесия; дублира token-shield |
| design-superpowers | 946 | 9 skills | ИЗЛИШЕН | DS/Figma процес |
| 10x-Team | 932 | 15 skills („You MUST use this…“) | ИЗЛИШЕН | принудителни описания теглят към роли, различни от `.claude/agents` |
| githubclip | 890 | 10 skills, 1 агент | ИЗЛИШЕН | GitHub issues оркестрация |
| agent-handoff | 730 | 4 skills, 1 hook | ИЗЛИШЕН | дублира `.10x/handoff.md` |
| claude-code-toolkit | 663 | 10 skills, 3 агента | ИЗЛИШЕН | planner/coder/reviewer дублират нашите |
| skill-provenance | 659 | 5 skills | ИЗЛИШЕН | — |
| docket-tracker | 658 | 2 skills, 1 агент, 1 MCP | ИЗЛИШЕН | съдебни дела |
| mcp-apps | 627 | 4 skills | ИЗЛИШЕН | — |
| agent-context-kit | 551 | 4 skills | ИЗЛИШЕН | — |
| mcp2cli | 518 | 6 skills, 1 агент | ИЗЛИШЕН | — |
| mcp-server-dev | 504 | 3 skills | ИЗЛИШЕН | — |
| orch | 490 | 5 skills | ИЗЛИШЕН | — |
| senior-engineering-partner | 429 | 1 skill | ИЗЛИШЕН | — |
| prompt-brain | 349 | 2 skills | ИЗЛИШЕН | — |
| mcp-client-kit | 309 | 2 skills | ИЗЛИШЕН | — |
| senior-engineer-guardrails | 299 | 1 skill | ИЗЛИШЕН | — |
| prompt-design | 265 | 1 skill | ИЗЛИШЕН | — |
| platform-skills | 258 | 1 skill (K8s, Terraform, AWS…) | ИЗЛИШЕН | чужд стек |
| handoff | 255 | 1 skill, 2 hooks | ИЗЛИШЕН | дублира `.10x/handoff.md` |
| sync-docs | 240 | 2 skills, 1 агент | ИЗЛИШЕН | — |
| adaptive-agent | 192 | 2 skills | ИЗЛИШЕН | — |
| superdesign | 190 | 1 skill | ИЗЛИШЕН | външна услуга |
| superdevflow | 183 | 5 skills | ИЗЛИШЕН | — |
| prompt-optimizer | 176 | 1 skill | ИЗЛИШЕН | — |
| sync-my-skills | 165 | 1 skill | ИЗЛИШЕН | — |
| prompt-tightener | 155 | 3 skills | ИЗЛИШЕН | — |
| agent-discussion | 142 | 1 skill | ИЗЛИШЕН | — |
| god-prompt-mcp | 141 | 1 skill, 1 MCP (`npx -y god-prompt-mcp@1.0.33`, свързан) | ИЗЛИШЕН | npx изпълнява външен код |
| senior-developer | 136 | 1 skill | ИЗЛИШЕН | — |
| skill-reviewer | 130 | 1 skill | ИЗЛИШЕН | — |
| auto-research | 128 | 1 skill | ИЗЛИШЕН | — |
| cc-bootstrapper | 98 | 1 skill | ИЗЛИШЕН | — |
| skill-validator | 84 | 2 skills | ИЗЛИШЕН | — |
| docker-image-scan | 69 | 1 skill | ИЗЛИШЕН | няма Docker |
| claude-cursor-orchestration | 46 | 1 skill, 1 hook | ИЗЛИШЕН | — |
| virtual-team | 43 | 1 skill | ИЗЛИШЕН | — |
| sweetclaude / others ≤ 5 tok | — | вж. по-горе | — | — |

Изключени (44, `settings.local.json: false`, 0 токена): synthflow, browser-use, gitkraken, tinyfish, tavily, exa, buildkite, datarobot-agent-skills, qdrant, pixeltable, valtown, langfuse, ai-firstify, servicenow-sdk, qt-development-skills, auth0, vanta, desktop-commander, vpai, base44, zapier, pdf-viewer, box, adobe-for-creativity, twilio-developer-kit, small-business, product-tracking-skills, atlan, searchfit-seo, cloudinary, brightdata-plugin, figma, miro, fastly-agent-toolkit, sanity, slack-by-salesforce, nimble, enterprise-search, productivity, product-management, data, bio-research, customer-support, cowork-plugin-management, wix. Оценка: ИЗЛИШЕН (вече изключени; остават като записи).
Конфликт на име: `superpowers@synced` не е зареден, защото `superpowers@anthropic-plugin-directory` има предимство (безвреден).

### 2.2 Собствени елементи на репото (`.claude/`)

| Име | Вид | Състояние | Какво прави | Оценка |
|---|---|---|---|---|
| botanist, designer, developer, qa, release, researcher, reviewer | агенти (7) | включени, проектен обхват | роли от конвейера на Флора 3 | ЗАДЪЛЖИТЕЛЕН |
| botanik, flora-approval-gate, flora-baseline, flora-release-pr, flora-svelte5-conventions, new-migration, preflight | skills (7) | включени | ботаническа строгост, нива на одобрение, статус, PR без merge, Svelte 5 конвенции, миграции, пълен набор преди PR | ЗАДЪЛЖИТЕЛЕН |
| guard-bash.sh (PreToolUse Bash) | hook | включен | блокира push към main и forced/delete push (локален скрипт, не праща нищо навън) | ЗАДЪЛЖИТЕЛЕН |
| protect-files.sh (PreToolUse Edit/Write) | hook | включен | блокира `.env*` (освен `.env.example`), `.git/`, вече commit-нати миграции | ЗАДЪЛЖИТЕЛЕН |
| guard-mcp.sh (PreToolUse `mcp__claude_ai_Github__.*`) | hook | включен | граници за GitHub connector | ЗАДЪЛЖИТЕЛЕН |
| related-tests.sh (PostToolUse) | hook | включен | пуска свързани unit тестове след редакция | ПОЛЕЗЕН |
| status-reminder.sh (Stop) | hook | включен | напомня за `.10x/` | ПОЛЕЗЕН |
| api-routes.md, migrations.md | rules (2, 1,5 KB общо) | включени | правила по пътища | ЗАДЪЛЖИТЕЛЕН |
| svelte (`.mcp.json`, HTTP `mcp.svelte.dev`) | MCP, проектен | свързан, одобрен | документация и `svelte-autofixer` | ЗАДЪЛЖИТЕЛЕН |

Бележка: **нито един hook не защитава снимките** (оригинали, `photos` bucket, `storage.objects`). Защитата е в RLS/кода и в `CLAUDE.md`, но не и техническа в Claude Code (виж Таблица Б).

### 2.3 Потребителски елементи (`~/.claude/`)

| Елемент | Съдържание | Оценка | Забележка |
|---|---|---|---|
| `agents/` | 6 PGE evaluators + 6 `.bak` копия | ИЗЛИШЕН | дублират `pge-orchestrator`; `.bak` са боклук |
| `commands/` | 12 `pge-*.md` | ИЗЛИШЕН | дублират skills на `pge-orchestrator` |
| `hooks/pge-autolaunch.sh` | hook на PGE | ИЗЛИШЕН | непроверено дали е закачен |
| `skills/synced/` | синхронизирани от claude.ai | вж. плъгини | — |
| `settings.json` | `model: sonnet`, `outputStyle: Explanatory`, `enableWorkflows: true`, `autoMode` (3 soft_deny + описание на среда), `enabledPlugins` (1) | ПОЛЕЗЕН | Explanatory увеличава многословието |
| `CLAUDE.md` (user) | няма | — | — |

### 2.4 MCP сървъри на плъгини (24 заредени; от `claude mcp list`)

| Сървър | Тип | Състояние | Оценка |
|---|---|---|---|
| plugin:playwright:playwright | stdio `npx @playwright/mcp@latest` | свързан | ПОЛЕЗЕН (чака одобрение) |
| plugin:god-prompt-mcp | stdio `npx -y …@1.0.33` | свързан | ИЗЛИШЕН |
| plugin:pge-orchestrator | stdio node (локален bridge) | свързан | ИЗЛИШЕН |
| plugin:icons8:icons8mcp | HTTP | свързан | ИЗЛИШЕН |
| plugin:context7:context7 | HTTP | чака вход | ПОЛЕЗЕН (дублира connector) |
| plugin:supabase:supabase | HTTP | чака вход | ПОЛЕЗЕН (дублира connector) |
| plugin:github:github | HTTP | **СЧУПЕН** (400) | СЧУПЕН |
| plugin:agent-memory:agent-memory | stdio python | **СЧУПЕН** | СЧУПЕН |
| plugin:design:{slack,figma,linear,atlassian,notion,intercom} | HTTP | чакат вход | ПО ИЗБОР/ИЗЛИШЕН |
| plugin:engineering:datadog, docket-tracker:courtlistener | HTTP | чакат вход | ИЗЛИШЕН |
| plugin:design:{gmail,google calendar}, plugin:engineering:{gmail,google calendar} | HTTP | изключени за проекта | ИЗЛИШЕН |

### 2.5 Connectors от claude.ai (80 видими в `claude mcp list`)

- **Свързани (18):** Claude Docs, Magic Patterns, Mobbin, Tseha.io, v0, Rams, Vercel, Website Generator by B12, komoot, Xweather, Google Calendar, Context7, Figma, Jentic, Booking.com, AllTrails, Gmail, Google Drive.
- **Чакат вход (57)**, **изключени за проекта (5):** SystemAudit, CircleCI, Subtext, Webflow, Sentry.
- **Разминаване:** connector-ите **Github** и **Supabase** не се виждат в `claude mcp list`, но в сесията има техни инструменти (`mcp__claude_ai_Github__*`, `mcp__claude_ai_Supabase__*`), а правилата в `.claude/settings.json` ги използват. Нека да се провери в Settings → Connectors. Статус: непроверено.
- Оценки: Vercel, Context7, Figma → ПОЛЕЗЕН (Figma по избор); Github, Supabase → ЗАДЪЛЖИТЕЛЕН (ако са активни); Google Drive/Gmail/Calendar → ПО ИЗБОР с лични данни; останалите (komoot, AllTrails, Booking.com, Xweather, Jentic, Tseha.io, B12, Mobbin, Rams, Magic Patterns, v0, Claude Docs) → ИЗЛИШЕН за Флора 3 (Rams е платен с кредити).

### 2.6 Hooks на плъгини

60 hooks (от `/reload-plugins`) в 13 събития (SessionStart 20, PostToolUse 33 и т.н. при сканиране на всички версии). Те са „harness-only“ — не струват токени. Потенциално по-ниско доверие: workflow-toolkit (7), claude-context-optimizer (6), sweetclaude (5, вкл. UserPromptSubmit и Stop), security-guidance (5). По регекс в `hooks.json` няма команди с `curl/wget/http`; **съдържанието на скриптовете не е четено** (непроверено дали пишат файлове или пращат нещо навън). Източникът на hook-а „prompt-coach“, който добави бележка към последното ми съобщение, не е в репото — непроверено.

### 2.7 Обобщение на оценките

| Оценка | Брой |
|---|---:|
| ЗАДЪЛЖИТЕЛЕН (собствени агенти, skills, hooks, rules, Svelte MCP; + connector-и Github/Supabase) | 7 + 7 + 3 + 2 + 2 rules + 1 MCP |
| ПОЛЕЗЕН (плъгини) | 7 |
| ПО ИЗБОР (плъгини) | 9 |
| СЧУПЕН | 2 (плъгини `github`, `agent-memory`) |
| ИЗЛИШЕН (плъгини) | 58 (+ 44 вече изключени) |

Общ контекстен разход: **≈ 86 000 токена от плъгини** + `CLAUDE.md` (8,8 KB ≈ 2 500 токена) + `.claude/rules` (≈ 400) + 7 проектни skills и 7 агента (не са измерени поотделно: непроверено) + MCP схеми при ToolSearch (отложени, не са в 86 000). Най-големи: agent-architecture-designer 12,3k · zizi-skills 7,8k · sweetclaude 5,4k · zsl 4,2k · pge-orchestrator 3,8k · ultrapowers-dev 3,7k · join-the-team 2,8k · docker-skills 2,6k · supermatt 2,6k · plugin-dev 2,4k.

## 3. Таблица Б — специфично за Флора 3

| Област | Състояние | Какво трябва да е | Разлика | Действие | Пример |
|---|---|---|---|---|---|
| Supabase (плъгин + connector + `supabase-expert`) | `supabase` плъгин чака вход; connector Supabase липсва в `mcp list`; permissions третират `apply_migration`, `execute_sql` като `ask` | един източник; write винаги с „Одобрявам“ | 3 припокриващи се източника; connector неясен | пази `supabase` плъгин + connector; махни `supabase-expert` | нова RLS политика: pgTAP тест + rollback SQL, после кратко одобрение |
| RLS/Auth/Storage guidance | skill `supabase-postgres-best-practices` (в `supabase` плъгина) | наличен при миграции | липсва проектен hook към `supabase/migrations` освен protect-files | остава | подписани URL за `photos`: `createSignedUrl` само от сървъра |
| GitHub | плъгин `github` СЧУПЕН; connector Github (непроверен); `gh` 2.102 работи през CLI | push/PR през `git`/`gh`; MCP read-only | дублиране; няма write право на connector (по status.md) | махни плъгина `github`; държи `gh` | PR вместо merge: `gh pr create` на `feat/…`, без `gh pr merge` (в deny) |
| Vercel | connector свързан; `vercel` CLI липсва | read-only плюс `ask` за write | ask покрива само 7 инструмента, а Vercel има десетки write (firewall, DNS, домейни, `upload_file`, `cancel_deployment`, `create_project`…) | добави в `ask` или `deny` (т. 5 във Фаза 5) | преглед на preview на PR: `get_deployment`, `get_runtime_logs` |
| Figma/design | connector Figma свързан; плъгин `figma` изключен; 9 `design` MCP чакат вход | по избор | външни услуги без нужда | остави connector, изключи `design` MCP-тата | макет „Хербарий“ → токени → CSS променливи |
| Playwright / e2e | плъгин `playwright` свързан (`@latest`); `npm run test:e2e` съществува (CI) | `CLAUDE.md`: не е одобрен → пълен Approval Gate | **противоречие с `CLAUDE.md`/status** | реши: одобри (и закрепи версия) или махни | мобилен тест на 360 px: `npm run test:e2e` (Pixel 7), screenshots 360/1280 |
| TypeScript/Svelte помощ | `svelte` MCP свързан; `typescript-native-lsp` зареден; `npm run check` | да | OK | остава | `svelte-autofixer` след всеки `.svelte` |
| security-guidance | зареден (5 hooks) | да | OK | остава | предупреждава при `innerHTML`/`eval` в Svelte |
| botanik | `.claude/skills/botanik` + `anthropic-skills:botanik` (качен в claude.ai) | един | **дубъл** | остави проектния; махни качения от Settings (Ж) | проверка на таксономия през GBIF; AI резултат = „възможен кандидат“ |
| Context7 | connector свързан + плъгин чака вход | един | дубъл | пази connector, махни плъгина | `use context7` за актуален SvelteKit 2 API |
| Permissions: production и merge | deny: push main/force/delete, `gh pr merge`, `git branch -D`, `supabase db push`, `.env`; ask: миграции, SQL, Vercel env | + `vercel --prod`, `rm -rf`, `DROP`, `git merge`, `git reset --hard`, `gh api` | липсват | допълни (Фаза 5, Г) | опит за `DROP TABLE` през SQL → блокирано |
| Hooks за снимки | няма (оригиналите са защитени само от кода/RLS и правилата) | hook блокира `rm`/`mv`/презапис върху директории с оригинали и `storage` DELETE през SQL | **празнина** | вж. „Липсва“ | „Оригиналните снимки никога не се презаписват“ |
| Hooks за secrets | protect-files + deny Read(.env) + gitleaks (CI) | да | OK; `settings.local.json` е само с имена | остава | `cat .env.local` → блокирано |
| Тестови команди | `check`, `test:unit`, `test:integration`, `test:db`, `test:e2e`, `db:reset`, `build`, `db:*` съществуват | да | `build` пада локално (symlink EPERM) — известно; `supabase`/`docker` липсват → `db:reset`/`test:db` не могат локално | пускай в CI (`db-e2e`) | `npm run test:unit` е в allow |
| `.10x` файлове | `status.md` 3,7 KB, `handoff.md` 0,7 KB | отразяват реалността | status казва, че `chore/ci-full` чака merge, а `git log` показва „Merge pull request #32 … chore/ci-full“ | обнови (отделна задача, не в одита) | в края на задачата: `status.md` |
| Правила в `CLAUDE.md` | 8,8 KB, подробни | да | няма противоречие по снимки/merge/secrets; противоречие само за Playwright | остава | „AI резултат е възможен кандидат“ |
| `settings.local.json` | `enableAllProjectMcpServers: true`, `enabledMcpjsonServers: [svelte]` | одобряване по име | първото одобрява автоматично всеки бъдещ сървър от `.mcp.json` | премахни `enableAllProjectMcpServers` | нов сървър в `.mcp.json` не трябва да тръгва без одобрение |
| Автоматичен режим | `autoMode` е настроен (среда, 3 soft_deny) | с точен опис на среда | `autoMode.environment` казва „no git remote configured“, а remote съществува (`origin`) | поправи описанието | — |

**Липсва и би помогнало (нищо не е инсталирано):**
1. Hook за снимките (блокира `rm`, `mv`, `>` върху пътища с оригинали и SQL `DELETE FROM storage.objects`).
2. `deny/ask` за `rm -rf`, `DROP`, `TRUNCATE`, `vercel --prod`, `git merge`, `git reset --hard`, `gh api`.
3. Локален Supabase: Docker и `supabase` CLI (за `db:reset`, `test:db`); засега само в CI.
4. `uv/uvx` и Python — нужни само ако се пази MCP/плъгин на Python; иначе не са нужни.
5. SHA закрепване на GitHub Actions (сега `@v7` тагове) и Dependabot за actions.
6. Актуализирано `.10x/status.md`.
7. Закрепена версия на Playwright MCP (вместо `@latest`), след одобрение.

## 4. Анализ и препоръка

### 4.1 Най-подходящи (12)

| № | Елемент | Причина | Настройка | Как да работя | Какво НЕ позволявам |
|---|---|---|---|---|---|
| 1 | 7 проектни агента | конвейерът в `CLAUDE.md` | остават | „пусни `qa` за промените“ | `developer` да ревюира собствения код |
| 2 | 7 проектни skills | правилата на Флора | остават | `/preflight`, `/new-migration <име>` | пропускане на pgTAP/rollback |
| 3 | hooks guard-bash/protect-files/guard-mcp | технически защити | остават; допълни `deny` | — | редакция на commit-нати миграции |
| 4 | Svelte MCP | официален | остава | „провери компонента със `svelte-autofixer`“ | автоматично одобряване на нови сървъри |
| 5 | connector Supabase | схема, advisors, логове | read в allow, write в ask | „покажи advisors за security“ | `execute_sql` с запис без „Одобрявам“; `delete/reset/pause` |
| 6 | connector Github + `gh` | PR-и | push само `feat|fix|chore/*` | „отвори PR и покажи CI“ | merge, force-push, delete |
| 7 | connector Vercel | preview, логове | read в allow | „виж runtime logs на preview“ | `--prod`, env, домейни, firewall |
| 8 | superpowers | дебъг, TDD, верификация | остава | `systematic-debugging` при дефект | да замести `flora-svelte5-conventions` |
| 9 | security-guidance | hooks без токени | остава | — | да се изключва заради шум |
| 10 | typescript-native-lsp | типови грешки веднага | остава | — | — |
| 11 | Context7 (connector) | актуални API | остава един | „провери в Context7 `load` на SvelteKit“ | замяна на проверка с тестове |
| 12 | Playwright MCP | снимки 360/1280 | **след одобрение**, версия закрепена | „снимай `/plants` при 360 px“ | достъп до production с вход; `browser_run_code_unsafe` |

### 4.2 Конфликти и дублиране

- **Процес:** `superpowers`, `sweetclaude`, `sixth-sense`, `skillquiver`, `supermatt`, `zsl`, `10x-Team`, `join-the-team`, `claude-code-toolkit`, `pge-orchestrator` — всички предлагат TDD/ревю/планиране и имат „MUST use“ описания; те теглят към други роли и формати (handoff, планове) освен конвейера `researcher → developer → qa → reviewer → release`.
- **Дубли на handoff:** `agent-handoff`, `handoff`, `zsl:handoff`, `skill-provenance` срещу `.10x/handoff.md`.
- **Дубли на агенти:** `qa`, `reviewer`, `designer`, `researcher` (проект) срещу `sweetclaude:*`, `claude-code-toolkit:*`, `qa-my-app`.
- **Дубли на интеграции:** Supabase (3×), Context7 (2×), GitHub (плъгин + connector + `gh`), `botanik` (проект + качен skill), PGE (плъгин + `~/.claude/{agents,commands}`).
- **Противоречия:** `CLAUDE.md` „Playwright още не е одобрен“ срещу зареден MCP; `autoMode` „няма remote“ срещу съществуващ `origin`; `status.md` срещу `git log`.

### 4.3 Външна услуга, цена, лични данни

- **Лични данни:** Gmail, Google Calendar, Google Drive (свързани), Slack/Notion/Atlassian (чакат вход).
- **Цена:** Rams (кредити), Icons8 (лимити), TogetherAI, v0, Magic Patterns, Website Generator by B12.
- **Мрежа/външен код:** `npx @playwright/mcp@latest`, `npx -y god-prompt-mcp`, 80 connectors.
- **Pl@ntNet/GBIF:** само през приложението и квотата; не през Claude Code.

### 4.4 Минимален набор и спестяване

Оставяш: проектните агенти/skills/hooks/rules, Svelte MCP, connector-и Supabase/Github/Vercel/Context7, плъгини `superpowers`, `supabase`, `security-guidance`, `typescript-native-lsp`, `frontend-design` (+ по избор `design-skills` и `playwright` след одобрение).
Плъгини: 840 + 636 + 80 + 0 + 0 ≈ **1 560 токена** (≈ 2 860 с `design-skills`) вместо ≈ 86 000. **Спестяване ≈ 83 000–84 000 токена на сесия (≈ 97 %)**, плюс по-малко конфликтни „MUST use“ описания. Числата са оценки на `claude plugin details`, не измерване на реалната сесия.

## 5. Команди за изчистване (само текст, не са изпълнени)

Проверено с `--help`: `claude plugin disable [-a] [-s user|project|local] [--json] [plugin]`, `claude plugin uninstall [--keep-data] [--prune] [-s …] <plugin>`, `claude plugin marketplace remove|rm [--scope …] <name>`, `claude mcp remove [-s local|user|project] <name>`. **Няма** `claude mcp disable`; изключване без изтриване става от `/mcp` (интерактивно) или с `permissions.deny` на `mcp__<сървър>__*`.
Важно: синхронизираните плъгини (`@synced`) идват от claude.ai. `disable`/`uninstall` на машината може да се върне при следващия sync, затова окончателното махане е от claude.ai (блок Ж). Командите долу работят локално; ако плъгинът се върне, виж Ж. Нищо не се изпълнява без `Одобрявам: изчистване по списъка` и посочени блокове.

Подготовка (общ backup, веднъж):
```powershell
$d = Get-Date -Format "yyyyMMdd"
$bk = "$HOME\.claude-archive-$d"
New-Item -ItemType Directory -Force $bk | Out-Null
Copy-Item "$HOME\.claude\settings.json"            "$bk\settings.json.bak-$d"
Copy-Item "$HOME\.claude\plugins\installed_plugins.json" "$bk\installed_plugins.json.bak-$d" -ErrorAction SilentlyContinue
Copy-Item ".\.claude\settings.json"                "$bk\project-settings.json.bak-$d"
Copy-Item ".\.claude\settings.local.json"          "$bk\project-settings.local.json.bak-$d"
```

### А) Плъгини
Деактивиране (обратимо) — по групи. Група А1 (счупени): `github`, `agent-memory`.
```powershell
claude plugin disable github
claude plugin disable agent-memory
# Връщане
claude plugin enable github
claude plugin enable agent-memory
```
Група А2 (големи и ненужни, ≈ 80k токена): 
```powershell
$off = "agent-architecture-designer","zizi-skills","sweetclaude","zsl","pge-orchestrator","ultrapowers-dev","join-the-team","docker-skills","supermatt","plugin-dev","togetherai-skills","skillquiver","sixth-sense","agentics-beyond-code","vectorlab-ux-skills","qa-my-app","icons8","writing-skills","workflow-toolkit","atomic-agents","unreal-engine-skills-for-claude-code","claude-context-optimizer","design-superpowers","10x-Team","githubclip","agent-handoff","claude-code-toolkit","skill-provenance","docket-tracker","mcp-apps","agent-context-kit","mcp2cli","mcp-server-dev","orch","senior-engineering-partner","prompt-brain","mcp-client-kit","senior-engineer-guardrails","prompt-design","platform-skills","handoff","sync-docs","adaptive-agent","superdesign","superdevflow","prompt-optimizer","sync-my-skills","prompt-tightener","agent-discussion","god-prompt-mcp","senior-developer","skill-reviewer","auto-research","cc-bootstrapper","skill-validator","docker-image-scan","claude-cursor-orchestration","virtual-team"
$off | ForEach-Object { claude plugin disable $_ }
# Връщане
$off | ForEach-Object { claude plugin enable $_ }
```
Премахване (по-силно; запази данните): 
```powershell
$off | ForEach-Object { claude plugin uninstall $_ --keep-data }
# Връщане: claude plugin install <име>@<marketplace>   (за @synced — от claude.ai, блок Ж)
```
Marketplace (само ако нищо от него не се ползва; `claude-plugins-official` не пипай):
```powershell
claude plugin marketplace list
# claude plugin marketplace remove <име>      # Връщане: claude plugin marketplace add anthropics/claude-plugins-official
```
Дублиращи MCP на плъгини, които остават (`context7`): `claude plugin disable context7` (connector-ът остава).

### Б) MCP сървъри (непроектни)
```powershell
claude mcp list
# Изтриване (виж обхвата от `claude mcp get <име>`):
# claude mcp remove <име> -s user
# Връщане: claude mcp add --transport http <име> <url>  (или stdio: claude mcp add <име> -- npx …)
```
Сървърите на плъгини се махат заедно с плъгина (А). Проектният `svelte` не се пипа. Изключване без изтриване: `/mcp` в сесията.

### В) Skills, агенти, команди, rules, memory — само в архив
```powershell
$d = Get-Date -Format "yyyyMMdd"; $a = "$HOME\.claude-archive-$d"
New-Item -ItemType Directory -Force "$a\agents","$a\commands","$a\hooks" | Out-Null
Move-Item "$HOME\.claude\agents\evaluator-*"   "$a\agents\"   # включва .bak
Move-Item "$HOME\.claude\commands\pge-*.md"    "$a\commands\"
Move-Item "$HOME\.claude\hooks\pge-autolaunch.sh" "$a\hooks\"
# Връщане
Move-Item "$a\agents\*"   "$HOME\.claude\agents\"
Move-Item "$a\commands\*" "$HOME\.claude\commands\"
Move-Item "$a\hooks\*"    "$HOME\.claude\hooks\"
```
Проектните `.claude/agents`, `skills`, `rules` и memory (празна) не се пипат.

### Г) Hooks и permissions (точни JSON блокове)
Резервно копие вече е направено в „Подготовка“. В `.claude/settings.json` → `permissions.deny` добави:
```json
"Bash(rm -rf:*)",
"Bash(rm -fr:*)",
"Bash(git merge:*)",
"Bash(git reset --hard:*)",
"Bash(vercel --prod:*)",
"Bash(vercel deploy --prod:*)",
"Bash(vercel *--prod*)",
"Bash(psql *DROP*)",
"Bash(supabase db reset --linked:*)",
"mcp__claude_ai_Vercel__put_firewall_config",
"mcp__claude_ai_Vercel__update_firewall_config",
"mcp__claude_ai_Vercel__replace_domain_dns_records",
"mcp__claude_ai_Vercel__add_project_domain",
"mcp__claude_ai_Vercel__create_project",
"mcp__claude_ai_Google_Drive__share_file",
"mcp__claude_ai_Google_Drive__trash_file",
"mcp__claude_ai_v0__chats_delete",
"mcp__claude_ai_v0__webhooks_delete"
```
В `permissions.ask` добави: `"mcp__claude_ai_Vercel__cancel_deployment"`, `"mcp__claude_ai_Vercel__upload_file"`, `"mcp__claude_ai_Vercel__update_route_versions"`, `"mcp__claude_ai_Supabase__apply_migration"` (вече е).
Бележка: шаблони като `Bash(psql *DROP*)` хващат само команди, пуснати през `psql` в Bash; SQL през MCP (`execute_sql`) се пази от `ask`. Правила за `DROP` в самия SQL не могат да се наложат с permissions: затова е `ask` на `execute_sql` (остава).
Hook за снимките (нов, след одобрение — предложение): `PreToolUse Bash` скрипт `guard-photos.sh`, който връща exit 2 при `rm|mv|>` върху пътища с `photos/originals` и при `DELETE FROM storage.objects`. Не е написан.
`settings.local.json`: премахни `"enableAllProjectMcpServers": true` (запази `enabledMcpjsonServers: ["svelte"]`).
Връщане: `Copy-Item "$bk\settings.json.bak-$d" ".\.claude\settings.json" -Force` и аналогично за `settings.local.json`.

### Д) Env променливи
В Claude Code settings няма `env` блок; в Windows среда имам само имена на вътрешни променливи на сесията (`CLAUDE_CODE_*`, `CLAUDE_EFFORT`) — не се махат. Няма какво да се чисти → блокът не се изпълнява.
```powershell
# [Environment]::SetEnvironmentVariable("ИМЕ", $null, "User")   # само ако посочиш име
```

### Е) Git/CI
Няма `.husky`, `core.hooksPath` не е зададен, в `.git/hooks` няма активни hooks → няма какво да се маха. Препоръки (без да се пипат файлове сега):
- `ci.yml`, `backup.yml`: закрепи `actions/checkout`, `setup-node`, `upload-artifact` със SHA (в момента `@v7` тагове); добави `github-actions` в `dependabot.yml`.
- `import-legacy.yml` ползва `NEW_SUPABASE_SECRET_KEY` и вече е в „Отложено“ в `status.md`; когато собственикът реши, махни го (PR).
- Права: две работи имат `contents: read`, една `permissions: {}` — добре.
- Клонове: `chore/ci-full`, `chore/node-22x` са влети (PR #31, #32), но `git branch --no-merged main` ги показва (локалният `main` вероятно е остарял) → собственикът ги трие в GitHub.

### Ж) Ръчни стъпки в Claude desktop / claude.ai
1. **Плъгини `@synced`:** claude.ai → Settings → Plugins (или Customize → Plugins) → изключи/премахни избраните. Точното име на менюто е непроверено (не го виждам от терминала); ако липсва, Settings → Features/Capabilities.
2. **Connectors:** Settings → Connectors → премахни ненужните (komoot, AllTrails, Booking.com, Xweather, Jentic, Tseha.io, Website Generator by B12, Mobbin, Rams, Magic Patterns, v0, Claude Docs; за Gmail/Calendar/Drive реши сам). Ако желаният connector се върне в `claude mcp list`, провери там, че е „Disabled for this project“ през `/mcp`.
3. **Качен skill `botanik`:** Settings → Skills (или Capabilities → Skills) → премахни дубъла `anthropic-skills:botanik`, ако не е нужен в други проекти.
4. Провери и дали `Github` и `Supabase` connectors са включени (в `mcp list` не се виждат).

### З) Общо връщане от backup-ите
```powershell
$d = "ГГГГММДД"   # датата от подготовката
$bk = "$HOME\.claude-archive-$d"
Copy-Item "$bk\settings.json.bak-$d"               "$HOME\.claude\settings.json" -Force
Copy-Item "$bk\project-settings.json.bak-$d"       ".\.claude\settings.json" -Force
Copy-Item "$bk\project-settings.local.json.bak-$d" ".\.claude\settings.local.json" -Force
Move-Item "$bk\agents\*"   "$HOME\.claude\agents\"   -ErrorAction SilentlyContinue
Move-Item "$bk\commands\*" "$HOME\.claude\commands\" -ErrorAction SilentlyContinue
Move-Item "$bk\hooks\*"    "$HOME\.claude\hooks\"    -ErrorAction SilentlyContinue
$off | ForEach-Object { claude plugin enable $_ }
claude plugin enable github; claude plugin enable agent-memory
```
Не са включени в изчистването: botanik, Supabase, GitHub, Figma, Playwright, security-guidance, Context7 и всичко ЗАДЪЛЖИТЕЛНО. Счупените `github` и `agent-memory` предлагам да се **поправят** (виж по-долу), а не да се махат, ако ги искаш:
- `github`: пре-автентикация през `claude mcp login github` (синтаксис потвърден в `claude mcp --help`); ако connector-ът Github върши същата работа, плъгинът е излишен дубъл.
- `agent-memory`: нужен е Python в PATH; иначе остава изключен.

## 6. Какво не успях да проверя и защо

- **Съдържание на скриптовете на hooks** (на плъгини и `guard-bash.sh`/`guard-mcp.sh` отвъд редовете за push): непроверено дали пишат файлове или изпращат нещо навън.
- **Точен брой/имена на hooks:** 60 (по `/reload-plugins`) срещу 97 при мое сканиране на всички версии; не е изяснено кои са активни.
- **Токени на проектни skills, агенти, rules и MCP схеми:** не са измерени (само плъгини); `/context` не може да се пусне от Bash.
- **`claude mcp get <име>` за всеки сървър:** не съм го пускал поотделно (`mcp list` даде тип, адрес и здраве; обхватът user/project/local не е потвърден за всеки).
- **Connector-и Github и Supabase:** липсват в `mcp list`, а инструментите им са в сесията; статусът им е непроверен.
- **`gh pr list`** върна празен списък: не съм сигурен дали е автентикиран; отворени PR-и: непроверено.
- **Съдържание на `.env*`, `.credentials.json`, `settings.local.json` стойности:** не са четени по правило; има секретно съдържание в `~/.claude/.credentials.json` (OAuth), `.mcp.json` няма env ключове, `import-legacy.yml`/`backup.yml` ползват GitHub secrets по име (`NEW_SUPABASE_SECRET_KEY`, `SUPABASE_DB_URL`; стойностите са скрити). Файлът `.env.example` е единственият `.env*` в репото.
- **npx кеш:** `~/.npm/_cacache` не съществува (на Windows е `%LOCALAPPDATA%\npm-cache`), но два `npx` MCP-та са „Connected“ → npx работи; повреден кеш не е открит. `uv/uvx` липсват (счупва само Python плъгини).
- **Тестове:** не пуснах `db:reset`, `test:*`, `build`, `check` (само потвърдих, че скриптовете съществуват: `dev, build, preview, prepare, check, db:start, db:stop, db:reset, db:types, env:local, test:unit, test:integration, test:db, test:e2e, import:legacy`); на машината няма Docker/Supabase CLI.
- **Разминаване `.10x/status.md` ↔ код:** потвърдих само дали PR #32 е влят по `git log`; не сверявах останалото (98 растения, 118 снимки са от хоста, не са проверявани).
- **Памет:** папката `memory/` е празна; потребителски `CLAUDE.md` няма.
- **Точни имена на менютата в claude.ai/desktop** (блок Ж) — не са проверени.


----

****Disclaimer: От началото пише за клона, че е различен от main, но реално след това попитах powershell-a дали има значение:

"❯ а само да попитам в main branch-a на flora3 дали ще са по-различни нещата?
UserPromptSubmit hook error
Failed with non-blocking status code: security-guidance: no working Python 3 interpreter found.

Най-вероятно не, но ще го проверя с read-only git diff. Само файловете в репото зависят от клона, а плъгините, connectors и потребителските настройки са на ниво машина и акаунт.

  Ran 1 shell command
PostToolUse:Bash hook error
Failed with non-blocking status code: Pytt arguments to install from the MicrosoftStore, or disable this shortcut from Settings > Apps > Advanced app settings > App execu…

Не, в main нещата ще са същите.

git diff origin/main HEAD не показва разлика в CLAUDE.md, .claude/, .mcp.json, .10x/, .github/ и package.json. Командата за проверка е git diff --stat origin/main HEAD -- CLAUDE.md .claude .mcp.json .10x .github package.json. Конфигурацията на репото е еднаква на feat/plant-split-layout и на main.

- Не зависи от клона: плъгините (86 000 токена), connectors от claude.ai, ~/.claude/settings.json, ~/.claude/agents и commands, и средата (Node, gh, липсващите uv, docker, supabase). Те са на ниво машина и акаунт.
- Зависи от клона, но е еднакво сега: правилата за permissions, hooks, 7-те агента, 7-те skills, .mcp.json със Svelte MCP, workflows и CLAUDE.md.
- Само локално, не се качва: .claude/settingгини и enableAllProjectMcpServers) и новиятflora3-audit.md. .10x/proposals/ също е некомитнат. Затова на чист клон от main settings.local.json може да липсва.

Локалният main изостава с 10 къса от origin/ git branch --no-merged показа chore/ci-fullи chore/node-22x като незалети: те вече са влети в origin/main. Състоянието на main в GitHub не съм проверявал поотделно, защото gh върна празно.

flora3-audit.md е в работната директория на feat/plant-split-layout и не е комитнат. Ако искаш да го пазиш, кажи ми дали да го вкарам в отделен chore/… клон с PR, или да го преместя извън репото. Merge е на собственика.