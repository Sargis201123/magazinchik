import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import { activeDecor, canTry, decorItem, DECOR, isKeepsake, tryDecor } from '../src/game/decor';
import { claimPass, ensureSeason, EXCLUSIVE_LEVELS, grantPass, passExclusive, passItem, seasonExclusives, XP_PER_LEVEL } from '../src/game/pass';
import { grantSupport, supportDecor, supportLevel, SUPPORT_TIERS } from '../src/game/support';
import { restartGame } from '../src/game/restart';
import { friendState, shopSnapshot } from '../src/game/friendShop';
import { loadGame, saveGame } from '../src/game/save';
import { TEXTURES } from '../src/scenes/worldTextures';
import { WARDROBE_TEXTURES } from '../src/scenes/wardrobe';
import { en } from '../src/i18n/en';
import { ru, type TextKey } from '../src/i18n/ru';
import { canBuy, catalogItem, GOLD_SUPPORT, isSupport, ownedFrom, payloadFor, STARS_CATALOG, supportStars, type D1, type D1Statement, type Env } from '../api/_lib/telegram';
import { leaderboard, progress } from '../api/_lib/stats';
import { resetStarsCache, starsOwned, starsRefund, telegramWebhook } from '../api/_lib/handlers';

// Звёздный пропуск с эксклюзивом сезона и «Поддержать автора»: товары, владение, «Начать заново»,
// снимок для гостей; на сервере — золотая табличка в рейтинге по платежам бота и снятие после возврата.

const DAY = 24 * 3600_000;
const START = Date.UTC(2026, 9, 19);

/** Пропуск оплачен и открыт до уровня level. */
const paidPass = (now: number, level: number): StoreState => {
  const s = ensureSeason(newGame(), now);
  return grantPass({ ...s, pass: { ...s.pass!, xp: XP_PER_LEVEL * level } }, [passItem(s.pass!.season)]);
};

describe('эксклюзив звёздного пропуска', () => {
  it('у двух сезонов — своя вывеска и свой наряд, их нельзя купить ни за монеты, ни за звёзды', () => {
    for (const season of [1, 2]) {
      const ids = seasonExclusives(season);
      expect(ids.map((id) => decorItem(id).kind).sort()).toEqual(['outfit', 'sign']);
      for (const id of ids) {
        const item = decorItem(id);
        expect(item.price).toBeUndefined();
        expect(item.stars).toBeUndefined();
        expect(STARS_CATALOG[id]).toBeUndefined();
        expect(canBuy(id)).toBe(false);
        expect(isKeepsake(id)).toBe(true);
      }
    }
    expect(new Set([...seasonExclusives(1), ...seasonExclusives(2)]).size).toBe(4);
  });

  it('забирается на своём уровне звёздной дорожки и сразу надевается; без пропуска — нет', () => {
    let s = paidPass(START, 20);
    const outfit = passExclusive(1, EXCLUSIVE_LEVELS.outfit!)!;
    const sign = passExclusive(1, EXCLUSIVE_LEVELS.sign!)!;
    expect(decorItem(outfit).kind).toBe('outfit');
    expect(decorItem(sign).kind).toBe('sign');
    s = claimPass(s, EXCLUSIVE_LEVELS.outfit!, 'premium')!;
    expect(activeDecor(s, 'outfit')?.id).toBe(outfit);
    s = claimPass(s, EXCLUSIVE_LEVELS.sign!, 'premium')!;
    expect(activeDecor(s, 'sign')?.id).toBe(sign);
    // Бесплатная дорожка эксклюзива не даёт.
    const free = claimPass(paidPass(START, 20), EXCLUSIVE_LEVELS.outfit!, 'free')!;
    expect(free.decor.owned).not.toContain(outfit);
    const unpaid = ensureSeason(newGame(), START);
    expect(claimPass({ ...unpaid, pass: { ...unpaid.pass!, xp: XP_PER_LEVEL * 20 } }, EXCLUSIVE_LEVELS.outfit!, 'premium')).toBeNull();
  });

  it('уровень забран до обновления — эксклюзив выдаётся при загрузке, один раз', () => {
    const s = paidPass(START, 20);
    const old = { ...s, pass: { ...s.pass!, premium: [1, EXCLUSIVE_LEVELS.outfit!] } };
    const fixed = ensureSeason(old, START + DAY);
    expect(activeDecor(fixed, 'outfit')?.id).toBe(passExclusive(1, EXCLUSIVE_LEVELS.outfit!));
    expect(fixed.decor.owned).not.toContain(passExclusive(1, EXCLUSIVE_LEVELS.sign!));
    expect(ensureSeason(fixed, START + DAY)).toBe(fixed);
    // Без оплаченного пропуска ничего не выдаётся.
    const unpaid = { ...old, pass: { ...old.pass!, paid: false } };
    expect(ensureSeason(unpaid, START + DAY)).toBe(unpaid);
  });

  it('второй сезон даёт свои вещи (по seasonOf)', () => {
    const s = claimPass(paidPass(START + 28 * DAY, 20), EXCLUSIVE_LEVELS.sign!, 'premium')!;
    expect(s.pass!.season).toBe(2);
    expect(activeDecor(s, 'sign')?.id).toBe(passExclusive(2, EXCLUSIVE_LEVELS.sign!));
    expect(passExclusive(2, EXCLUSIVE_LEVELS.sign!)).not.toBe(passExclusive(1, EXCLUSIVE_LEVELS.sign!));
  });

  it('эксклюзив своего сезона можно один раз примерить', () => {
    const s = { ...newGame(), day: 3 };
    const id = seasonExclusives(1)[0];
    expect(canTry(s, id)).toBe(true);
    const tried = tryDecor(s, id)!;
    expect(activeDecor(tried, decorItem(id).kind)?.id).toBe(id);
    expect(canTry(tried, id)).toBe(false);
  });

  it('остаётся после «Начать заново» и виден другу в гостях', () => {
    let s = paidPass(START, 20);
    s = claimPass(s, EXCLUSIVE_LEVELS.outfit!, 'premium')!;
    s = claimPass(s, EXCLUSIVE_LEVELS.sign!, 'premium')!;
    const again = restartGame(s);
    for (const id of seasonExclusives(1)) expect(again.decor.owned).toContain(id);
    expect(activeDecor(again, 'sign')?.id).toBe(passExclusive(1, EXCLUSIVE_LEVELS.sign!));
    const seen = friendState(JSON.parse(JSON.stringify(shopSnapshot(s))), newGame())!;
    expect(activeDecor(seen, 'outfit')?.id).toBe(passExclusive(1, EXCLUSIVE_LEVELS.outfit!));
    expect(activeDecor(seen, 'sign')?.id).toBe(passExclusive(1, EXCLUSIVE_LEVELS.sign!));
  });
});

describe('«Поддержать автора»', () => {
  it('три ступени, цены и названия как на сервере, без преимуществ в игре', () => {
    expect(SUPPORT_TIERS.map((s) => s.stars)).toEqual([25, 100, 250]);
    for (const tier of SUPPORT_TIERS) {
      expect(catalogItem(tier.id)?.stars).toBe(tier.stars);
      expect(isSupport(tier.id)).toBe(true);
      expect(canBuy(tier.id)).toBe(true);
      for (const id of tier.items) expect(decorItem(id).support).toBe(true);
    }
    expect(SUPPORT_TIERS.find((s) => s.gold)!.stars).toBe(GOLD_SUPPORT);
    // Только вещи оформления и ступень: деньги, рейтинг, полки — как были.
    const s = newGame();
    const after = grantSupport(s, ['support_250']);
    expect({ ...after, decor: s.decor, supporter: undefined }).toEqual({ ...s, supporter: undefined });
  });

  it('подарки по покупкам: табличка, кот, самая щедрая ступень; повтор ничего не меняет', () => {
    expect(supportDecor(['support_25'])).toEqual(['thanks_plaque']);
    expect(supportDecor(['support_100', 'support_25']).sort()).toEqual(['cat_hat', 'thanks_plaque']);
    expect(supportLevel(['support_25', 'support_250', 'ghost'])).toBe(250);
    expect(supportStars(['support_25', 'support_100', 'pass_1'])).toBe(100);
    let s = grantSupport(newGame(), ['support_100']);
    expect(s.supporter).toBe(100);
    expect(activeDecor(s, 'plaque')?.id).toBe('thanks_plaque');
    expect(activeDecor(s, 'mascot')?.id).toBe('cat_hat');
    expect(grantSupport(s, ['support_25'])).toBe(s);
    expect(grantSupport(s, [])).toBe(s);
    s = grantSupport(s, ['support_250']);
    expect(s.supporter).toBe(250);
  });

  it('после «Начать заново» и в старом сохранении — на месте', () => {
    const s = grantSupport(newGame(), ['support_100']);
    const again = restartGame(s);
    expect(again.supporter).toBe(100);
    expect(activeDecor(again, 'mascot')?.id).toBe('cat_hat');
    // Сохранение без поля supporter (как у всех до этой версии) грузится.
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) });
    saveGame(newGame());
    expect(loadGame()?.supporter).toBeUndefined();
    saveGame(again);
    expect(loadGame()?.supporter).toBe(100);
    vi.unstubAllGlobals();
  });

  it('видно другу в гостях', () => {
    const seen = friendState(JSON.parse(JSON.stringify(shopSnapshot(grantSupport(newGame(), ['support_100'])))), newGame())!;
    expect(activeDecor(seen, 'plaque')?.id).toBe('thanks_plaque');
    expect(activeDecor(seen, 'mascot')?.id).toBe('cat_hat');
  });
});

describe('картинки и тексты', () => {
  it('у новых вещей есть картинки в атласе, слои наряда — в гардеробе, тексты — на двух языках', () => {
    for (const d of DECOR.filter((x) => x.season !== undefined || x.support)) {
      if (d.kind !== 'outfit') expect(TEXTURES).toContain(d.texture);
      expect(ru[d.nameKey]).toBeTruthy();
      expect(en[d.nameKey]).toBeTruthy();
    }
    for (const w of ['w_hat_leafcap', 'w_hat_pompom', 'w_outfit_trench', 'w_outfit_nordic']) expect(WARDROBE_TEXTURES).toContain(w);
    for (const tier of SUPPORT_TIERS) {
      for (const key of [tier.nameKey, `support.give.${tier.stars}`] as TextKey[]) {
        expect(ru[key]).toBeTruthy();
        expect(en[key]).toBeTruthy();
      }
    }
  });
});

// ---------------------------------------------------------------- сервер

type Sqlite = { prepare(sql: string): { run(...v: unknown[]): { changes: number }; get(...v: unknown[]): unknown; all(...v: unknown[]): unknown[] } };
let Database: (new (path: string) => Sqlite) | null = null;
try {
  Database = ((await import(/* @vite-ignore */ ['node', 'sqlite'].join(':'))) as { DatabaseSync: new (path: string) => Sqlite }).DatabaseSync;
} catch {
  Database = null;
}
function d1(): D1 {
  const db = new Database!(':memory:');
  const statement = (sql: string, values: unknown[] = []): D1Statement => ({
    bind: (...next) => statement(sql, next),
    run: async () => ({ meta: { changes: db.prepare(sql).run(...values).changes } }),
    first: async <T>() => (db.prepare(sql).get(...values) as T) ?? null,
    all: async <T>() => ({ results: db.prepare(sql).all(...values) as T[] }),
  });
  return { prepare: (sql) => statement(sql), exec: async () => undefined };
}

const TOKEN = '123456:TEST-token';
const SECRET = 'hook_secret-1';
const enc = new TextEncoder();
const hmac = async (key: BufferSource, data: string) =>
  crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), enc.encode(data));
async function initData(id: number): Promise<string> {
  const fields = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id, first_name: `Игрок${id}` }) };
  const check = Object.entries(fields).map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = await hmac(enc.encode('WebAppData'), TOKEN);
  const hash = [...new Uint8Array(await hmac(secret, check))].map((b) => b.toString(16).padStart(2, '0')).join('');
  return new URLSearchParams({ ...fields, hash }).toString();
}
const post = async (id: number, extra: Record<string, unknown> = {}) =>
  new Request('https://x/api', { method: 'POST', body: JSON.stringify({ initData: await initData(id), ...extra }) });

/** Платежи бота в Telegram — понарошку. */
let transactions: unknown[] = [];
const sent: { method: string; body: Record<string, unknown> }[] = [];
beforeEach(() => {
  transactions = [];
  sent.length = 0;
  resetStarsCache();
  vi.stubGlobal('fetch', async (url: string, init: { body: string }) => {
    const method = String(url).split('/').pop()!;
    sent.push({ method, body: JSON.parse(init.body) });
    const result = method === 'getStarTransactions' ? { transactions } : method === 'getMe' ? { username: 'bot' } : true;
    return new Response(JSON.stringify({ ok: true, result }));
  });
});
afterEach(() => vi.unstubAllGlobals());

const pay = (id: string, user: number, item: string) => ({ id, amount: STARS_CATALOG[item].stars, source: { type: 'user', user: { id: user }, invoice_payload: payloadFor(item) } });
const board = async (env: Env, id: number) => (await (await leaderboard(await post(id), env)).json()) as { top: { name: string; gold?: boolean }[] };

describe.skipIf(!Database)('золотая табличка в рейтинге (сервер)', () => {
  it('ставится по платежам бота, только с золотой ступени, и снимается после возврата', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, WEBHOOK_SECRET: SECRET, DB: d1() };
    for (const id of [1, 2, 3]) await progress(await post(id, { level: 1, revenue: 100 * id }), env);
    transactions = [pay('a', 1, 'support_250'), pay('b', 2, 'support_100')];
    expect(ownedFrom(transactions as never, 1)).toEqual(['support_250']);
    await starsOwned(await post(1), env);
    await starsOwned(await post(2), env);
    let top = (await board(env, 3)).top;
    expect(top.find((r) => r.name === 'Игрок1')?.gold).toBe(true);
    expect(top.find((r) => r.name === 'Игрок2')?.gold).toBeUndefined();
    expect(top.find((r) => r.name === 'Игрок3')?.gold).toBeUndefined();
    // Возврат: в списке платежей бота появляется обратный перевод с тем же id.
    transactions = [...transactions, { id: 'a', amount: 250, receiver: { type: 'user', user: { id: 1 } } }];
    const res = await starsRefund(new Request(`https://x/api/stars-refund?key=${SECRET}&user=1&charge=a`), env);
    expect(res.status).toBe(200);
    top = (await board(env, 3)).top;
    expect(top.find((r) => r.name === 'Игрок1')?.gold).toBeUndefined();
  });

  it('запуск игры со старым списком платежей не снимает только что оплаченное золото', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, WEBHOOK_SECRET: SECRET, DB: d1() };
    await progress(await post(6, { level: 1, revenue: 100 }), env);
    const update = { message: { chat: { id: 6 }, from: { id: 6, language_code: 'ru' }, successful_payment: { invoice_payload: payloadFor('support_250') } } };
    await telegramWebhook(new Request('https://x/api/telegram', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': SECRET }, body: JSON.stringify(update) }), env);
    transactions = [];
    await starsOwned(await post(6), env);
    expect((await board(env, 6)).top[0].gold).toBe(true);
  });

  it('вебхук оплаты сразу отмечает поддержку и благодарит; секреты не попадают в ответы', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, WEBHOOK_SECRET: SECRET, DB: d1() };
    await progress(await post(5, { level: 1, revenue: 100 }), env);
    const update = { message: { chat: { id: 5 }, from: { id: 5, language_code: 'ru' }, successful_payment: { invoice_payload: payloadFor('support_250') } } };
    const res = await telegramWebhook(new Request('https://x/api/telegram', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': SECRET }, body: JSON.stringify(update) }), env);
    expect(res.status).toBe(200);
    const thanks = sent.find((c) => c.method === 'sendMessage')!;
    expect(String(thanks.body.text)).toContain('поддержку');
    expect((await board(env, 5)).top[0].gold).toBe(true);
    const out = JSON.stringify(await (await leaderboard(await post(5), env)).json());
    expect(out).not.toContain(TOKEN);
    expect(out).not.toContain(SECRET);
  });
});
