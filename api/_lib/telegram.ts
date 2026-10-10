// Общее для серверных функций (Vercel — папка api/, Cloudflare Workers — worker/index.ts): проверка подписи Telegram, вызовы Bot API
// и каталог того, что продаётся за звёзды. Клиенту не доверяем: цену и вещь знает только сервер,
// а покупки потом проверяются по списку звёздных платежей самого бота (getStarTransactions) —
// своя база данных не нужна.
//
// Нужны переменные окружения (Vercel: Settings → Environment Variables; Cloudflare: Settings → Variables and Secrets):
//   BOT_TOKEN       — токен бота от @BotFather;
//   WEBHOOK_SECRET  — любая длинная случайная строка (защищает вебхук и страницу настройки).

export interface TgUser {
  id: number;
  first_name?: string;
  language_code?: string;
}

/** Секреты сервера: на Vercel — из process.env, на Cloudflare — из env воркера. */
export interface Env {
  BOT_TOKEN?: string;
  WEBHOOK_SECRET?: string;
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

/** Что продаётся за звёзды: цена и название для счёта. Должно совпадать с src/game/decor.ts (проверяет тест). */
export const STARS_CATALOG: Record<string, { stars: number; ru: string; en: string }> = {
  sign_wood: { stars: 50, ru: 'Вывеска «Деревенская»', en: 'Rustic wooden sign' },
  sign_neon: { stars: 75, ru: 'Вывеска «Неон»', en: 'Neon sign' },
  sign_candy: { stars: 75, ru: 'Вывеска «Кондитерская»', en: 'Candy shop sign' },
  sign_marquee: { stars: 100, ru: 'Вывеска «Бродвей»', en: 'Broadway marquee sign' },
  sign_gold: { stars: 100, ru: 'Вывеска «Золото»', en: 'Gold sign' },
  wall_brick: { stars: 50, ru: 'Стены «Кирпичный лофт»', en: 'Brick loft walls' },
  wall_metro: { stars: 50, ru: 'Стены «Метро-плитка»', en: 'Subway tile walls' },
  wall_provence: { stars: 50, ru: 'Стены «Прованс»', en: 'Provence walls' },
  wall_walnut: { stars: 75, ru: 'Стены «Тёмный орех»', en: 'Walnut panel walls' },
  wall_damask: { stars: 75, ru: 'Стены «Дамаск»', en: 'Damask wallpaper' },
  floor_gold: { stars: 50, ru: 'Пол «Золотой мрамор»', en: 'Golden marble floor' },
  floor_chevron: { stars: 50, ru: 'Пол «Французская ёлка»', en: 'Chevron parquet floor' },
  floor_terracotta: { stars: 50, ru: 'Пол «Терракота»', en: 'Terracotta floor' },
  floor_azulejo: { stars: 75, ru: 'Пол «Азулежу»', en: 'Azulejo tile floor' },
  floor_noir: { stars: 100, ru: 'Пол «Чёрный мрамор»', en: 'Black marble floor' },
  light_sconce: { stars: 50, ru: 'Латунные бра', en: 'Brass sconces' },
  light_pendant: { stars: 50, ru: 'Лофт-лампы', en: 'Loft pendant lamps' },
  light_lantern: { stars: 50, ru: 'Кованые фонари', en: 'Iron lanterns' },
  light_garland: { stars: 75, ru: 'Гирлянда', en: 'String lights' },
  light_chandelier: { stars: 100, ru: 'Хрустальные люстры', en: 'Crystal chandeliers' },
  gumball: { stars: 50, ru: 'Автомат с жвачкой', en: 'Gumball machine' },
  aquarium: { stars: 75, ru: 'Аквариум с рыбками', en: 'Aquarium' },
  lucky_cat: { stars: 75, ru: 'Кот-удача', en: 'Lucky cat' },
  fountain: { stars: 100, ru: 'Фонтан', en: 'Fountain' },
  jukebox: { stars: 100, ru: 'Музыкальный автомат', en: 'Jukebox' },
  neon_open: { stars: 30, ru: 'Неон «ОТКРЫТО»', en: 'OPEN neon' },
};

/** Полезная нагрузка счёта: по ней видно, какую вещь купили. */
export const payloadFor = (id: string): string => `decor:${id}`;
export const itemFromPayload = (payload: string | undefined): string | null => {
  const id = payload?.startsWith('decor:') ? payload.slice(6) : null;
  return id && STARS_CATALOG[id] ? id : null;
};

interface Partner {
  type: string;
  user?: TgUser;
  invoice_payload?: string;
}

export interface StarTransaction {
  id: string;
  amount: number;
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
    if (id && tx.amount >= STARS_CATALOG[id].stars) items.add(id);
  }
  return [...items];
}
