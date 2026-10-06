---
paths:
  - "src/routes/api/**/*.ts"
---
- Валидирай входа на всеки endpoint (zod); проверявай `is_editor()` за запис.
- Supabase клиент на сървъра — с потребителската сесия; secret/service-role ключ само в изрично маркирани сървърни задачи и никога в client код.
- `/api/identify`: вика Pl@ntNet само след действие на потребителя; преди това `consume_identify_quota`; без двойни заявки; резултатът не се записва автоматично.
- GBIF проверката е server-side; записва се с източник и дата на проверка.
- Външните API се mock-ват в тестовете (`FLORA_OFFLINE_EXTERNAL=1`).
