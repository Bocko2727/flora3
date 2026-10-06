#!/bin/bash
# PostToolUse hook: след редакция на src/**/*.ts|svelte пуска само свързаните unit тестове.
# Неуспех → exit 2, за да види Claude грешката веднага. Без външни API (FLORA_OFFLINE_EXTERNAL=1).
INPUT=$(cat)
if command -v jq >/dev/null 2>&1; then
  FILE_PATH=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty')
else
  FILE_PATH=$(printf '%s' "$INPUT" | tr -d '\n\r' | sed -e 's/\\\\/\//g' \
    | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
fi
FILE_PATH=${FILE_PATH//\\//}
case "$FILE_PATH" in
  */src/*.ts|*/src/*.svelte|src/*.ts|src/*.svelte) ;;
  *) exit 0 ;;
esac
[[ "$FILE_PATH" == *database.types.ts ]] && exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
# Без Node или без npm ci (напр. нова машина) — тихо пропусни, не блокирай редакциите.
command -v npx >/dev/null 2>&1 && [[ -x node_modules/.bin/vitest || -f node_modules/vitest/package.json ]] || exit 0
OUT=$(FLORA_OFFLINE_EXTERNAL=1 timeout 90 npx --no-install vitest related "$FILE_PATH" \
  --run --project unit --passWithNoTests --reporter=dot 2>&1)
STATUS=$?
if [[ $STATUS -ne 0 && $STATUS -ne 124 ]]; then
  echo "Свързаните unit тестове за $FILE_PATH паднаха:" >&2
  printf '%s\n' "$OUT" | tail -40 >&2
  exit 2
fi
exit 0
