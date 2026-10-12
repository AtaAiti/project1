# ЛитераторЪ

Сайт бара и клуба любителей чтения «ЛитераторЪ».

## Выполнено: недели 1–2

- Next.js App Router + TypeScript + Tailwind CSS
- Локали `ru` и `en` в маршрутах `/{locale}`
- Пять публичных маршрутов: главная, о нас, меню, афиша, контакты
- Словари переводов в `dictionaries/ru.json` и `dictionaries/en.json`
- Тёмная дизайн-система с бумажным, винным и костяным цветами
- Типографическая пара: выразительная засечка для заголовков + гротеск для интерфейса
- Страница стайлгайда: `/{locale}/styleguide`

## Запуск

```bash
npm install
npm run dev
```

Откройте `http://localhost:3000/ru` или `http://localhost:3000/en`.

## Supabase

1. Создайте проект Supabase и скопируйте `.env.example` в `.env.local`.
2. Заполните переменные из таблицы ниже.
3. Для новой базы выполните SQL-файлы из `supabase/migrations/` по порядку. `20261013000100_0001_baseline.sql` — исходная схема, `20261013000200_0002_foundation.sql` — доработка PR 1. Для уже настроенного проекта достаточно применить `0002`; baseline соответствует ранее применённой схеме. `supabase/schema.sql` — справочный снимок, а не механизм обновления базы. Все дальнейшие изменения оформляются отдельными timestamped migration-файлами.
4. Создайте администратора в Supabase Auth с email/password и укажите его UUID в `ADMIN_USER_ID`.

После этого `/admin/*` защищён `src/proxy.ts` и серверным layout группы `(protected)`. Login и reset-password находятся вне защищённой группы. Административный API выполняет операции через service role только после независимой проверки личности пользователя. Если `ADMIN_USER_ID` указан, он является единственной проверкой; `ADMIN_EMAIL` используется как резервная проверка только при пустом `ADMIN_USER_ID`. Если обе переменные отсутствуют, административный доступ закрыт.

Публичный контент без Supabase отображает demo-данные. Отправка бронирования без серверных переменных Supabase закрыта и возвращает общую ошибку, чтобы rate limiting нельзя было случайно обойти.

| Переменная | Назначение |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL проекта Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Публичный ключ Supabase для Auth и чтения контента |
| `SUPABASE_SERVICE_ROLE_KEY` | Серверный ключ для бронирований, rate limiting и административного CRUD |
| `ADMIN_USER_ID` | UUID единственного администратора; основная проверка |
| `ADMIN_EMAIL` | Email администратора без учёта регистра; используется только если UUID не задан |
| `TELEGRAM_BOT_TOKEN` | Токен Telegram-бота для уведомлений о брони |
| `TELEGRAM_CHAT_ID` | ID чата или канала для уведомлений |

Единственный backend rate limiting — Supabase RPC `check_rate_limit`. Она доступна на выполнение только `service_role`; `anon` и `authenticated` не могут вызывать её напрямую. Каждый вызов удаляет до 1000 истёкших записей и атомарно обновляет счётчик. Отдельный `pg_cron` не требуется. Интерфейс `RateLimiter` позволяет заменить backend; Upstash не используется. Лимит бронирований — 5 запросов за 600 секунд, ключ — hash IP из `x-forwarded-for` + маршрут. Vercel перезаписывает этот заголовок; при другом развёртывании его должен перезаписывать доверенный прокси.

Бронирование проходит Zod-валидацию из `src/lib/schemas.ts`, неизвестные поля отклоняются. Кыргызстанские номера `+996700123456`, `996700123456`, `0700123456`, `700123456` сохраняются в виде `+996700123456`; другие страны пока не поддерживаются. Дата и время относятся к `Asia/Bishkek`. Поле honeypot `website` скрыто от клавиатуры и скринридеров: непустое поле даёт `{ ok: true }` без записи, rate limit и Telegram. Статусы бронирований: `pending`, `confirmed`, `declined`, по умолчанию `pending`; старые неизвестные статусы переводятся в `pending` миграцией.

`sendTelegram(text, replyMarkup?)` использует только серверные переменные. Отсутствие конфигурации или ошибка Telegram не отменяет успешно сохранённую заявку; ошибка логируется без токена и персональных данных. Клиент не обещает доставку уведомления или подтверждение за фиксированное время.

Административные GET/POST/PATCH/DELETE проверяют allowlist и входные данные. `books` и `event_rsvps` зарезервированы, их таблицы появятся в следующих PR. Generic POST/PATCH для `event_rsvps` закрыты: вставка в PR 2 должна идти исключительно через capacity RPC. POST требует полную схему ресурса, PATCH — UUID и хотя бы одно поле без create-defaults, DELETE — только UUID. Серверные поля `id`/`created_at` не принимаются в POST; существующие редакторы фильтруют их перед отправкой.

### Media Storage без UI загрузки

Миграция `0002` создаёт public-read bucket `media` (JPEG/PNG/WebP, максимум 5 MiB) и write-политики только для `service_role`. Пользователи браузера, включая вошедших через Auth, не получают прямых write-политик. `/api/admin/media` сначала проверяет единственного администратора, затем вызывает серверный `uploadMedia` helper. POST принимает multipart `file` и `folder` (`gallery` или `books`); проверяет размер, MIME и сигнатуру файла, генерирует UUID-путь, не перезаписывает объекты. Ответ: `{ data: { path, url } }`. Интерфейс загрузки отложен до Book of the Month PR. Существующие широкие Storage-политики других проектов необходимо отдельно проверить перед использованием bucket.

## Проверки

### Вход и установка пароля администратора

Вход доступен по `/admin/login`. Для первой установки пароля введите email и нажмите «Задать или восстановить пароль». Откройте письмо в том же браузере, задайте новый пароль и войдите.

В Supabase → Authentication → URL Configuration задайте Site URL `https://literator-xi.vercel.app` и добавьте Redirect URL `https://literator-xi.vercel.app/admin/reset-password`. Для локальной разработки добавьте `http://localhost:3000/admin/reset-password`. Страница восстановления поддерживает PKCE-код и recovery-токены из письма Supabase Dashboard. Истёкшую ссылку замените новым письмом через страницу входа.

```bash
npm test
npm run lint
npm run build
```

Vitest запускает unit-тесты нормализации, строгих Zod-схем, honeypot, административных маршрутов, словарей и обработки сбоев Telegram. Миграции проверяются в изолированном PostgreSQL через PGlite: backfill статусов, ограничения, повторное применение, rate limit, cleanup и права. Эти тесты не заменяют применение SQL к живому Supabase. В Codex запускайте Node.js с `NODE_USE_ENV_PROXY=1`, чтобы использовать штатный HTTPS-прокси; для вашего локального компьютера и Vercel эта настройка обычно не нужна.

Интеграционные проверки и ограничения описаны в `docs/pr1-review.md`. PR 2 не входит в эту доработку.

## Деплой

Репозиторий можно импортировать в GitHub и Vercel. Для Vercel достаточно выбрать корень проекта и стандартную команду сборки Next.js.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
