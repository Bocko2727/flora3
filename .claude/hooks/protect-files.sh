#!/bin/bash
# Защитава .env* (освен .env.example), .git/ и вече commit-нати миграции (само нови файлове).
INPUT=$(cat)
if command -v jq >/dev/null 2>&1; then
  FILE_PATH=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')
else
  # Без jq (Git Bash на Windows): извличане със sed; Windows \\ стават /.
  FILE_PATH=$(printf '%s' "$INPUT" | tr -d '\n\r' | sed -e 's/\\\\/\//g' \
    | sed -n 's/.*"\(file_path\|notebook_path\)"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\2/p')
fi
FILE_PATH=${FILE_PATH//\\//}  # Windows \ → /
[[ -z "$FILE_PATH" ]] && exit 0
BASE=$(basename "$FILE_PATH")
if [[ "$BASE" == .env* && "$BASE" != ".env.example" ]] || [[ "$FILE_PATH" == *"/.git/"* || "$FILE_PATH" == .git/* ]]; then
  echo "Blocked: $FILE_PATH е защитен (secrets/история, Project Instructions §5.1)." >&2
  exit 2
fi
if [[ "$FILE_PATH" == *"supabase/migrations/"* ]] && git -C "${CLAUDE_PROJECT_DIR:-.}" ls-files --error-unmatch "$FILE_PATH" >/dev/null 2>&1; then
  echo "Blocked: миграцията вече е в git. Създай нова, не редактирай стара." >&2
  exit 2
fi
exit 0
