# Сайт ООО «Интегро»

Корпоративный сайт: оценочная деятельность, судебная экспертиза, экспертные исследования.

Стек: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Lucide. Шрифт — IBM Plex Sans (SIL OFL 1.1),
подключён локально через `next/font/local` (`src/fonts/`), без запросов к внешним сервисам. Одно Next.js-приложение,
без отдельного backend, базы данных и внешних платных сервисов. Отправка формы — Server Action + SMTP.

## Команды

```bash
npm ci              # установка зависимостей
npm run dev         # разработка, http://localhost:3000
npm run typecheck   # проверка TypeScript
npm run lint        # ESLint
npm run build       # production-сборка
npm start           # запуск production-сервера (порт из переменной PORT, по умолчанию 3000)
```

Node.js: 20.9 или новее (рекомендуется 22, см. `.nvmrc`).

## Где что менять

| Что | Файл |
| --- | --- |
| Название, контакты, реквизиты, часы связи, домен, дата редакции юр. документов | `src/config/company.ts` |
| Адреса и названия юридических документов | `src/config/legal.ts` |
| Текст политики обработки ПД | `src/app/pravovaya-informaciya/politika-obrabotki-personalnyh-dannyh/page.tsx` |
| Текст согласия (страница и форма — один источник) | `src/content/legal/consent.tsx` |
| Услуги (тексты, правовая основа, перечни) | `src/config/services.ts` |
| Навигация, порядок работы, принципы, FAQ, оплата | `src/config/content.ts` |
| Специалисты (раздел выводится, если список не пуст) | `src/config/team.ts` |
| Цвета, типографика, общие стили | `src/app/globals.css` |
| Изображение для соцсетей | `public/og.png` |
| Логотип (знак) и фавиконы | `public/brand/logo-mark.png`, `src/app/icon.png`, `src/app/apple-icon.png`, `src/app/favicon.ico`; исходник — `assets/brand/logo-source.jpeg` |

Пустые поля (`null`) на сайте не выводятся — заглушек нет. Список недостающих данных — `CONTENT_TODO.md`,
юридические вопросы для владельца и юриста — `LEGAL_REVIEW.md`.

Пункты с `draft: true` в `services.ts` — типовые формулировки, требующие подтверждения. В режиме разработки
они видны с меткой «черновик», в production скрыты (можно показать переменной `SHOW_DRAFT_CONTENT=true`).

## Структура страниц

- `/` — главная
- `/uslugi`, `/uslugi/ocenka`, `/uslugi/sudebnaya-ekspertiza`, `/uslugi/ekspertnye-issledovaniya`
- `/o-kompanii`, `/poryadok-raboty`, `/kontakty` (форма заявки, якорь `#zayavka`)
- `/pravovaya-informaciya` — правовая информация:
  - `/pravovaya-informaciya/svedeniya-ob-organizacii`
  - `/pravovaya-informaciya/politika-obrabotki-personalnyh-dannyh`
  - `/pravovaya-informaciya/soglasie-na-obrabotku-personalnyh-dannyh`
- старые адреса `/politika-konfidencialnosti` и `/soglasie-na-obrabotku` — постоянный редирект (308)
- `/robots.txt`, `/sitemap.xml`, страница 404

## Переменные окружения

См. `.env.example`. Кратко:

- `SITE_URL` — основной домен (`https://...`). Нужен **и при сборке, и при запуске**. Пока не задан, сайт
  отдаёт `noindex` и `Disallow: /`, canonical не выводится.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`, `MAIL_TO` — отправка заявок.
  Без них форма отключена и честно сообщает, что приём заявок через сайт не подключён.

Секреты задаются только в панели хостинга, в репозиторий не попадают (`.env*` в `.gitignore`).

## Форма заявки

`src/app/kontakty/actions.ts` — серверная валидация, защита от спама (скрытое поле-ловушка, минимальное время
заполнения, ограничение 5 заявок за 14 минут с одного IP в памяти процесса, запись удаляется не позднее 15 минут),
отправка письма через `nodemailer`. Успех показывается только после фактической отправки письма SMTP-сервером.
Согласие на обработку ПД — отдельное поле без предварительной отметки, текст раскрывается в форме; дата редакции
согласия попадает в письмо. При изменении формы обновите политику (см. `LEGAL_REVIEW.md`).

Подойдёт SMTP почты на домене компании (например, почта Timeweb, Яндекс 360, Mail.ru для бизнеса).
Для Яндекс 360: `SMTP_HOST=smtp.yandex.ru`, `SMTP_PORT=465`, `SMTP_SECURE=true`, пароль приложения в `SMTP_PASSWORD`.

## Деплой на Timeweb Cloud (GitHub → push в main → автодеплой)

Приложению нужен Node.js-сервер (Server Actions, динамическая страница «Контакты»), поэтому статический
хостинг не подходит. Возможны два варианта в Timeweb Cloud Apps — выберите один.

### Вариант A. Apps → Backend → Node.js / Next.js

1. Панель Timeweb Cloud → «Apps» → «Создать» → тип Backend, фреймворк Next.js (если его нет — Node.js).
2. Подключите GitHub-аккаунт и выберите репозиторий `difast/integro`, ветку `main`.
3. Версия Node.js: 22 (или 20).
4. Команда сборки: `npm ci && npm run build`.
5. Команда запуска: `npm start`. Приложение слушает порт из переменной `PORT` (по умолчанию 3000);
   если панель требует указать порт — укажите 3000.
6. Переменные окружения: `SITE_URL` и SMTP-переменные из `.env.example`. Убедитесь, что они доступны
   на этапе сборки (нужно для `SITE_URL`).
7. Включите автоматический деплой при push в выбранную ветку.

### Вариант B. Apps → Dockerfile

1. «Apps» → «Создать» → Docker / Dockerfile, репозиторий `difast/integro`, ветка `main`.
2. Используется `Dockerfile` из корня (Node 22 Alpine, standalone-сборка, порт 3000).
3. `SITE_URL` нужно передать как build-аргумент (если панель позволяет) и как переменную окружения.
   SMTP-переменные — переменные окружения контейнера.
4. Включите автодеплой при push в `main`.

После первого деплоя: привяжите домен и SSL в панели, задайте `SITE_URL`, пересоберите приложение,
проверьте `https://домен/robots.txt` и `https://домен/sitemap.xml` и отправьте тестовую заявку.

Названия пунктов панели Timeweb могут отличаться — сверяйтесь с актуальной документацией
(timeweb.cloud/docs/apps).

GitHub Actions (`.github/workflows/ci.yml`) только проверяет сборку при push и pull request; деплой
выполняет Timeweb.
