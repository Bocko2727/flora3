#!/bin/bash
# PreToolUse hook за Bash (Project Instructions §5.1). Fail-closed.
#  1) git push към main, force-push и git push, докато текущият клон е main;
#  2) четене на .env* през shell (освен .env.example).
if ! command -v jq >/dev/null 2>&1; then
  echo "Blocked: jq липсва, hook-ът не може да провери командата (fail-closed)." >&2
  exit 2
fi
INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
[[ -z "$CMD" ]] && exit 0

if echo "$CMD" | grep -Eq '(^|[;&|(] *|&& *)git( +(-C +[^ ]+|-c +[^ ]+|--no-pager))* +push'; then
  # Клонът, на който се стои (или този от -C)
  DIR=$(echo "$CMD" | sed -nE 's/.*git +-C +([^ ]+).*/\1/p' | head -1)
  BRANCH=$(git -C "${DIR:-${CLAUDE_PROJECT_DIR:-.}}" branch --show-current 2>/dev/null)
  if [[ "$BRANCH" == "main" ]] || echo "$CMD" | grep -Eq '(^| |:)(main|refs/heads/main)( |$)'; then
    echo "Blocked: push към main е забранен (Project Instructions §5.1). Работи на feat/fix/chore клон; merge е на собственика." >&2
    exit 2
  fi
  if echo "$CMD" | grep -Eq '(^| )(--force|-f|--force-with-lease(=[^ ]*)?|--delete|-d|--mirror)( |$)|(^| )\+[^ ]+|(^| )-[a-zA-Z]*f[a-zA-Z]*( |$)'; then
    echo "Blocked: force-push/изтриване на remote ref е забранено (Project Instructions §5.1)." >&2
    exit 2
  fi
fi

# Четене на .env* през shell (не и .env.example)
if echo "$CMD" | grep -Eq '(^|[;&|(] *)(cat|less|more|head|tail|grep|rg|sed|awk|source|\.|cp|mv|base64|xxd|od|strings|bat) +[^;&|]*\.env([.a-zA-Z_-]*)?( |$|;|&|\|)' \
   && ! echo "$CMD" | grep -Eq '\.env\.example'; then
  echo "Blocked: четене на .env* е забранено (secrets, Project Instructions §5.1)." >&2
  exit 2
fi
exit 0
