import { newGame, normalizeShelves, type StoreState } from './economy';
import { normalizeDecor } from './decor';
import { readCloud, writeCloud } from '../platform/cloud';
import { telegramUserId } from '../platform/telegram';

// Сохранение: сразу в память телефона и, чуть погодя, в облако Telegram (platform/cloud.ts) —
// так прогресс и покупки за звёзды не пропадут, если очистить телефон или сменить его.
const KEY = 'magazinchik.save';
const VERSION = 11;
/** Старые сохранения с этой версии и новее подходят: недостающие поля берутся из новой игры. */
const MIN_COMPATIBLE = 9;
/** В облако пишем не чаще, чем раз в столько миллисекунд. */
const CLOUD_DELAY_MS = 3000;

interface SaveFile {
  version: number;
  state: StoreState;
  /** Когда сохранено (мс) — при запуске берём более свежее из телефона и облака. */
  savedAt?: number;
  /** Чей это магазин (id в Telegram): на общем телефоне не подхватим чужой. */
  user?: number;
}

function parse(raw: string | null): SaveFile | null {
  if (!raw) return null;
  try {
    const save = JSON.parse(raw) as SaveFile;
    if (save.version < MIN_COMPATIBLE || save.version > VERSION) return null;
    return save;
  } catch {
    return null;
  }
}

function readLocal(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function writeLocal(text: string): void {
  try {
    localStorage.setItem(KEY, text);
  } catch {
    // Хранилище недоступно (приватный режим) — остаётся облако.
  }
}

/** Когда игра сохранялась в последний раз (мс) — отсюда считаем, сколько игрока не было. */
export function lastSavedAt(): number | null {
  return parse(readLocal())?.savedAt ?? null;
}

export function loadGame(): StoreState | null {
  const save = parse(readLocal());
  if (!save) return null;
  // Новые товары появляются в старых сохранениях со своей ценой по умолчанию.
  const fresh = newGame();
  const state = { ...fresh, ...save.state, prices: { ...fresh.prices, ...save.state.prices }, decor: normalizeDecor(save.state.decor) };
  // До версии 11 мороженое и цветы стояли на обычных полках (теперь — ларь у входа и вёдра у кассы).
  return normalizeShelves(state, save.version < 11);
}

let pending: string | null = null;
let pendingAt = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

/** Отправить отложенное сохранение в облако сейчас. */
export async function flushCloud(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  const text = pending;
  pending = null;
  if (text) await writeCloud(text, pendingAt);
}

/** Пока игрок в гостях у друга, на экране чужой магазин — его не сохраняем. */
let paused = false;
export const pauseSaving = (on: boolean): void => {
  paused = on;
};
/** Сейчас на экране чужой магазин (в гостях у друга). */
export const savingPaused = (): boolean => paused;

export function saveGame(state: StoreState): void {
  if (paused) return;
  const savedAt = Date.now();
  const text = JSON.stringify({ version: VERSION, state, savedAt, user: telegramUserId() } satisfies SaveFile);
  writeLocal(text);
  pending = text;
  pendingAt = savedAt;
  if (!timer) timer = setTimeout(() => void flushCloud(), CLOUD_DELAY_MS);
}

/**
 * При запуске: сравнить сохранение в телефоне и в облаке, взять более свежее.
 * В телефоне свежее (или облако пустое) — отправить его в облако.
 */
export async function syncSave(): Promise<void> {
  const user = telegramUserId();
  const cloud = await readCloud();
  const localText = readLocal();
  let local = parse(localText);
  // Сохранение другого игрока Telegram на этом телефоне не трогаем.
  if (local?.user && user && local.user !== user) local = null;
  const remote = cloud ? parse(cloud.text) : null;
  if (remote && (!local || (remote.savedAt ?? cloud!.savedAt) > (local.savedAt ?? 0))) {
    writeLocal(cloud!.text);
  } else if (local && localText && (!remote || (local.savedAt ?? 0) > (remote.savedAt ?? cloud!.savedAt))) {
    await writeCloud(localText, local.savedAt ?? Date.now());
  } else if (!local && localText && user) {
    // В телефоне чужой магазин, в облаке пусто — начинаем свою игру.
    try {
      localStorage.removeItem(KEY);
    } catch {
      // ничего
    }
  }
}

let syncing: Promise<void> | null = null;

/**
 * Сверка с облаком — одна на запуск. main.ts начинает её сразу, параллельно с загрузкой картинок,
 * а заставка (BootScene) потом только ждёт уже идущую сверку. Ошибка облака игру не держит.
 */
export function startSync(): Promise<void> {
  syncing ??= syncSave().catch(() => undefined);
  return syncing;
}

// Свернули Telegram — сразу отправить несохранённое в облако.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushCloud();
  });
}
