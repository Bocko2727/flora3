# DevOps — ai-statuses-redesign
План за пускане (НЕ е изпълнен, всяка стъпка с одобрение):
1. Push на `fix/post-launch-hardening` и `feat/ai-statuses-redesign` (вече е отгоре на hardening).
2. SQL Editor: editors_no_delete (ако липсва) → identification_status → проверка 0 confirmed → drop_self_confirm.
3. Vercel: `PLANTNET_API_KEY` (Production).
4. PR `feat/ai-statuses-redesign` → `main` (merge commit) → production deploy от main.
Rollback: SQL в README → „Миграции на хостнатия проект“; Vercel → Instant Rollback към предишния deployment.
