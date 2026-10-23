// Чтение и запись PNG без сторонних библиотек (только zlib из Node): сборка складывает картинки
// в атласы (scripts/atlas.ts), а автопроверка (scripts/e2e.ts) сравнивает снимки по пикселям.
// Читаем то, что пишут art/*.py (PIL) и браузер: 8 бит на канал, без чересстрочности;
// пишем всегда RGBA.

import { deflateSync, inflateSync } from 'node:zlib';

/** Картинка в памяти: по 4 байта (R, G, B, A) на точку, строки подряд. */
export interface Rgba {
  width: number;
  height: number;
  data: Uint8Array;
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Сколько байт в точке у каждого типа цвета PNG (при 8 битах на канал). */
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

const paeth = (a: number, b: number, c: number): number => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** Разобрать PNG в RGBA. Непривычный формат (16 бит, чересстрочный) — ошибка с именем файла. */
export function decodePng(file: Uint8Array, name = 'png'): Rgba {
  const buf = Buffer.from(file.buffer, file.byteOffset, file.byteLength);
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error(`${name}: не PNG`);
  let width = 0;
  let height = 0;
  let type = 0;
  let palette: Buffer | null = null;
  let alpha: Buffer | null = null;
  const parts: Buffer[] = [];
  for (let at = 8; at < buf.length; ) {
    const len = buf.readUInt32BE(at);
    const kind = buf.toString('latin1', at + 4, at + 8);
    const body = buf.subarray(at + 8, at + 8 + len);
    at += 12 + len;
    if (kind === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      type = body[9];
      if (body[8] !== 8 || body[12] !== 0 || !(type in CHANNELS)) {
        throw new Error(`${name}: PNG ${body[8]} бит, тип ${type}, чересстрочный ${body[12]} — не поддерживается`);
      }
    } else if (kind === 'PLTE') palette = body;
    else if (kind === 'tRNS') alpha = body;
    else if (kind === 'IDAT') parts.push(body);
    else if (kind === 'IEND') break;
  }
  const bpp = CHANNELS[type];
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(parts));
  // Снимаем фильтры строк (PNG 1.2, раздел 6).
  const px = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const row = y * stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? px[row + i - bpp] : 0;
      const b = y > 0 ? px[row - stride + i] : 0;
      const c = i >= bpp && y > 0 ? px[row - stride + i - bpp] : 0;
      const v = raw[src + i];
      px[row + i] = filter === 0 ? v : filter === 1 ? v + a : filter === 2 ? v + b : filter === 3 ? v + ((a + b) >> 1) : v + paeth(a, b, c);
    }
  }
  if (type === 6) return { width, height, data: px };
  const data = new Uint8Array(width * height * 4);
  for (let i = 0, n = width * height; i < n; i++) {
    const o = i * 4;
    if (type === 2) {
      data.set(px.subarray(i * 3, i * 3 + 3), o);
      data[o + 3] = 255;
    } else if (type === 3) {
      const k = px[i];
      if (palette) data.set(palette.subarray(k * 3, k * 3 + 3), o);
      data[o + 3] = alpha && k < alpha.length ? alpha[k] : 255;
    } else {
      const g = px[i * bpp];
      data[o] = data[o + 1] = data[o + 2] = g;
      data[o + 3] = type === 4 ? px[i * 2 + 1] : 255;
    }
  }
  return { width, height, data };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (bytes: Buffer): number => {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (kind: string, body: Buffer): Buffer => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(kind, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
};

/**
 * Записать RGBA в PNG. Фильтр строки выбираем как libpng: с наименьшей суммой модулей байтов —
 * так файл почти не больше, чем у PIL с optimize.
 */
export function encodePng({ width, height, data }: Rgba): Buffer {
  const stride = width * 4;
  const out = Buffer.alloc((stride + 1) * height);
  const line = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const row = y * stride;
    let best = 0;
    let bestSum = Infinity;
    for (let f = 0; f <= 4; f++) {
      let sum = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= 4 ? data[row + i - 4] : 0;
        const b = y > 0 ? data[row - stride + i] : 0;
        const c = i >= 4 && y > 0 ? data[row - stride + i - 4] : 0;
        const v = data[row + i];
        const d = (f === 0 ? v : f === 1 ? v - a : f === 2 ? v - b : f === 3 ? v - ((a + b) >> 1) : v - paeth(a, b, c)) & 0xff;
        line[i] = d;
        sum += d < 128 ? d : 256 - d;
      }
      if (sum < bestSum) {
        bestSum = sum;
        best = f;
        line.copy(out, y * (stride + 1) + 1);
      }
    }
    out[y * (stride + 1)] = best;
  }
  const head = Buffer.alloc(13);
  head.writeUInt32BE(width, 0);
  head.writeUInt32BE(height, 4);
  head[8] = 8;
  head[9] = 6;
  return Buffer.concat([SIGNATURE, chunk('IHDR', head), chunk('IDAT', deflateSync(out, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
