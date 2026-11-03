// Яндекс Игры (yandex.ru/dev/games/doc/): SDK, язык, облачные сохранения, пауза и реклама.
// Работает только в сборке для Яндекса (IS_YANDEX, platform/target.ts); в сборке для Telegram модуль
// не делает ничего. SDK подключает index.html (<script src="/sdk.js">, его отдаёт площадка); если его нет
// (игра открыта не на Яндексе, локальная проверка) — всё тихо работает без него: язык из браузера,
// сохранения в памяти браузера.
//
// Требования модерации, которые здесь закрыты:
//   1.19.1 — SDK запускается как в документации (YaGames.init);
//   1.19.2 — LoadingAPI.ready(), когда игрок может начать играть (markReady из ui/title.ts);
//   1.19.3 — GameplayAPI.start/stop: идёт смена в магазине — start, пауза, реклама, окна — stop;
//   1.3, 4.7 — на рекламе, на game_api_pause и без фокуса звук молчит, а игра стоит;
//   2.14 — язык из ysdk.environment.i18n.lang (i18n/index.ts, usePlatformLang).

import { IS_YANDEX } from './target';

interface YandexPlayer {
  getData(keys?: string[]): Promise<Record<string, unknown>>;
  setData(data: Record<string, unknown>, flush?: boolean): Promise<void>;
}

interface YandexSdk {
  environment: { i18n: { lang: string } };
  features: {
    LoadingAPI?: { ready(): void };
    GameplayAPI?: { start(): void; stop(): void };
  };
  adv: {
    showFullscreenAdv(opts: { callbacks: { onOpen?: () => void; onClose?: (wasShown: boolean) => void; onError?: (e: unknown) => void } }): void;
    showRewardedVideo(opts: {
      callbacks: { onOpen?: () => void; onRewarded?: () => void; onClose?: () => void; onError?: (e: unknown) => void };
    }): void;
  };
  getPlayer(opts?: { scopes?: boolean }): Promise<YandexPlayer>;
  on(event: 'game_api_pause' | 'game_api_resume', handler: () => void): void;
}

declare global {
  interface Window {
    YaGames?: { init(): Promise<YandexSdk> };
  }
}

/** Сколько ждать SDK и игрока (мс): дольше — играем без них. */
const INIT_TIMEOUT_MS = 6000;

let sdk: YandexSdk | null = null;
let player: YandexPlayer | null = null;

const within = <T>(promise: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([promise.catch(() => null), new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);

// ---------- Пауза ----------

/** Чем остановить игру (main.ts: цикл Phaser спит и просыпается). */
let freeze: ((on: boolean) => void) | null = null;
/** Чем заглушить звук (main.ts: mixer.holdSound). Модуль не тянет звук сам — его читают и сохранения (cloud.ts). */
let silence: ((on: boolean) => void) | null = null;
/** Кто сейчас держит паузу: реклама, площадка (game_api_pause), скрытая вкладка. */
const holds = new Set<string>();
/** Смена в магазине идёт (для GameplayAPI): между паузами её снова отмечаем как start. */
let playing = false;

function apply(): void {
  const stop = holds.size > 0;
  freeze?.(stop);
  silence?.(stop || !document.hasFocus());
  const gameplay = sdk?.features.GameplayAPI;
  if (!gameplay) return;
  if (stop || !playing) gameplay.stop();
  else gameplay.start();
}

function hold(reason: string, on: boolean): void {
  if (on === holds.has(reason)) return;
  if (on) holds.add(reason);
  else holds.delete(reason);
  apply();
}

/** Как остановить игру и звук на время рекламы и паузы площадки (main.ts: сон цикла Phaser и mixer.holdSound). */
export function setFreeze(game: (on: boolean) => void, sound: (on: boolean) => void): void {
  freeze = game;
  silence = sound;
}

/** Игрок в деле (идёт день в магазине) или нет (меню, утро, итоги) — для GameplayAPI. */
export function setPlaying(on: boolean): void {
  if (!IS_YANDEX || on === playing) return;
  playing = on;
  apply();
}

// ---------- Запуск ----------

/**
 * Запустить SDK и получить игрока (для сохранений). Ждёт не дольше INIT_TIMEOUT_MS — без SDK игра
 * всё равно запускается. Зовётся один раз из main.ts до загрузки словаря и сверки сохранений.
 */
export async function initYandex(): Promise<void> {
  if (!IS_YANDEX || !window.YaGames) return;
  sdk = await within(window.YaGames.init(), INIT_TIMEOUT_MS);
  if (!sdk) return;
  sdk.on('game_api_pause', () => hold('platform', true));
  sdk.on('game_api_resume', () => hold('platform', false));
  // Без фокуса (переключились на другое окно, нажали на страницу вокруг игры) — звук молчит (п. 1.3).
  window.addEventListener('blur', apply);
  window.addEventListener('focus', apply);
  document.addEventListener('visibilitychange', () => hold('hidden', document.hidden));
  // Игрок без входа (гость) тоже получает облачное хранилище — до входа оно привязано к браузеру.
  player = await within(sdk.getPlayer({ scopes: false }), INIT_TIMEOUT_MS);
}

/** Язык площадки (код вида «ru», «en», «tr»), или undefined без SDK. */
export const yandexLang = (): string | undefined => sdk?.environment.i18n.lang || undefined;

let ready = false;

/** Игра готова к игре: заставка ушла, кнопка «Играть» на экране (п. 1.19.2). Повторный вызов ничего не делает. */
export function markReady(): void {
  if (!IS_YANDEX || ready) return;
  ready = true;
  sdk?.features.LoadingAPI?.ready();
}

// ---------- Сохранения (player.setData / getData) ----------

const SAVE_KEY = 'save';
const SAVED_AT_KEY = 'savedAt';

/** Облачное сохранение игрока на Яндексе: текст и время, или null (нет SDK или пусто). */
export async function readYandexSave(): Promise<{ text: string; savedAt: number } | null> {
  if (!player) return null;
  const data = await within(player.getData([SAVE_KEY, SAVED_AT_KEY]), INIT_TIMEOUT_MS);
  const text = data?.[SAVE_KEY];
  if (typeof text !== 'string' || !text) return null;
  return { text, savedAt: Number(data?.[SAVED_AT_KEY]) || 0 };
}

/** Записать сохранение в облако Яндекса (до 200 КБ на игрока; у нас 5–15 КБ). */
export async function writeYandexSave(text: string, savedAt: number): Promise<boolean> {
  if (!player) return false;
  try {
    await player.setData({ [SAVE_KEY]: text, [SAVED_AT_KEY]: savedAt }, true);
    return true;
  } catch {
    return false;
  }
}

// ---------- Реклама ----------

/**
 * Полноэкранная реклама в естественной паузе (места выбирает автор, docs/YANDEX.md). Частоту решает
 * площадка: если показывать рано, она просто не покажет. Игра и звук стоят, пока реклама на экране.
 */
export function showFullscreenAd(): Promise<void> {
  const adv = sdk?.adv;
  if (!adv) return Promise.resolve();
  return new Promise((resolve) => {
    const done = (): void => {
      hold('ad', false);
      resolve();
    };
    hold('ad', true);
    try {
      adv.showFullscreenAdv({ callbacks: { onClose: done, onError: done } });
    } catch {
      done();
    }
  });
}

/** Реклама за награду: true — досмотрели, награду выдать. Без SDK — false (кнопку лучше не показывать). */
export function showRewardedAd(): Promise<boolean> {
  const adv = sdk?.adv;
  if (!adv) return Promise.resolve(false);
  return new Promise((resolve) => {
    let rewarded = false;
    const done = (): void => {
      hold('ad', false);
      resolve(rewarded);
    };
    hold('ad', true);
    try {
      adv.showRewardedVideo({
        callbacks: {
          onRewarded: () => {
            rewarded = true;
          },
          onClose: done,
          onError: done,
        },
      });
    } catch {
      done();
    }
  });
}

/** Реклама за награду возможна (игра на Яндексе и SDK запущен). */
export const rewardedAvailable = (): boolean => Boolean(sdk);
