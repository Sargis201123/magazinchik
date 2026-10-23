// Звуковые файлы: скачать (только когда нужны — после первого касания), разобрать в звук и не держать
// лишнего в памяти. Разобранный трек — это несжатые отсчёты: три минуты стерео на 48 кГц заняли бы
// ~70 МБ, поэтому длинные файлы разбираются сразу в 32 кГц (на слабом телефоне — в 22 кГц): в динамике
// телефона разницы не слышно, а памяти вдвое-втрое меньше. Адреса — с отпечатком (assets.ts):
// файл кэшируется у игрока надолго, а заменённый приходит по новому адресу.

import { assetUrl } from './assets';
import { liteMode } from './quality';
import { musicFormat } from './playlist';

type Format = 'ogg' | 'm4a';

let format: Format | null = null;

/** В каком формате качать: Opus, а где его не разбирают (Safari, Telegram на iPhone) — AAC. */
export function audioFormat(): Format {
  if (!format) {
    let canOgg = '';
    try {
      canOgg = document.createElement('audio').canPlayType('audio/ogg; codecs="opus"');
    } catch {
      // без <audio> — берём AAC
    }
    format = musicFormat(navigator.userAgent, canOgg);
  }
  return format;
}

/** Адрес файла: путь без расширения → «audio/music/sting_coin.ogg?v=…». */
export const audioUrl = (path: string, ext: Format = audioFormat()): string => assetUrl(`${path}.${ext}`);

/** Что качали — для отладки (?debug): адрес и когда (performance.now), последние FETCH_LOG. */
export const fetched: { url: string; at: number; bytes: number }[] = [];
const FETCH_LOG = 60;

/** Сжатые файлы заставок: маленькие (20–50 КБ), их держим все, что уже понадобились. */
const bytesCache = new Map<string, Promise<ArrayBuffer>>();

async function download(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`audio ${response.status} ${url}`);
  const bytes = await response.arrayBuffer();
  fetched.push({ url, at: Math.round(performance.now()), bytes: bytes.byteLength });
  if (fetched.length > FETCH_LOG) fetched.shift();
  return bytes;
}

/** Скачать (сжатый файл заставки запоминается: второй раз не качаем). */
function bytesOf(url: string, keep: boolean): Promise<ArrayBuffer> {
  if (!keep) return download(url);
  let p = bytesCache.get(url);
  if (!p) {
    p = download(url);
    bytesCache.set(url, p);
    // Не скачалось — в следующий раз попробуем снова.
    p.catch(() => bytesCache.delete(url));
  }
  return p;
}

/** Разбор: и старый вид с обратными вызовами (Safari до 14.1), и новый с обещанием. */
function decodeWith(ctx: BaseAudioContext, bytes: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    const result = ctx.decodeAudioData(bytes, resolve, reject);
    if (result && typeof result.then === 'function') result.then(resolve, reject);
  });
}

/** Частота, в которую разбирать длинные файлы (0 — как у самого звука, без пересчёта). */
const STORE_RATE = { normal: 32000, lite: 22050 };

/**
 * Разобрать в звук. Длинное (lean) — сразу в пониженной частоте через офлайн-контекст: AudioBuffer
 * занимает вдвое-втрое меньше. Не вышло (старый браузер) — обычным путём, в частоте контекста.
 */
async function decode(ac: AudioContext, bytes: ArrayBuffer, lean: boolean): Promise<AudioBuffer> {
  const rate = liteMode() ? STORE_RATE.lite : STORE_RATE.normal;
  const Offline = window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (lean && Offline && rate < ac.sampleRate) {
    try {
      // Разбор «съедает» массив байтов — отдаём копию, чтобы при ошибке было что разобрать иначе.
      return await decodeWith(new Offline(2, 1, rate), bytes.slice(0));
    } catch {
      // попробуем обычным путём
    }
  }
  return decodeWith(ac, bytes.slice(0));
}

/**
 * Скачать и разобрать файл path (без расширения). lean — длинный трек или петля (разбор в пониженной
 * частоте), keep — запомнить сжатый файл (заставки). Если Ogg не разобрался («врёт» canPlayType) —
 * до конца захода в игру переходим на AAC и пробуем ещё раз.
 */
export async function loadAudio(ac: AudioContext, path: string, { lean = false, keep = false } = {}): Promise<AudioBuffer> {
  const ext = audioFormat();
  const bytes = await bytesOf(audioUrl(path, ext), keep);
  try {
    return await decode(ac, bytes, lean);
  } catch (error) {
    if (ext !== 'ogg') throw error;
    format = 'm4a';
    return decode(ac, await bytesOf(audioUrl(path, 'm4a'), keep), lean);
  }
}

/** Заранее скачать сжатый файл заставки (без разбора) — чтобы прозвучала вовремя. */
export function prefetchAudio(path: string): void {
  void bytesOf(audioUrl(path), true).catch(() => {});
}

/**
 * Разобранные заставки: несколько последних (каждая — 1–2 МБ несжатого звука). Самую давнюю
 * выбрасываем, когда места нет.
 */
export class BufferCache {
  private readonly items = new Map<string, AudioBuffer>();
  constructor(private readonly size: number) {}

  get(key: string): AudioBuffer | undefined {
    const buffer = this.items.get(key);
    if (buffer) {
      // Свежая — в конец очереди.
      this.items.delete(key);
      this.items.set(key, buffer);
    }
    return buffer;
  }

  set(key: string, buffer: AudioBuffer): void {
    this.items.delete(key);
    this.items.set(key, buffer);
    while (this.items.size > this.size) this.items.delete(this.items.keys().next().value!);
  }

  keys(): string[] {
    return [...this.items.keys()];
  }
}
