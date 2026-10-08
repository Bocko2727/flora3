#!/bin/bash
# Самопроверка на guard-hooks: bash .claude/hooks/test-hooks.sh
# Код 0 = всички случаи минават. Не вика мрежа и не пипа данни.
D="$(cd "$(dirname "$0")" && pwd)"
FAIL=0
check() { # $1 hook, $2 очакван код, $3 JSON вход
  printf '%s' "$3" | bash "$D/$1" >/dev/null 2>&1
  local got=$?
  if [[ "$got" != "$2" ]]; then echo "FAIL $1 (очаквано $2, получено $got): $3"; FAIL=1; fi
}
SQL='{"tool_name":"mcp__Supabase__execute_sql","tool_input":{"query":"%s"}}'
for q in 'select count(*) from plants' 'create index on plants(name)'; do
  check guard-sql.sh 0 "$(printf "$SQL" "$q")"
done
for q in 'DELETE FROM storage.objects where 1=1' 'update \"storage\".\"objects\" set name=1' \
         'drop table plants' 'TRUNCATE photos' 'delete from public.plants where id=1'; do
  check guard-sql.sh 2 "$(printf "$SQL" "$q")"
done
check guard-mcp.sh 2 '{"tool_name":"mcp__Github__merge_pull_request","tool_input":{}}'
check guard-mcp.sh 2 '{"tool_name":"mcp__claude_ai_Github__enable_pr_auto_merge","tool_input":{}}'
check guard-mcp.sh 2 '{"tool_name":"mcp__Github__create_or_update_file","tool_input":{"branch":"main"}}'
check guard-mcp.sh 0 '{"tool_name":"mcp__Github__create_or_update_file","tool_input":{"branch":"chore/x"}}'
check guard-mcp.sh 0 '{"tool_name":"mcp__Github__list_pull_requests","tool_input":{}}'
[[ $FAIL == 0 ]] && echo "OK: всички проверки на hooks минават."
exit $FAIL
