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
