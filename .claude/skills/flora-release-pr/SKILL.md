---
name: flora-release-pr
description: Подготвя и отваря PR за Флора 3 — проверка на diff-а за обхват и secrets, preflight резултат, описание с тестове и rollback, push на клона, отваряне на PR, проверка на CI и Vercel preview, обновяване на .10x/. Ползвай при „подготви PR“, „отвори PR“, „готово е“, в края на задача на feat/fix/chore клон. Никога не merge-ва.
---

# Флора 3 — Release PR

Push на клон и отваряне на PR са свободни (§5.3): правиш ги сам, без питане. Merge в `main` е production deploy и е само на собственика.

## 1. Проверка преди push
1. Клонът е `feat/…`, `fix/…` или `chore/…`, не `main`: `git branch --show-current`.
2. `git fetch` и `git log --oneline origin/main..HEAD` — само commit-ите на задачата. Без rebase на вече push-нат клон (иска force-push, §5.1); при нужда `git merge origin/main` в клона.
3. `git diff origin/main...HEAD --stat` и пълният diff:
   - само обещаното; без странични refactor-и;
   - без `.env*`, ключове, URL с токени, временни файлове, screenshot-и с лични данни;
   - без редакция на приложена миграция;
   - без снимки или бинарни файлове, освен ако задачата не е такава.
4. `/preflight` (или съответните стъпки). Пропуснатото пише „ПРОПУСНАТО: <причина>“ — не е минало.
5. Друг агент (Ревизор) дава присъда APPROVE. Авторът не одобрява сам себе си.

## 2. Push и PR
- `git push -u origin <клон>` (само форматът от allow списъка).
- `gh pr create --base main --head <клон> --title "<тип>: <кратко>" --body-file <файл>`. GitHub MCP connector-ът няма право да обновява описание (403) — за редакция `gh pr edit`. В облачна сесия `gh pr create` пада с „GraphQL not available“: ползвай REST — `gh api repos/Bocko2727/flora3/pulls --raw-field title=… --raw-field head=<клон> --raw-field base=main --field body=@<файл>` (без `-f`: `guard-bash.sh` блокира командни редове с този флаг). След push в плитък клон: `git fetch origin +refs/heads/<клон>:refs/remotes/origin/<клон>`, иначе stop-хукът дава фалшиво „unpushed commits“.
- Един логически проблем = един PR. Миграция в хоста не влиза „тихо“ в PR: тя е §5.2 и има отделно „Одобрявам: …“.

## 3. Описание на PR

```markdown
## Какво
<1–3 изречения>

## Защо
<проблем или решение на собственика>

## Промени
- `<път>` — <какво>

## Тестове
<резюмето от /preflight>

## Screenshot-и (ако има UI)
360 px и 1280 px, преди и след.

## Rollback
- Revert на PR-а: `git revert -m 1 <merge SHA>` (през нов PR).
- <SQL rollback, ако има миграция — прилага се само с одобрение>

## Не е променено
<какво съзнателно не е пипано>

## За собственика
- [ ] CI е зелен
- [ ] Vercel preview работи (вход, каталог, снимки)
- [ ] Merge (твоя стъпка)
```

## 4. След отварянето
1. `gh pr checks <номер>` — изчакай CI; при червено поправяш на същия клон (макс. 3 опита с нова хипотеза).
2. Vercel preview за клона: `list_deployments` само с четене; READY ли е.
3. Добави отчет в `.10x/handoff.md` (формат от `CLAUDE.md`) и обнови `.10x/status.md` — в същия клон, отделен commit.
4. Влети клонове: триенето е свободно по правилата, но `.claude/settings.json` блокира `git push --delete`; изброй ги за собственика.

## Никога
`gh pr merge`, push към `main`, force-push, пренаписване на история, промяна на настройки във Vercel/GitHub.
