---
name: preflight
description: Пълният тестов набор на Флора 3 преди PR — по реда от CLAUDE.md, спира при първата грешка и дава резюме с изхода за PR описанието и .10x/handoff.md.
disable-model-invocation: true
---

# /preflight

Пусни командите **по ред**, всяка поотделно и точно както са написани (така съвпадат с allow правилата в `.claude/settings.json`). Без префикс `FLORA_OFFLINE_EXTERNAL=1`: e2e го задава в `playwright.config.ts`, unit тестовете mock-ват мрежата; в CI е в `env` на job-а.

1. `npm run db:reset` (локална база; изисква Docker и `npm run db:start`)
2. `npm run test:db`
3. `npm run test:unit`
4. `npm run test:integration`
5. `npm run test:e2e`
6. `npm run check`
7. `npm run build`

Правила:
- Спри при първата грешка. Не продължавай „за да видим останалото“, не пускай повторно без нова хипотеза (макс. 3 опита за дефект).
- Не отслабвай, не пропускай (`.skip`, `--passWithNoTests`) и не триеш падащ тест.
- Ако липсва среда (няма Docker → стъпки 1, 2, 4, 5), напиши ясно „ПРОПУСНАТО: <стъпка> — <причина>“. Пропуснато ≠ минало.
- Никога `supabase db push` и никакви заявки към хоста.

## Резюме (за PR и handoff)

```
Preflight · <клон> · <SHA>
db:reset ......... OK / FAIL / ПРОПУСНАТО (<причина>)
test:db .......... OK (N теста) / ...
test:unit ........ OK (N файла, M теста) / ...
test:integration . ...
test:e2e ......... ...
check ............ OK (0 errors, 0 warnings) / ...
build ............ OK / ...
```

Под таблицата: последните ~20 реда от изхода на първата паднала стъпка (без secrets/URL с ключове).
