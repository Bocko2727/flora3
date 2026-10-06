# Handoff (2026-10-06)

## 2026-10-06 · оркестратор (Claude Code) · chore/claude-automation
Статус: DONE (чака CI и merge от собственика; ask правилата — ръчно)
Резултат: MCP `deny` (GitHub merge/delete repo, Supabase branch/project, Vercel pause/домейни); `guard-mcp.sh` блокира запис през GitHub MCP в `main` или без branch; PostToolUse `related-tests.sh` (vitest related); Stop `status-reminder.sh`; умения `/preflight` и `/new-migration`; ревизор т. 8 (MCP); CLAUDE.md; `*.bundle` в `.gitignore` (излишният bundle — head 3bb9c20 е в main — изтрит).
Променени файлове: `.claude/settings.json`, `.claude/hooks/{guard-mcp,related-tests,status-reminder}.sh`, `.claude/skills/{preflight,new-migration}/SKILL.md`, `.claude/agents/reviewer.md`, `CLAUDE.md`, `.gitignore`, `.10x/status.md`, `.10x/handoff.md`
Доказателства: hook-ове с JSON на stdin — guard-mcp 7/7, related-tests 3/3, status-reminder 4/4 (вкл. JSON systemMessage); `bash -n` OK. Ревизор: CHANGES NEEDED → поправено (revoke all + truncate тест в шаблона; .10x staged/untracked; node_modules; /preflight). npm тестове НЕ са пускани: на машината няма Node.js, node_modules, Docker; промените не пипат src/.
Рискове / несигурност: auto mode отказа добавянето на MCP `ask` правила (apply_migration, execute_sql, Vercel env/promote/rollback, GitHub запис на файлове) — до ръчното им добавяне няма техническа защита за тях. guard-mcp не разпознава `\u` escape в името на клона (теоретично).
Следващ: собственикът — ask правилата, Approval Gate за Node/Docker/Svelte MCP, merge след зелен CI.

## 2026-10-06 · ревизор + оркестратор (claude.ai) · chore/github-tooling, поправки
Статус: DONE (чака CI и merge от собственика)
Резултат: hook-овете зависеха от `jq`: `guard-bash.sh` блокираше всяка Bash команда без jq (fail-closed), `protect-files.sh` пропускаше `.env` (fail-open). Добавено извличане със sed, когато jq липсва; нормализиране на Windows пътища; блок за `git push --all/--branches`; `.gitattributes` (`*.sh` с LF, иначе Git for Windows дава CRLF и bash спира); `CLAUDE.md` — Pl@ntNet „една заявка = до 5 снимки“ (по README/кода), вместо „1 заявка на снимка“.
Променени файлове: `.claude/hooks/guard-bash.sh`, `.claude/hooks/protect-files.sh`, `.claude/settings.json`, `.gitattributes`, `CLAUDE.md`, `.10x/handoff.md`
Доказателства: 34 случая (със и без jq), 0 грешки; JSON парснат; `bash -n` OK.
Рискове / несигурност: hook-овете не са пускани на реален Windows; проверката е в промпта за Claude Code.
Следващ: собственикът — локална проверка в Claude Code, после merge след зелен CI.

## 2026-10-06 · оркестратор · chore/github-tooling
Статус: DONE (чака merge от собственика)
Резултат: `CLAUDE.md`, `.claude/` (agents, rules, settings, hooks), CI фаза A, `.devcontainer/`, обновени `.10x/` и `.gitignore`. Production = `main` = 2ec452c; backup е зелен.
Доказателства: виж описанието на PR (локално пуснати `check`, `test:unit`, `build`; тест на hooks).
Рискове / несигурност: синтаксисът на `permissions` и hooks да се сверява с текущата документация на Claude Code; CI фаза A е първият ѝ run на PR.
Следващ: собственикът merge-ва PR-а → фаза B на CI (`chore/ci-full`) → дизайн (`feat/redesign`).

## Формат на отчет (за всички роли)
```
## <дата> · <роля> · <задача>
Статус: DONE / FAIL / BLOCKED
Резултат: <факти>
Променени файлове: <пътища или „няма“>
Доказателства: <тестове, линкове, screenshot-и, SHA>
Рискове / несигурност: <конкретно>
Следващ: <коя роля и защо>
```
