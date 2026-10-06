---
paths:
  - "supabase/migrations/**/*.sql"
  - "supabase/tests/**/*.sql"
---
- Нова таблица: ENABLE ROW LEVEL SECURITY + политики; запис само през `is_editor()`.
- Нов файл за всяка промяна; приложени миграции не се редактират.
- Към всяка миграция: pgTAP тест (`supabase/tests/`) и rollback SQL в описанието на PR.
- Не се прилагат към хоста без „Одобрявам: …“ (кратко одобрение, Project Instructions §5.2). Без `supabase db push`.
