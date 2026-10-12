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
3. Выполните `supabase/schema.sql` в SQL Editor Supabase. Скрипт создаёт таблицы и атомарную RPC-функцию rate limiting, удаляющую истёкшие окна при записи.
4. Создайте администратора в Supabase Auth с email/password и укажите его UUID в `ADMIN_USER_ID`.

После этого `/admin/*` будет защищён middleware, а административный API будет выполнять операции через service role только после проверки личности пользователя. Если `ADMIN_USER_ID` указан, он является единственной проверкой; `ADMIN_EMAIL` используется как резервная проверка только при пустом `ADMIN_USER_ID`. Если обе переменные отсутствуют, административный доступ закрыт.

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

`check_rate_limit` доступна на выполнение только роли `service_role`. Роли `anon` и `authenticated` не могут вызывать RPC напрямую. Записи с истёкшим сроком удаляются атомарной функцией при следующей проверке лимита; отдельный `pg_cron` не требуется.

## Проверки

### Вход и установка пароля администратора

Вход доступен по `/admin/login`. Для первой установки пароля введите email и нажмите «Задать или восстановить пароль». Откройте письмо в том же браузере, задайте новый пароль и войдите.

В Supabase → Authentication → URL Configuration задайте Site URL `https://literator-xi.vercel.app` и добавьте Redirect URL `https://literator-xi.vercel.app/admin/reset-password`. Для локальной разработки добавьте `http://localhost:3000/admin/reset-password`. Страница восстановления поддерживает PKCE-код и recovery-токены из письма Supabase Dashboard. Истёкшую ссылку замените новым письмом через страницу входа.

```bash
npm test
npm run lint
npm run build
```

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
