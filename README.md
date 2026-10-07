# Магазинчик

Пиксельный симулятор магазина для Telegram Mini App. Дизайн и план описаны в [docs/GDD.md](docs/GDD.md).

## Запуск

```bash
npm install
npm run dev      # http://localhost:5173 (?lang=en — английский)
npm test         # тесты игровой логики
npm run build    # сборка в dist/
```

## Структура

- `src/game` — игровая логика без Phaser (экономика, сохранения), покрыта тестами.
- `src/scenes` — сцены Phaser: `BootScene` (временная графика), `StoreScene` (магазин).
- `src/ui` — интерфейс поверх canvas (HUD, окна).
- `src/i18n` — переводы ru/en.
- `src/platform/telegram.ts` — обёртка над Telegram WebApp API. Вне Telegram ничего не делает.

## Подключение к Telegram

1. Создать бота в @BotFather.
2. Задеплоить `dist/` (например, на Vercel).
3. В BotFather: `/newapp` или Bot Settings → Menu Button, указать URL игры.
