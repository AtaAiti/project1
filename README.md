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
2. Заполните URL, publishable key и service role key.
3. Выполните `supabase/schema.sql` в SQL Editor Supabase.
4. Создайте администратора в Supabase Auth с email/password.

После этого `/admin/*` будет защищён middleware, а `/admin/menu` и `/admin/events` будут сохранять изменения в базе. Без переменных Supabase приложение запускается с demo-данными, а бронирование проходит проверку без записи в БД.

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
