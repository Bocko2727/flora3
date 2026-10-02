# SRE — ai-statuses-redesign
- Наблюдение: Vercel runtime logs — търси `consume_identify_quota failed`, `GBIF name check failed`, `Pl@ntNet`.
- Квота: `select * from public.api_usage order by day desc limit 7;` (SQL Editor).
- Runbook: AI не отговаря → записът работи; провери ключа във Vercel и `remainingIdentificationRequests`. GBIF недостъпен → бутон „Провери името в GBIF“ по-късно.
- SLO: няма (личен проект, $0).
