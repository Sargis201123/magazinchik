// Для какой площадки собрана игра: обычная сборка — Telegram (npm run build), `npm run build:yandex` —
// Яндекс Игры (vite.config.ts, режим yandex). Значение подставляется при сборке, поэтому в сборке для
// Telegram ветки Яндекса вырезаются целиком, и наоборот.

declare const __PLATFORM__: 'telegram' | 'yandex' | undefined;

export const PLATFORM: 'telegram' | 'yandex' = typeof __PLATFORM__ !== 'undefined' && __PLATFORM__ === 'yandex' ? 'yandex' : 'telegram';
export const IS_YANDEX = PLATFORM === 'yandex';
