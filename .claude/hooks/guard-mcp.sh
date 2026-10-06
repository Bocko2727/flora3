#!/bin/bash
# PreToolUse hook за GitHub MCP (Project Instructions §5.1). Работи и без jq.
#  Блокира запис на файлове в main (create_or_update_file, push_files, delete_file)
#  и merge на PR — MCP инструментите заобикалят Bash правилата за git/gh.
INPUT=$(cat)
if command -v jq >/dev/null 2>&1; then
  TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty')
  BRANCH=$(printf '%s' "$INPUT" | jq -r '.tool_input.branch // empty')
else
  FLAT=$(printf '%s' "$INPUT" | tr -d '\n\r')
  TOOL=$(printf '%s' "$FLAT" | sed -n 's/.*"tool_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
  BRANCH=$(printf '%s' "$FLAT" | sed -n 's/.*"branch"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
fi

case "$TOOL" in
  *__merge_pull_request)
    echo "Blocked: merge на PR е само на собственика (Project Instructions §5.1)." >&2
    exit 2 ;;
  *__create_or_update_file|*__push_files|*__delete_file)
    if [[ -z "$BRANCH" || "$BRANCH" == "main" || "$BRANCH" == "refs/heads/main" ]]; then
      echo "Blocked: запис през GitHub MCP в main (или без branch) е забранен. Ползвай feat/fix/chore клон." >&2
      exit 2
    fi ;;
esac
exit 0
