# DBA — ai-statuses-redesign
- `identifications` (неизменим за клиента, каскада с растението), `api_usage` (само чрез RPC), колони gbif_*/inat_*/name_source.
- `id_status(plants)` stable SQL; праг 0,30. Индекс `identifications (plant_id, created_at desc)`.
- Миграция 2 маха `status`/`confirmed_at` — преди нея: `select count(*) from public.plants where status='confirmed'` = 0.
- Изрични grants (хостнатият проект не дава права по подразбиране).
