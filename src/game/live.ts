// Праздники по настоящему календарю игрока: Новый год, 23 Февраля и 8 Марта. В отличие от
// праздников игрового года (calendar.ts — у каждого игрока свои), эти наступают у всех в один
// день — 31 декабря Новый год и в игре.
//
// Календарь хранит сервер (/api/events, api/_lib/live.ts): автор меняет даты, гостей и награды без
// выпуска новой версии игры (как — docs/EVENTS.md). Игра берёт свежий календарь при запуске и
// держит копию; без сети и сервера — встроенная копия DEFAULT_EVENTS ниже.
//
// Праздник даёт:
// - открытку на каждый день (адвент-календарь): тёплая строчка и маленький подарок монетами;
// - бесплатную праздничную вещь в зал за несколько открыток (decor.ts, раздел «Праздничное»);
// - гостя в некоторые дни: Дед Мороз или Снегурочка заходят в магазин с подарком;
// - украшение улицы (гирлянда на фасаде, огоньки на деревьях, тюльпаны у входа);
// - по желанию — набор за звёзды (decor.ts → STAR_PACKS), необязательный.
// На экономику магазина праздник не влияет: только монеты из открыток и гостей.

import type { TextKey } from '../i18n/ru';
import { grantDecor, isDecorId, decorItem, type DecorId } from './decor';
import type { StoreState } from './economy';

/** Оформление и тексты праздника: новую тему добавляет только новая версия игры. */
export type LiveTheme = 'newyear' | 'feb23' | 'march8';
export const LIVE_THEMES: LiveTheme[] = ['newyear', 'feb23', 'march8'];
/** Праздничные гости: портреты portrait_<id>, внешность — в StoreScene. */
export type GuestId = 'moroz' | 'snegurochka';
export const GUEST_IDS: GuestId[] = ['moroz', 'snegurochka'];

/** Праздник в календаре. Даты — «ММ-ДД» по местному времени игрока, концы включительно; через Новый год — можно. */
export interface LiveEvent {
  /** Короткое имя: открытки разных лет одного праздника различает год начала. */
  id: string;
  theme: LiveTheme;
  from: string;
  to: string;
  /** Открытки: с какого по какое число — по одной в день. */
  cards?: { from: string; to: string };
  /** В какие дни («ММ-ДД») заходит гость. */
  guests?: Record<string, GuestId>;
  /** Праздничная вещь в зал — за столько открыток. */
  prize?: { decor: DecorId; cards: number };
  /** Набор за звёзды (STAR_PACKS) — показать по желанию в карточке праздника. */
  pack?: string;
  /** false — без украшений на улице. */
  decorate?: boolean;
  /** true — праздник выключен (остаётся в календаре, но не наступает). */
  off?: boolean;
}

/** Встроенная копия календаря: она же — на сервере, пока автор не сохранил свою (docs/EVENTS.md). */
export const DEFAULT_EVENTS: LiveEvent[] = [
  {
    id: 'newyear',
    theme: 'newyear',
    from: '12-01',
    to: '01-10',
    cards: { from: '12-01', to: '12-31' },
    guests: { '12-06': 'snegurochka', '12-13': 'moroz', '12-20': 'snegurochka', '12-27': 'moroz', '12-31': 'moroz' },
    prize: { decor: 'holiday_tree', cards: 7 },
    pack: 'pack_newyear',
  },
  { id: 'feb23', theme: 'feb23', from: '02-21', to: '02-23', cards: { from: '02-21', to: '02-23' }, prize: { decor: 'holiday_ship', cards: 2 } },
  { id: 'march8', theme: 'march8', from: '03-06', to: '03-08', cards: { from: '03-06', to: '03-08' }, prize: { decor: 'holiday_mimosa', cards: 2 } },
];

/** Что игрок уже получил: открытые открытки по праздникам («id:год» → даты) и день последнего гостя. */
export interface LiveState {
  cards?: Record<string, string[]>;
  guest?: string;
}

// ---------------------------------------------------------------- даты

const DAY = 24 * 3600_000;
const MD_RE = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const ID_RE = /^[a-z0-9_]{1,24}$/;

/** «ММ-ДД» из даты «ГГГГ-ММ-ДД». */
const md = (date: string): string => date.slice(5);
const dayNumber = (date: string): number => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / DAY;
/** Сколько дней от a до b (даты «ГГГГ-ММ-ДД»). */
export const daysBetween = (a: string, b: string): number => Math.round(dayNumber(b) - dayNumber(a));
/** Дата через n дней. */
export function addDays(date: string, n: number): string {
  const d = new Date((dayNumber(date) + n) * DAY);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Попадает ли число («ММ-ДД») в промежуток; промежуток может идти через Новый год (12-20 … 01-10). */
export const inRange = (day: string, from: string, to: string): boolean => (from <= to ? day >= from && day <= to : day >= from || day <= to);

/** Последняя дата не позже date с этим числом: начало текущего промежутка. */
const lastOn = (mmdd: string, date: string): string => `${mmdd <= md(date) ? date.slice(0, 4) : Number(date.slice(0, 4)) - 1}-${mmdd}`;

/** Дата игрока по смещению его часового пояса (минуты к востоку от Гринвича) — для сервера. */
export function dateAt(now: number, tz: number): string {
  const d = new Date(now + tz * 60_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- календарь

/** Праздник, который идёт в этот день (первый подходящий), или null. */
export function activeEvent(events: LiveEvent[], date: string): LiveEvent | null {
  return events.find((e) => !e.off && inRange(md(date), e.from, e.to)) ?? null;
}

/** Ключ праздника этого года: открытки 2026-го и 2027-го не путаются. */
export const eventKey = (e: LiveEvent, date: string): string => `${e.id}:${lastOn(e.from, date).slice(0, 4)}`;

/** Открытка этого дня: её номер и сколько всего; null — открыток сегодня нет. */
export function cardOf(e: LiveEvent, date: string): { n: number; total: number } | null {
  const cards = e.cards;
  if (!cards || !inRange(md(date), cards.from, cards.to) || !inRange(md(date), e.from, e.to)) return null;
  const start = lastOn(cards.from, date);
  const endYear = Number(start.slice(0, 4)) + (cards.to >= cards.from ? 0 : 1);
  return { n: daysBetween(start, date) + 1, total: daysBetween(start, `${endYear}-${cards.to}`) + 1 };
}

/** Сколько разных строчек у открыток праздника (live.<тема>.card.N): дальше идут по кругу. */
export const CARD_LINES: Record<LiveTheme, number> = { newyear: 31, feb23: 3, march8: 3 };
export const cardLine = (theme: LiveTheme, n: number): TextKey => `live.${theme}.card.${((n - 1) % CARD_LINES[theme]) + 1}` as TextKey;

/** Картинки открыток (art/holidays.py): по кругу, последняя открытка праздника — своя. */
const CARD_ART: Record<LiveTheme, string[]> = {
  newyear: ['tree', 'snowman', 'gifts', 'mittens', 'house', 'tangerines', 'star', 'clock'].map((m) => `card_newyear_${m}`),
  feb23: ['card_feb23'],
  march8: ['card_march8'],
};
const FINAL_ART: Partial<Record<LiveTheme, string>> = { newyear: 'card_newyear_fireworks' };
export const cardArt = (theme: LiveTheme, n: number, total: number): string =>
  n === total && FINAL_ART[theme] ? FINAL_ART[theme]! : CARD_ART[theme][(n - 1) % CARD_ART[theme].length];

/** Кто «подписал» открытку — портрет в окне открытки. */
export const CARD_FROM: Record<LiveTheme, string> = { newyear: 'portrait_snegurochka_happy', feb23: 'portrait_grandma_happy', march8: 'portrait_valya_happy' };

/** Открытые открытки этого праздника (даты). */
export const openedCards = (state: StoreState, e: LiveEvent, date: string): string[] => state.live?.cards?.[eventKey(e, date)] ?? [];

/** Сегодняшнюю открытку можно открыть. */
export const cardWaiting = (state: StoreState, e: LiveEvent | null, date: string): boolean =>
  Boolean(e && cardOf(e, date) && !openedCards(state, e, date).includes(date));

/** Подарок открытки: немного монет (растёт с магазином), последняя — втрое щедрее. */
export const cardCoins = (state: StoreState, n: number, total: number): number => Math.round(((20 + 20 * state.level) * (n === total ? 3 : 1)) / 10) * 10;

export interface CardGift {
  n: number;
  total: number;
  coins: number;
  art: string;
  line: TextKey;
  /** Набрали открыток на праздничную вещь — она уже в зале. */
  prize?: DecorId;
}

/** Открыть открытку дня: монеты сразу, а набралось на праздничную вещь — и она. null — сегодня открывать нечего. */
export function openCard(state: StoreState, e: LiveEvent, date: string): { state: StoreState; gift: CardGift } | null {
  const card = cardOf(e, date);
  if (!card || !cardWaiting(state, e, date)) return null;
  const key = eventKey(e, date);
  const opened = [...openedCards(state, e, date), date];
  // Старые праздники (позапрошлого года и раньше) из сохранения убираем — оно не растёт без конца.
  const year = Number(date.slice(0, 4));
  const kept = Object.entries(state.live?.cards ?? {}).filter(([k]) => k !== key && Number(k.split(':')[1]) >= year - 1);
  const coins = cardCoins(state, card.n, card.total);
  let next: StoreState = { ...state, money: state.money + coins, live: { ...state.live, cards: { ...Object.fromEntries(kept), [key]: opened } } };
  let prize: DecorId | undefined;
  const want = e.prize;
  if (want && opened.length >= want.cards && isDecorId(want.decor) && !next.decor.owned.includes(want.decor)) {
    next = grantDecor(next, [want.decor]);
    prize = want.decor;
  }
  return { state: next, gift: { ...card, coins, art: cardArt(e.theme, card.n, card.total), line: cardLine(e.theme, card.n), prize } };
}

// ---------------------------------------------------------------- гости

/** Кто из праздничных гостей заходит в этот день. */
export const guestOn = (e: LiveEvent | null, date: string): GuestId | null => (e && e.guests?.[md(date)]) || null;

/** Гость сегодня ещё не заходил (заходит один раз за настоящий день, сколько игровых дней ни сыграй). */
export const guestDue = (state: StoreState, e: LiveEvent | null, date: string): GuestId | null => (state.live?.guest === date ? null : guestOn(e, date));

/** Подарок гостя: как две обычные открытки. */
export const guestCoins = (state: StoreState): number => cardCoins(state, 1, 2) * 2;

/** Гость зашёл: монеты и отметка, что сегодня он уже был. */
export const seeGuest = (state: StoreState, date: string): StoreState => ({ ...state, money: state.money + guestCoins(state), live: { ...state.live, guest: date } });

/** Ближайший гость после сегодняшнего дня (в пределах праздника). */
export function nextGuest(e: LiveEvent | null, date: string): { date: string; who: GuestId } | null {
  if (!e?.guests) return null;
  for (let i = 1; i <= 62; i++) {
    const day = addDays(date, i);
    if (!inRange(md(day), e.from, e.to)) return null;
    const who = e.guests[md(day)];
    if (who) return { date: day, who };
  }
  return null;
}

// ---------------------------------------------------------------- украшения

/** Как праздник украшает улицу: гирлянда на фасаде, огоньки на деревьях, тюльпаны у входа. */
export const LIVE_LOOKS: Record<LiveTheme, { garland: number[]; treeLights?: boolean; tulips?: boolean }> = {
  newyear: { garland: [0xe43b44, 0xfee761, 0x63c74d, 0x2ce8f5], treeLights: true },
  feb23: { garland: [0x0099db, 0xffffff, 0xe43b44] },
  march8: { garland: [0xf6757a, 0xffffff, 0xe43b44, 0xffd2e2], tulips: true },
};

/** Тема украшений сегодня (null — не праздник или автор выключил украшения). */
export function liveLook(events: LiveEvent[], date: string): LiveTheme | null {
  const e = activeEvent(events, date);
  return e && e.decorate !== false ? e.theme : null;
}

// ---------------------------------------------------------------- календарь с сервера

/**
 * Проверить календарь, присланный сервером или автором: неверные праздники отбрасываются,
 * а что с ними не так — в errors (сервер с ошибками календарь не сохраняет).
 */
export function parseEvents(raw: unknown): { events: LiveEvent[]; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(raw)) return { events: [], errors: ['events: нужен список праздников'] };
  const events: LiveEvent[] = [];
  raw.slice(0, 20).forEach((item, i) => {
    const e = (item ?? {}) as Record<string, unknown>;
    const where = `events[${i}]`;
    const bad = (why: string) => errors.push(`${where}: ${why}`);
    const id = String(e.id ?? '');
    if (!ID_RE.test(id)) return bad('id — латиница, цифры и _, до 24 знаков');
    if (!LIVE_THEMES.includes(e.theme as LiveTheme)) return bad(`theme — одна из ${LIVE_THEMES.join(', ')}`);
    const date = (v: unknown) => typeof v === 'string' && MD_RE.test(v);
    if (!date(e.from) || !date(e.to)) return bad('from и to — даты «ММ-ДД»');
    const out: LiveEvent = { id, theme: e.theme as LiveTheme, from: e.from as string, to: e.to as string };
    if (e.cards !== undefined) {
      const c = (e.cards ?? {}) as Record<string, unknown>;
      if (!date(c.from) || !date(c.to)) return bad('cards.from и cards.to — даты «ММ-ДД»');
      if (!inRange(c.from as string, out.from, out.to) || !inRange(c.to as string, out.from, out.to)) return bad('открытки — внутри праздника (from…to)');
      out.cards = { from: c.from as string, to: c.to as string };
    }
    if (e.guests !== undefined) {
      const g = (e.guests ?? {}) as Record<string, unknown>;
      const guests: Record<string, GuestId> = {};
      for (const [day, who] of Object.entries(g)) {
        if (!date(day) || !GUEST_IDS.includes(who as GuestId)) return bad(`guests: «ММ-ДД»: ${GUEST_IDS.join(' или ')}`);
        guests[day] = who as GuestId;
      }
      out.guests = guests;
    }
    if (e.prize !== undefined) {
      const p = (e.prize ?? {}) as Record<string, unknown>;
      const decor = String(p.decor ?? '');
      const cards = Number(p.cards);
      if (!isDecorId(decor) || decorItem(decor).holiday === undefined) return bad('prize.decor — праздничная вещь (holiday_tree, holiday_ship, holiday_mimosa)');
      if (!Number.isInteger(cards) || cards < 1 || cards > 60) return bad('prize.cards — сколько открыток, от 1 до 60');
      out.prize = { decor, cards };
    }
    if (e.pack !== undefined) {
      if (typeof e.pack !== 'string' || !ID_RE.test(e.pack)) return bad('pack — id набора за звёзды');
      out.pack = e.pack;
    }
    if (e.decorate === false) out.decorate = false;
    if (e.off === true) out.off = true;
    events.push(out);
  });
  return { events, errors };
}
