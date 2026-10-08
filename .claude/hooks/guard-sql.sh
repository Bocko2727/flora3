#!/bin/bash
# PreToolUse hook за SQL през Supabase MCP (Project Instructions §5.1, §7). Работи без jq.
#  Блокира SQL, който трие или променя Storage обекти (оригиналните снимки)
#  или руши схемата/данните. Такова действие минава само през пълен Approval Gate,
#  изпълнено от собственика в SQL Editor.
INPUT=$(cat)
# Без нови редове, кавички и обратни наклонени, за да хване и "storage"."objects".
FLAT=$(printf '%s' "$INPUT" | tr '\n\r' '  ' | tr -d '"\\')
if printf '%s' "$FLAT" | grep -Eiq '(drop[[:space:]]+(table|schema|database|bucket)|truncate[[:space:]]|delete[[:space:]]+from[[:space:]]+(storage\.)?objects|update[[:space:]]+(storage\.)?objects|delete[[:space:]]+from[[:space:]]+(public\.)?(plants|photos))'; then
  echo "Blocked: SQL засяга снимките (storage.objects), растенията или руши схемата. Нужен е пълен Approval Gate (§5.1); изпълнява го собственикът." >&2
  exit 2
fi
exit 0
