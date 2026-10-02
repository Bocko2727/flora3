# Architect — ai-statuses-redesign
Виж ADR-001.
- Компоненти: `/api/identify` → `lib/server/identify.ts` → `external/plantnet.ts`; `lib/server/verification.ts` (GBIF, iNat); SQL `id_status()`, `consume_identify_quota()`; UI `AiSuggestions`, `Evidence`, `StatusBadge`, `Pagination`.
- Потоци: браузър → копия 1024px → endpoint → Pl@ntNet; запис → protocol + GBIF (неблокиращо).
- Отказ: всяка външна грешка → съобщение, записът продължава.
