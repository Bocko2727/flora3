# Staff — ai-statuses-redesign
- Инжектируем `fetchFn` във всички външни клиенти; маршрутите подават `externalFetch()`.
- `UserFacingError` за български съобщения; техническото → console.error; ключът никога в лог.
- Споделени типове без сървърни импорти: `lib/identify/types.ts`.
- zod на всяка граница (скритото поле `identification`).
