// Общее для серверных функций (Vercel — папка api/, Cloudflare Workers — worker/index.ts): проверка подписи Telegram, вызовы Bot API
// и каталог того, что продаётся за звёзды. Клиенту не доверяем: цену и вещь знает только сервер,
// а покупки потом проверяются по списку звёздных платежей самого бота (getStarTransactions) —
// своя база данных не нужна.
//
// Нужны переменные окружения (Vercel: Settings → Environment Variables; Cloudflare: Settings → Variables and Secrets):
//   BOT_TOKEN       — токен бота от @BotFather;
//   WEBHOOK_SECRET  — любая длинная случайная строка (защищает вебхук и страницу настройки).

import type { Lang } from './lang.js';

export interface TgUser {
  id: number;
  first_name?: string;
  language_code?: string;
}

/** База Cloudflare D1 — нужна только приглашениям и напоминаниям (social.ts); без неё они выключены. */
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  run(): Promise<{ meta?: { changes?: number } }>;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
}
export interface D1 {
  prepare(sql: string): D1Statement;
  exec(sql: string): Promise<unknown>;
}

/** Секреты сервера: на Vercel — из process.env, на Cloudflare — из env воркера. */
export interface Env {
  BOT_TOKEN?: string;
  WEBHOOK_SECRET?: string;
  /** База для приглашений и напоминаний (Cloudflare D1, привязка DB). */
  DB?: D1;
  /** Адрес игры — для кнопки «Играть» в напоминаниях (у cron нет запроса, чтобы его узнать). */
  APP_URL?: string;
}

/** Переменные окружения Node (Vercel). */
export const processEnv = (): Env =>
  (globalThis as unknown as { process?: { env: Env } }).process?.env ?? {};

const encoder = new TextEncoder();

async function hmac(key: BufferSource, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, encoder.encode(data));
}

const hex = (buf: ArrayBuffer): string => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/**
 * Проверка initData мини-приложения (core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):
 * подпись HMAC-SHA256 ключом из токена бота. Возвращает игрока или null, если подпись не сходится
 * или данные старше maxAgeSec.
 */
export async function verifyInitData(initData: string, token: string, maxAgeSec = 7 * 24 * 3600, now = Date.now()): Promise<TgUser | null> {
  if (!initData || !token) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const check = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');
  const secret = await hmac(encoder.encode('WebAppData'), token);
  if (hex(await hmac(secret, check)) !== hash) return null;
  const authDate = Number(params.get('auth_date'));
  if (!authDate || now / 1000 - authDate > maxAgeSec) return null;
  try {
    const user = JSON.parse(params.get('user') ?? '') as TgUser;
    return typeof user.id === 'number' ? user : null;
  } catch {
    return null;
  }
}

/** Вызов Bot API. */
export async function bot<T>(token: string, method: string, body: unknown): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!data.ok) throw new Error(`${method}: ${data.description ?? res.status}`);
  return data.result as T;
}

export const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** Вещь за звёзды: цена и название на каждом языке бота (lang.ts). */
export type CatalogItem = { stars: number } & Record<Lang, string>;

/** Что продаётся за звёзды: цена и название для счёта. Должно совпадать с src/game/decor.ts — вещи и наборы (проверяет тест). */
export const STARS_CATALOG: Record<string, CatalogItem> = {
  outfit_farmer: { stars: 30, ru: 'Наряд «Фермер»', en: 'Farmer outfit', tr: '“Çiftçi” kıyafeti', es: 'Atuendo “Granjero”' },
  outfit_retro: { stars: 50, ru: 'Наряд «Ретро-лавочник»', en: 'Retro shopkeeper outfit', tr: '“Retro bakkal” kıyafeti', es: 'Atuendo “Tendero retro”' },
  outfit_tuxedo: { stars: 70, ru: 'Наряд «Миллионер»', en: 'Millionaire outfit', tr: '“Milyoner” kıyafeti', es: 'Atuendo “Millonario”' },
  outfit_cyber: { stars: 100, ru: 'Наряд «Кибер-продавец»', en: 'Cyber seller outfit', tr: '“Siber satıcı” kıyafeti', es: 'Atuendo “Cibervendedor”' },
  sign_wood: { stars: 50, ru: 'Вывеска «Деревенская»', en: 'Rustic wooden sign', tr: 'Ahşap köy tabelası', es: 'Letrero rústico de madera' },
  sign_neon: { stars: 75, ru: 'Вывеска «Неон»', en: 'Neon sign', tr: 'Neon tabela', es: 'Letrero de neón' },
  sign_candy: { stars: 75, ru: 'Вывеска «Кондитерская»', en: 'Candy shop sign', tr: 'Şekerci tabelası', es: 'Letrero de dulcería' },
  sign_marquee: { stars: 100, ru: 'Вывеска «Бродвей»', en: 'Broadway marquee sign', tr: '“Broadway” tabelası', es: 'Letrero “Broadway”' },
  sign_gold: { stars: 100, ru: 'Вывеска «Золото»', en: 'Gold sign', tr: 'Altın tabela', es: 'Letrero dorado' },
  wall_brick: { stars: 50, ru: 'Стены «Кирпичный лофт»', en: 'Brick loft walls', tr: 'Tuğla loft duvarlar', es: 'Paredes de ladrillo loft' },
  wall_metro: { stars: 50, ru: 'Стены «Метро-плитка»', en: 'Subway tile walls', tr: 'Metro karosu duvarlar', es: 'Paredes de azulejo metro' },
  wall_provence: { stars: 50, ru: 'Стены «Прованс»', en: 'Provence walls', tr: 'Provence duvarlar', es: 'Paredes Provenza' },
  wall_walnut: { stars: 75, ru: 'Стены «Тёмный орех»', en: 'Walnut panel walls', tr: 'Koyu ceviz duvarlar', es: 'Paredes de nogal oscuro' },
  wall_damask: { stars: 75, ru: 'Стены «Дамаск»', en: 'Damask wallpaper', tr: 'Damask duvar kâğıdı', es: 'Papel tapiz damasco' },
  floor_gold: { stars: 50, ru: 'Пол «Золотой мрамор»', en: 'Golden marble floor', tr: 'Altın mermer zemin', es: 'Piso de mármol dorado' },
  floor_chevron: { stars: 50, ru: 'Пол «Французская ёлка»', en: 'Chevron parquet floor', tr: 'Balıksırtı parke', es: 'Parqué en espiga' },
  floor_terracotta: { stars: 50, ru: 'Пол «Терракота»', en: 'Terracotta floor', tr: 'Terrakota zemin', es: 'Piso de terracota' },
  floor_azulejo: { stars: 75, ru: 'Пол «Азулежу»', en: 'Azulejo tile floor', tr: 'Azulejo karo zemin', es: 'Piso de azulejos' },
  floor_noir: { stars: 100, ru: 'Пол «Чёрный мрамор»', en: 'Black marble floor', tr: 'Siyah mermer zemin', es: 'Piso de mármol negro' },
  light_sconce: { stars: 50, ru: 'Латунные бра', en: 'Brass sconces', tr: 'Pirinç aplikler', es: 'Apliques de latón' },
  light_pendant: { stars: 50, ru: 'Лофт-лампы', en: 'Loft pendant lamps', tr: 'Loft sarkıt lambalar', es: 'Lámparas colgantes loft' },
  light_lantern: { stars: 50, ru: 'Кованые фонари', en: 'Iron lanterns', tr: 'Ferforje fenerler', es: 'Faroles de hierro' },
  light_garland: { stars: 75, ru: 'Гирлянда', en: 'String lights', tr: 'Işık zinciri', es: 'Guirnalda de luces' },
  light_chandelier: { stars: 100, ru: 'Хрустальные люстры', en: 'Crystal chandeliers', tr: 'Kristal avizeler', es: 'Candelabros de cristal' },
  gumball: { stars: 50, ru: 'Автомат с жвачкой', en: 'Gumball machine', tr: 'Sakız makinesi', es: 'Máquina de chicles' },
  aquarium: { stars: 75, ru: 'Аквариум с рыбками', en: 'Aquarium', tr: 'Balıklı akvaryum', es: 'Acuario con peces' },
  lucky_cat: { stars: 75, ru: 'Кот-удача', en: 'Lucky cat', tr: 'Şans kedisi', es: 'Gato de la suerte' },
  fountain: { stars: 100, ru: 'Фонтан', en: 'Fountain', tr: 'Çeşme', es: 'Fuente' },
  jukebox: { stars: 100, ru: 'Музыкальный автомат', en: 'Jukebox', tr: 'Müzik kutusu', es: 'Rocola' },
  neon_open: { stars: 30, ru: 'Неон «ОТКРЫТО»', en: 'OPEN neon', tr: '“AÇIK” neonu', es: 'Neón “ABIERTO”' },
  // Наборы (src/game/decor.ts → STAR_PACKS): одна покупка — несколько вещей.
  pack_newyear: { stars: 100, ru: 'Новогодний набор', en: 'New Year pack', tr: 'Yılbaşı seti', es: 'Paquete de Año Nuevo' },
  // Питомцы за звёзды (src/game/pets.ts): только для красоты, в зале живёт выбранный.
  pet_hamster: { stars: 25, ru: 'Хомяк в клетке', en: 'Hamster in a cage', tr: 'Kafesteki hamster', es: 'Hámster en su jaula' },
  pet_turtle: { stars: 35, ru: 'Черепаха', en: 'Tortoise', tr: 'Kaplumbağa', es: 'Tortuga' },
  pet_parrot: { stars: 50, ru: 'Попугай на жёрдочке', en: 'Parrot on a perch', tr: 'Tüneğinde papağan', es: 'Loro en su percha' },
  pet_bunny: { stars: 50, ru: 'Крольчиха', en: 'Bunny', tr: 'Tavşan', es: 'Conejita' },
  pet_corgi: { stars: 75, ru: 'Корги у входа', en: 'Corgi by the door', tr: 'Kapıdaki corgi', es: 'Corgi en la entrada' },
  pet_raccoon: { stars: 100, ru: 'Енот со склада', en: 'Stockroom raccoon', tr: 'Depo rakunu', es: 'Mapache del almacén' },
  // «Поддержать автора» (src/game/support.ts): только спасибо и красота, без преимуществ в игре.
  support_25: { stars: 25, ru: 'Кофе автору', en: 'A coffee for the author', tr: 'Yapımcıya bir kahve', es: 'Un café para el autor' },
  support_100: { stars: 100, ru: 'Кот в цилиндре', en: 'Cat in a top hat', tr: 'Silindir şapkalı kedi', es: 'Gato con sombrero de copa' },
  support_250: { stars: 250, ru: 'Золотой меценат', en: 'Golden patron', tr: 'Altın hami', es: 'Mecenas de oro' },
};

/** Покупка — поддержка автора (support_*), а не вещь для магазина. */
export const isSupport = (id: string): boolean => id.startsWith('support_') && Boolean(STARS_CATALOG[id]);
/** Ступень, с которой в рейтинге золотая табличка (src/game/support.ts, gold). */
export const GOLD_SUPPORT = 250;
/** Самая щедрая поддержка среди покупок игрока (звёзды) или 0. */
export const supportStars = (items: string[]): number => Math.max(0, ...items.filter(isSupport).map((id) => STARS_CATALOG[id].stars));

/** Сезонный пропуск (src/game/pass.ts): у каждого сезона свой номер, цена одна (совпадает с pass.ts — проверяет тест). */
export const PASS_STARS = 100;
const PASS_RE = /^pass_([1-9]\d{0,3})$/;

/** Сезоны пропуска (как в src/game/pass.ts — проверяется тестом): с 19 октября 2026 по 28 дней. */
export const PASS_EPOCH = Date.UTC(2026, 9, 19);
export const PASS_SEASON_DAYS = 28;
export const passSeason = (now: number): number => Math.max(1, Math.floor((now - PASS_EPOCH) / (PASS_SEASON_DAYS * 24 * 3600_000)) + 1);

/**
 * Что можно купить сейчас: вещь из каталога или пропуск текущего сезона (и прошлого — если сезон
 * сменился, пока открыт экран). Старые пропуска остаются в catalogItem — для восстановления покупок.
 */
export function canBuy(id: string, now = Date.now()): boolean {
  if (STARS_CATALOG[id]) return true;
  const season = passSeason(now);
  return id === `pass_${season}` || (season > 1 && id === `pass_${season - 1}`);
}

/** Вещь из каталога или пропуск сезона. */
export function catalogItem(id: string): CatalogItem | undefined {
  if (STARS_CATALOG[id]) return STARS_CATALOG[id];
  const season = PASS_RE.exec(id)?.[1];
  return season ? { stars: PASS_STARS, ru: `Сезонный пропуск №${season}`, en: `Season pass #${season}`, tr: `Sezon kartı #${season}`, es: `Pase de temporada n.º ${season}` } : undefined;
}

/** Полезная нагрузка счёта: по ней видно, какую вещь купили. */
export const payloadFor = (id: string): string => `decor:${id}`;
export const itemFromPayload = (payload: string | undefined): string | null => {
  const id = payload?.startsWith('decor:') ? payload.slice(6) : null;
  return id && catalogItem(id) ? id : null;
};

interface Partner {
  type: string;
  user?: TgUser;
  invoice_payload?: string;
}

export interface StarTransaction {
  id: string;
  amount: number;
  /** Когда (unix-время, секунды). */
  date?: number;
  source?: Partner;
  receiver?: Partner;
}

/**
 * Что игрок купил: платежи от него минус возвраты (у возврата тот же id, что у платежа).
 * Платёж засчитывается, только если сумма не меньше цены вещи.
 */
export function ownedFrom(transactions: StarTransaction[], userId: number): string[] {
  const refunded = new Set(transactions.filter((tx) => tx.receiver?.type === 'user').map((tx) => tx.id));
  const items = new Set<string>();
  for (const tx of transactions) {
    if (tx.source?.type !== 'user' || tx.source.user?.id !== userId || refunded.has(tx.id)) continue;
    const id = itemFromPayload(tx.source.invoice_payload);
    if (id && tx.amount >= catalogItem(id)!.stars) items.add(id);
  }
  return [...items];
}
