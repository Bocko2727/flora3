# Handoff (2026-10-02)
- Код: `fix/ai-polish` е готов и тестван (виж `.10x/status.md`). Следва push и PR към `main`; merge прави собственикът в GitHub, Vercel пуска production сам.
- Хост: остава само `drop_self_confirm` (SQL Editor, собственикът).
- Ръчно от собственика: истински Pl@ntNet тест от телефона (A3), backup secret `SUPABASE_DB_URL` + ръчно пускане на backup (A6).
- След A3 провери с четене: ред в `api_usage`, ред в `identifications` с вярно `photo_count`.
