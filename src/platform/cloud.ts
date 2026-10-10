// Облачное сохранение в Telegram CloudStorage: у каждого игрока своё хранилище на серверах
// Telegram (до 1024 ключей по 4096 символов, ~4 МБ), наш сервер не нужен. Сохранение (5–15 КБ)
// режем на куски по 4000 символов и пишем попеременно в два слота: сначала куски, потом
// «оглавление» — оборвётся связь посреди записи, останется целым прошлое сохранение.

import { cloudStorage, type CloudStorage } from './telegram';

const META = 'save_meta';
const CHUNK = 4000;
const TIMEOUT_MS = 2500;

interface Meta {
  slot: 'a' | 'b';
  n: number;
  savedAt: number;
}

const keysOf = (slot: string, n: number): string[] => Array.from({ length: n }, (_, i) => `save_${slot}${i}`);

function call<T>(run: (done: (error: string | null, result?: T) => void) => void): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), TIMEOUT_MS);
    try {
      run((error, result) => {
        clearTimeout(timer);
        resolve(error ? undefined : result);
      });
    } catch {
      clearTimeout(timer);
      resolve(undefined);
    }
  });
}

async function readMeta(cloud: CloudStorage): Promise<Meta | null> {
  const raw = await call<string>((done) => cloud.getItem(META, done));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Meta;
  } catch {
    return null;
  }
}

/** Прочитать сохранение из облака: текст и когда сохранено (null — нет или облака нет). */
export async function readCloud(): Promise<{ text: string; savedAt: number } | null> {
  const cloud = cloudStorage();
  if (!cloud) return null;
  const meta = await readMeta(cloud);
  if (!meta || !meta.n) return null;
  const keys = keysOf(meta.slot, meta.n);
  const items = await call<Record<string, string>>((done) => cloud.getItems(keys, done));
  if (!items || keys.some((k) => items[k] === undefined)) return null;
  return { text: keys.map((k) => items[k]).join(''), savedAt: meta.savedAt };
}

let lastSlot: 'a' | 'b' | null = null;

/** Записать сохранение в облако (в свободный слот, потом оглавление). */
export async function writeCloud(text: string, savedAt: number): Promise<boolean> {
  const cloud = cloudStorage();
  if (!cloud) return false;
  if (!lastSlot) lastSlot = (await readMeta(cloud))?.slot ?? 'b';
  const slot = lastSlot === 'a' ? 'b' : 'a';
  const parts = Array.from({ length: Math.ceil(text.length / CHUNK) }, (_, i) => text.slice(i * CHUNK, (i + 1) * CHUNK));
  const keys = keysOf(slot, parts.length);
  const written = await Promise.all(keys.map((k, i) => call<boolean>((done) => cloud.setItem(k, parts[i], done))));
  if (written.some((ok) => !ok)) return false;
  const meta: Meta = { slot, n: parts.length, savedAt };
  const ok = await call<boolean>((done) => cloud.setItem(META, JSON.stringify(meta), done));
  if (ok) lastSlot = slot;
  return Boolean(ok);
}
