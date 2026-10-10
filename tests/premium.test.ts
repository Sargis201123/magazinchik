import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import { activeDecor, canTry, DECOR, DECOR_KINDS, grantDecor, normalizeDecor, tryDecor, type DecorState } from '../src/game/decor';
import { ownedFrom, STARS_CATALOG, verifyInitData, itemFromPayload, payloadFor } from '../api/_lib/telegram';

const shop = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 10, ...patch });

describe('премиальное оформление', () => {
  it('в каждом новом разделе по пять вещей за звёзды, у каждой своя картинка', () => {
    for (const kind of ['sign', 'wall', 'floor', 'light', 'showpiece'] as const) {
      expect(DECOR.filter((d) => d.kind === kind && d.stars !== undefined)).toHaveLength(5);
    }
    for (const d of DECOR) expect(DECOR_KINDS).toContain(d.kind);
    expect(new Set(DECOR.map((d) => d.id)).size).toBe(DECOR.length);
  });

  it('цены на сервере совпадают с игрой', () => {
    const premium = Object.fromEntries(DECOR.filter((d) => d.stars !== undefined).map((d) => [d.id, d.stars]));
    expect(Object.fromEntries(Object.entries(STARS_CATALOG).map(([id, v]) => [id, v.stars]))).toEqual(premium);
    for (const v of Object.values(STARS_CATALOG)) expect(v.ru.length).toBeLessThanOrEqual(32);
  });

  it('старое сохранение: аквариум переезжает в «Украшение», чужие id выкидываются', () => {
    const old = { owned: ['aquarium', 'wall_mint', 'ghost'], active: { aquarium: 'aquarium', wall: 'wall_mint' } } as unknown as DecorState;
    expect(normalizeDecor(old)).toEqual({ owned: ['aquarium', 'wall_mint'], active: { showpiece: 'aquarium', wall: 'wall_mint' } });
  });

  it('купленное за звёзды выдаётся и сразу ставится', () => {
    const s = grantDecor(shop(), ['sign_gold', 'fountain']);
    expect(s.decor.owned).toEqual(['sign_gold', 'fountain']);
    expect(activeDecor(s, 'sign')?.id).toBe('sign_gold');
    expect(activeDecor(s, 'showpiece')?.id).toBe('fountain');
    expect(grantDecor(s, ['sign_gold'])).toBe(s);
    // Восстановление покупок не меняет то, что игрок поставил сам.
    const quiet = grantDecor(shop(), ['jukebox'], false);
    expect(quiet.decor.owned).toContain('jukebox');
    expect(activeDecor(quiet, 'showpiece')).toBeUndefined();
  });

  it('примерка: один раз, только на сегодня, поверх купленного', () => {
    let s = grantDecor(shop(), ['wall_brick']);
    expect(canTry(s, 'wall_brick')).toBe(false);
    s = tryDecor(s, 'wall_damask')!;
    expect(activeDecor(s, 'wall')?.id).toBe('wall_damask');
    expect(tryDecor(s, 'wall_damask')).toBeNull();
    const tomorrow = { ...s, day: s.day + 1 };
    expect(activeDecor(tomorrow, 'wall')?.id).toBe('wall_brick');
    expect(canTry(tomorrow, 'wall_damask')).toBe(false);
    // За монеты примерять нечего.
    expect(tryDecor(shop(), 'wall_mint')).toBeNull();
  });
});

describe('оплата звёздами на сервере', () => {
  const TOKEN = '123456:TEST-token';
  const enc = new TextEncoder();
  const hmac = async (key: BufferSource, data: string) =>
    crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), enc.encode(data));
  const sign = async (fields: Record<string, string>) => {
    const check = Object.entries(fields)
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join('\n');
    const secret = await hmac(enc.encode('WebAppData'), TOKEN);
    const hash = [...new Uint8Array(await hmac(secret, check))].map((b) => b.toString(16).padStart(2, '0')).join('');
    return new URLSearchParams({ ...fields, hash }).toString();
  };
  const now = Date.UTC(2026, 9, 10);
  const fields = { auth_date: String(now / 1000 - 60), query_id: 'AAA', user: JSON.stringify({ id: 42, first_name: 'Саргис', language_code: 'ru' }) };

  it('подпись Telegram проверяется, подделка и старые данные — нет', async () => {
    const initData = await sign(fields);
    expect((await verifyInitData(initData, TOKEN, 3600, now))?.id).toBe(42);
    expect(await verifyInitData(initData.replace('42', '43'), TOKEN, 3600, now)).toBeNull();
    expect(await verifyInitData(initData, 'other:token', 3600, now)).toBeNull();
    expect(await verifyInitData(initData, TOKEN, 30, now)).toBeNull();
    expect(await verifyInitData('', TOKEN)).toBeNull();
  });

  it('купленное — платежи игрока без возвратов и недоплат', () => {
    const me = { type: 'user', user: { id: 42 } };
    const txs = [
      { id: 'a', amount: 100, source: { ...me, invoice_payload: payloadFor('fountain') } },
      { id: 'b', amount: 50, source: { ...me, invoice_payload: payloadFor('sign_wood') } },
      { id: 'b', amount: 50, receiver: { type: 'user', user: { id: 42 } } },
      { id: 'c', amount: 1, source: { ...me, invoice_payload: payloadFor('jukebox') } },
      { id: 'd', amount: 75, source: { type: 'user', user: { id: 7 }, invoice_payload: payloadFor('lucky_cat') } },
      { id: 'e', amount: 75, source: { ...me, invoice_payload: 'decor:unknown' } },
    ];
    expect(ownedFrom(txs, 42)).toEqual(['fountain']);
    expect(itemFromPayload('decor:aquarium')).toBe('aquarium');
    expect(itemFromPayload('other')).toBeNull();
  });
});
