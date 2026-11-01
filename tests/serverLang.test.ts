import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LANGS, langOf, type Lang } from '../api/_lib/lang';
import { DEFAULT_TZ, ITEMS, money, PEOPLE, pickReminder, reasons, TEXTS, type Player } from '../api/_lib/remind';
import { headline, paperFor, sendNewspapers } from '../api/_lib/newspaper';
import { commandReply, startCaption } from '../api/_lib/botProfile';
import { catalogItem, STARS_CATALOG, type D1, type D1Statement, type Env } from '../api/_lib/telegram';
import { socialPing } from '../api/_lib/social';
import { markWeek, weekOf } from '../api/_lib/guild';
import { DEFAULT_EVENTS } from '../src/game/live';

// Серверные тексты на турецком и испанском — так же, как ru/en.

const CYRILLIC = /[А-Яа-яЁё]/;
const EMOJI = /\p{Extended_Pictographic}/gu;
const placeholders = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('langOf', () => {
  it('полные коды, регистр, русскоязычные соседи, остальное — en, пусто — ru', () => {
    expect(langOf('ru')).toBe('ru');
    expect(langOf('en')).toBe('en');
    expect(langOf('tr')).toBe('tr');
    expect(langOf('es')).toBe('es');
    expect(langOf('es-MX')).toBe('es');
    expect(langOf('ES_ar')).toBe('es');
    expect(langOf('tr-TR')).toBe('tr');
    expect(langOf('pt_BR')).toBe('en');
    expect(langOf('pt')).toBe('en');
    expect(langOf('en-US')).toBe('en');
    expect(langOf('de')).toBe('en');
    for (const code of ['ru', 'RU', 'ru-RU', 'uk', 'be', 'kk', 'uz', 'ky', 'hy', 'az', 'tg']) expect(langOf(code)).toBe('ru');
    expect(langOf(undefined)).toBe('ru');
    expect(langOf(null)).toBe('ru');
    expect(langOf('')).toBe('ru');
    expect(langOf('  ')).toBe('ru');
    expect(langOf(42)).toBe('ru');
  });
});

const player = (patch: Partial<Player> = {}): Player => ({
  id: 1,
  lang: 'ru',
  tz: DEFAULT_TZ,
  sonya: 0,
  spoil: 0,
  streak: 0,
  gift: '',
  cashier: 0,
  day: 14,
  reason: null,
  helper: null,
  ...patch,
});

describe('напоминания на tr и es', () => {
  it('у всех таблиц remind.ts одни ключи и одни подстановки на всех языках', () => {
    for (const table of [TEXTS, ITEMS, PEOPLE] as Record<Lang, Record<string, unknown>>[]) {
      const keys = Object.keys(table.ru).sort();
      expect(Object.keys(table).sort()).toEqual([...LANGS].sort());
      for (const lang of LANGS) expect(Object.keys(table[lang]).sort()).toEqual(keys);
    }
    for (const lang of LANGS) {
      for (const key of Object.keys(TEXTS.ru)) {
        expect(placeholders(TEXTS[lang][key]), `${lang}.${key}`).toEqual(placeholders(TEXTS.ru[key]));
        expect(TEXTS[lang][key].match(EMOJI) ?? [], `${lang}.${key}`).toEqual(TEXTS.ru[key].match(EMOJI) ?? []);
      }
      if (lang !== 'ru') for (const text of Object.values(TEXTS[lang])) expect(text).not.toMatch(CYRILLIC);
    }
  });

  it('pickReminder: турецкий и испанский — без кириллицы, с эмодзи и припиской', () => {
    const now = Date.UTC(2026, 10, 4, 9, 0);
    const busy = { sonya: 1, spoil: 4, streak: 3, gift: '2026-11-03', cashier: 1, order: 'petr:bread', qty: 3, letter: 'valya', chest: 1250 };
    const tr = pickReminder(player({ lang: 'tr', ...busy }), now, DEFAULT_EVENTS);
    expect(tr.reason).toBe('sonya');
    expect(tr.text).toMatch(/^👧 Sonya: “Baba/);
    expect(tr.text).toContain('Seni bekleyenler:');
    expect(tr.text).toContain('Pyotr Ilyich için sipariş');
    expect(tr.text).toContain('1 250 💰');
    expect(tr.text).not.toMatch(CYRILLIC);
    const es = pickReminder(player({ lang: 'es', ...busy }), now, DEFAULT_EVENTS);
    expect(es.text).toMatch(/^👧 Sonia: “Papá/);
    expect(es.text).toContain('el pedido de Piotr Ilich');
    expect(es.text).toContain('una carta de Valentina');
    expect(es.text).not.toMatch(CYRILLIC);
    // Повод «день»: и тут без кириллицы.
    for (const lang of ['tr', 'es'] as const) {
      const r = pickReminder(player({ lang, reason: 'day' }), now, DEFAULT_EVENTS);
      expect(r.text).toMatch(/^👵 /);
      expect(r.text).toContain('14');
      expect(r.text).not.toMatch(CYRILLIC);
    }
  });

  it('даты и дни до Нового года: «13 Aralık», «13 de diciembre»; гости — Ayaz Dede и el Abuelo Frío', () => {
    const guestDay = Date.UTC(2026, 11, 13, 9, 0);
    const tr = reasons(player({ lang: 'tr', helper: 'Ayşe' }), guestDay, DEFAULT_EVENTS);
    expect(tr.map((x) => x.reason)).toEqual(['helped', 'guest', 'card', 'weekend', 'day']);
    expect(tr[1].text).toContain('Ayaz Dede');
    expect(tr[2].text).toContain('13 Aralık');
    expect(tr[2].text).toContain('19 gün'); // после числа — единственное число
    const es = reasons(player({ lang: 'es' }), guestDay, DEFAULT_EVENTS);
    expect(es.find((x) => x.reason === 'guest')!.text).toContain('El Abuelo Frío');
    expect(es.find((x) => x.reason === 'card')!.text).toContain('13 de diciembre');
    expect(es.find((x) => x.reason === 'card')!.text).toContain('19 días');
    for (const r of [...tr, ...es]) expect(r.text).not.toMatch(CYRILLIC);
  });

  it('суммы: ru, tr, es — разряды пробелом, en — запятой', () => {
    expect(money(1200, 'ru')).toBe('1 200');
    expect(money(1200, 'tr')).toBe('1 200');
    expect(money(1200, 'es')).toBe('1 200');
    expect(money(1200, 'en')).toBe('1,200');
  });
});

describe('бот: профиль, команды, каталог', () => {
  it('приветствие и ответы на команды на tr и es', () => {
    for (const lang of ['tr', 'es'] as const) {
      for (const info of [{}, { day: 14 }, { friend: 'Ana' }]) expect(startCaption(lang, info)).not.toMatch(CYRILLIC);
      expect(commandReply('/terms', lang)).not.toMatch(CYRILLIC);
      expect(commandReply('/paysupport', lang, 77)).toContain('77');
      expect(commandReply('/start', lang)).toBeNull();
    }
    expect(startCaption('es', { day: 14 })).toMatch(/^Día 14\. .*Sonia/s);
    expect(startCaption('tr', { day: 14 })).toMatch(/^14\. gün\. .*Sonya/s);
    // Как раньше: true — ru, false — en.
    expect(startCaption(true, {})).toBe(startCaption('ru', {}));
    expect(startCaption(false, {})).toBe(startCaption('en', {}));
  });

  it('у каждой вещи за звёзды — название на всех языках (не длиннее 32 знаков)', () => {
    for (const item of [...Object.values(STARS_CATALOG), catalogItem('pass_3')!]) {
      for (const lang of LANGS) {
        expect(item[lang]).toBeTruthy();
        expect(item[lang].length).toBeLessThanOrEqual(32);
        if (lang !== 'ru') expect(item[lang]).not.toMatch(CYRILLIC);
      }
    }
  });
});

describe('газета на tr и es', () => {
  it('заголовки на всех языках, без кириллицы — кроме ru', () => {
    const cases = [
      { revenue: 100, prev: 0, friends: 1, weekendRank: 3 },
      { revenue: 100, prev: 0, friends: 3, rank: 1 },
      { revenue: 100, prev: 0, friends: 1, duelWon: true },
      { revenue: 200, prev: 100, friends: 1 },
      { revenue: 50, prev: 100, friends: 1 },
      { revenue: 100, prev: 100, friends: 1 },
    ];
    for (const lang of ['en', 'tr', 'es'] as const) {
      const all = cases.map((c) => headline(lang, c));
      expect(new Set(all).size).toBe(cases.length);
      for (const h of all) expect(h).not.toMatch(CYRILLIC);
    }
    expect(headline('ru', cases[5])).toBe('НЕДЕЛЯ ПОЗАДИ: магазин работает, район доволен');
  });
});

// Настоящая SQLite из Node (22.5+) вместо Cloudflare D1 — как в newspaper.test.ts.
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
const enc = new TextEncoder();
const hmac = async (key: BufferSource, data: string) =>
  crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), enc.encode(data));
async function initData(id: number): Promise<string> {
  const fields = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id, first_name: 'Test' }) };
  const check = Object.entries(fields).map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = await hmac(enc.encode('WebAppData'), TOKEN);
  const hash = [...new Uint8Array(await hmac(secret, check))].map((b) => b.toString(16).padStart(2, '0')).join('');
  return new URLSearchParams({ ...fields, hash }).toString();
}
const ping = async (id: number, lang: string) => new Request('https://x/api', { method: 'POST', body: JSON.stringify({ initData: await initData(id), lang }) });

let sent: { chat_id: number; text: string; reply_markup?: { inline_keyboard: { text: string }[][] } }[] = [];
beforeEach(() => {
  sent = [];
  vi.stubGlobal('fetch', async (url: string, init: { body: string }) => {
    if (url.endsWith('/getMe')) return new Response(JSON.stringify({ ok: true, result: { username: 'magazinchik_bot' } }));
    sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ ok: true, result: {} }));
  });
});
afterEach(() => vi.unstubAllGlobals());

const DAY = 24 * 3600_000;
const MON = Date.UTC(2026, 10, 2, 12);

describe.skipIf(!Database)('газета: язык игрока из players', () => {
  it('игра прислала tr / es-MX / pt / kk — газета на турецком, испанском, английском, русском', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1(), APP_URL: 'https://app/' };
    const langs: Record<number, string> = { 1: 'tr', 2: 'es-MX', 3: 'pt', 4: 'kk' };
    for (const [id, lang] of Object.entries(langs)) await socialPing(await ping(Number(id), lang), env);
    const db = env.DB!;
    const stored = (await db.prepare('SELECT id, lang FROM players ORDER BY id').all<{ id: number; lang: string }>()).results;
    expect(stored.map((r) => r.lang)).toEqual(['tr', 'es', 'en', 'ru']);
    for (const id of [1, 2, 3, 4]) {
      await markWeek(db, id, 0, MON - 7 * DAY);
      await markWeek(db, id, 12500, MON);
    }
    expect(await sendNewspapers(env, MON)).toBe(4);
    const paper = (id: number) => sent.find((m) => m.chat_id === id)!;
    expect(paper(1).text).toContain('<b>Mahalle Gazetesi</b>');
    expect(paper(1).text).toContain('Haftalık hasılat: 12 500');
    expect(paper(1).reply_markup!.inline_keyboard[0][0].text).toBe('▶ Dükkânı aç');
    expect(paper(2).text).toContain('<b>La Gaceta del Barrio</b>');
    expect(paper(2).text).toContain('Ingresos de la semana: 12 500');
    expect(paper(2).reply_markup!.inline_keyboard[0][0].text).toBe('▶ Abrir la tienda');
    expect(paper(3).text).toContain('The Town Gazette');
    expect(paper(4).text).toContain('Вестник района');
    for (const id of [1, 2, 3]) expect(paper(id).text).not.toMatch(CYRILLIC);
    expect(await paperFor(db, 1, weekOf(MON) - 1, 'es')).toContain('🗞 <b>La Gaceta del Barrio</b>');
  });
});
