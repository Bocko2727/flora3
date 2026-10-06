#!/bin/bash
# Stop hook: напомня (без да блокира) за .10x/status.md и handoff.md,
# когато клонът има commit-и спрямо main, а .10x/ не е пипан.
INPUT=$(cat)
# Не зацикляй: ако Claude вече продължава заради Stop hook, не напомняй пак.
printf '%s' "$INPUT" | grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true' && exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
BRANCH=$(git branch --show-current 2>/dev/null)
[[ -z "$BRANCH" || "$BRANCH" == "main" ]] && exit 0
AHEAD=$(git rev-list --count main..HEAD 2>/dev/null || echo 0)
[[ "$AHEAD" -eq 0 ]] && exit 0

if git diff --quiet main...HEAD -- .10x/ 2>/dev/null && git diff --quiet -- .10x/ 2>/dev/null; then
  # systemMessage се показва на потребителя; exit 0 не спира Claude.
  printf '{"systemMessage":"Напомняне: клонът %s има %s commit-а, а .10x/status.md и .10x/handoff.md не са обновени (CLAUDE.md, „Памет между сесии“)."}\n' "$BRANCH" "$AHEAD"
fi
exit 0
