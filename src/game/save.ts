import { newGame, type StoreState } from './economy';
import { readCloud, writeCloud } from '../platform/cloud';
import { telegramUserId } from '../platform/telegram';

// Сохранение: сразу в память телефона и, чуть погодя, в облако Telegram (platform/cloud.ts) —
// так прогресс и покупки за звёзды не пропадут, если очистить телефон или сменить его.
const KEY = 'magazinchik.save';
const VERSION = 10;
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

export function loadGame(): StoreState | null {
  const save = parse(readLocal());
  if (!save) return null;
  // Новые товары появляются в старых сохранениях со своей ценой по умолчанию.
  const fresh = newGame();
  return { ...fresh, ...save.state, prices: { ...fresh.prices, ...save.state.prices } };
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

export function saveGame(state: StoreState): void {
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

// Свернули Telegram — сразу отправить несохранённое в облако.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushCloud();
  });
}
