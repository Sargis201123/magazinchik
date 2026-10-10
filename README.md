# Магазинчик

Пиксельный симулятор магазина для Telegram Mini App. Дизайн и план описаны в [docs/GDD.md](docs/GDD.md).

## Запуск

```bash
npm install
npm run dev      # http://localhost:5173 (?lang=en — английский)
npm test         # тесты игровой логики
npm run build    # сборка в dist/
npm run sim      # симулятор экономики (баланс)
python3 art/sprites.py  # перерисовать спрайты в public/assets
```

## Структура

- `src/game` — игровая логика без Phaser (экономика, сохранения), покрыта тестами.
- `src/scenes` — сцены Phaser: `BootScene` (загрузка спрайтов), `StoreScene` (магазин), `layout.ts` (планировки помещений).
- `art/sprites.py` — вся пиксельная графика: пиксельные карты и палитра, результат в `public/assets`. Там же иконка `public/favicon.png` и `public/icon-512.png` (аватарка бота: BotFather → /setuserpic).
- `src/platform/sound.ts` — звуки, синтезируются WebAudio (без файлов).
- `src/ui` — интерфейс поверх canvas (HUD, окна).
- `src/i18n` — переводы ru/en.
- `src/platform/telegram.ts` — обёртка над Telegram WebApp API. Вне Telegram ничего не делает.

## Подключение к Telegram

1. Создать бота в @BotFather.
2. Задеплоить `dist/` (например, на Vercel).
3. В BotFather: `/newapp` или Bot Settings → Menu Button, указать URL игры.

## Покупки за звёзды (Telegram Stars)

Премиальное оформление продаётся за звёзды. Сервер — несколько маленьких функций без своей базы:
что купил игрок, он узнаёт из платежей бота (`getStarTransactions`). Логика — в `api/_lib/`,
обёртки для двух хостингов: `api/*.ts` (Vercel) и `worker/index.ts` (Cloudflare Workers).

Секреты (только в настройках хостинга, никогда в коде или чате):
- `BOT_TOKEN` — токен бота из @BotFather;
- `WEBHOOK_SECRET` — длинная случайная строка из латинских букв, цифр, `_` и `-`.

### Cloudflare Workers (бесплатно)

Настройки — в `wrangler.jsonc`: игра раздаётся из `dist`, запросы `/api/*` обрабатывает `worker/index.ts`.

1. dash.cloudflare.com → Workers & Pages → Create → Import a repository → этот репозиторий.
2. Build command: `npm run build`, Deploy command: `npx wrangler deploy` (так и предлагается по умолчанию).
3. Settings → Variables and Secrets → добавить `BOT_TOKEN` и `WEBHOOK_SECRET` с типом Secret.
4. Один раз открыть `https://<проект>.<аккаунт>.workers.dev/api/stars-setup?key=<WEBHOOK_SECRET>` — вебхук бота переедет на Cloudflare.
5. В @BotFather поменять адрес мини-приложения (и кнопки меню) на адрес `workers.dev`.

### Vercel

1. Деплой из этого репозитория (папка `api/` подхватится сама).
2. Settings → Environment Variables → `BOT_TOKEN`, `WEBHOOK_SECRET`, затем Redeploy.
3. Один раз открыть `https://<адрес игры>/api/stars-setup?key=<WEBHOOK_SECRET>`.

Без секретов игра работает как раньше, а кнопка покупки честно пишет, что оплата недоступна.
Каждую премиальную вещь можно один раз бесплатно примерить на день.
