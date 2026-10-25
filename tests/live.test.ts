import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import { activeDecor, decorItem } from '../src/game/decor';
import {
  activeEvent,
  addDays,
  CARD_LINES,
  cardArt,
  cardLine,
  cardOf,
  cardWaiting,
  dateAt,
  DEFAULT_EVENTS,
  eventKey,
  guestDue,
  guestOn,
  inRange,
  LIVE_THEMES,
  liveLook,
  nextGuest,
  openCard,
  openedCards,
  parseEvents,
  seeGuest,
  type LiveEvent,
} from '../src/game/live';
import { comebackHooks } from '../src/game/comeback';
import { ru } from '../src/i18n/ru';
import { en } from '../src/i18n/en';
import { TEXTURES } from '../src/scenes/textures';

// Картинки, что лежат в public/assets (vite находит их сам, без node:fs).
const files = Object.keys(import.meta.glob(['../public/assets/card_*.png', '../public/assets/portrait_*.png', '../public/assets/holiday_*.png']));
const existsSync = (path: string): boolean => files.includes(`../${path}`);

const shop = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), tourDone: true, day: 20, level: 1, ...patch });
const NY = DEFAULT_EVENTS.find((e) => e.theme === 'newyear')!;

describe('праздники по настоящему календарю', () => {
  it('Новый год идёт с 1 декабря по 10 января, через границу года; 23 Февраля и 8 Марта — свои дни', () => {
    expect(activeEvent(DEFAULT_EVENTS, '2026-11-30')).toBeNull();
    expect(activeEvent(DEFAULT_EVENTS, '2026-12-01')?.theme).toBe('newyear');
    expect(activeEvent(DEFAULT_EVENTS, '2027-01-10')?.theme).toBe('newyear');
    expect(activeEvent(DEFAULT_EVENTS, '2027-01-11')).toBeNull();
    expect(activeEvent(DEFAULT_EVENTS, '2027-02-23')?.theme).toBe('feb23');
    expect(activeEvent(DEFAULT_EVENTS, '2027-03-08')?.theme).toBe('march8');
    expect(activeEvent(DEFAULT_EVENTS, '2027-06-15')).toBeNull();
    // Праздник, которому начало в декабре, — ключ того года, когда он начался.
    expect(eventKey(NY, '2026-12-20')).toBe('newyear:2026');
    expect(eventKey(NY, '2027-01-05')).toBe('newyear:2026');
    expect(inRange('01-05', '12-20', '01-10')).toBe(true);
    expect(inRange('11-05', '12-20', '01-10')).toBe(false);
  });

  it('открытка на каждый день декабря: номер, последняя — с салютом', () => {
    expect(cardOf(NY, '2026-12-01')).toEqual({ n: 1, total: 31 });
    expect(cardOf(NY, '2026-12-31')).toEqual({ n: 31, total: 31 });
    // В январе праздник ещё идёт (огоньки на улице), а открыток уже нет.
    expect(cardOf(NY, '2027-01-03')).toBeNull();
    expect(cardArt('newyear', 31, 31)).toBe('card_newyear_fireworks');
    expect(cardArt('newyear', 9, 31)).toBe('card_newyear_tree');
    // Открытки через Новый год (автор сдвинул даты): номер всё равно по порядку.
    const wrap: LiveEvent = { id: 'ny', theme: 'newyear', from: '12-20', to: '01-10', cards: { from: '12-25', to: '01-05' } };
    expect(cardOf(wrap, '2027-01-02')).toEqual({ n: 9, total: 12 });
    // Строчек на открытки хватает, дальше — по кругу; тексты есть на обоих языках.
    expect(cardLine('newyear', 32)).toBe('live.newyear.card.1');
    for (const theme of LIVE_THEMES)
      for (let n = 1; n <= CARD_LINES[theme]; n++) {
        expect(ru[cardLine(theme, n)]).toBeTruthy();
        expect(en[cardLine(theme, n)]).toBeTruthy();
      }
  });

  it('открыть открытку можно раз в день; за семь — ёлка в зал, бесплатно', () => {
    let s = shop();
    for (let d = 1; d <= 6; d++) {
      const date = `2026-12-0${d}`;
      expect(cardWaiting(s, NY, date)).toBe(true);
      const opened = openCard(s, NY, date)!;
      expect(opened.gift.prize).toBeUndefined();
      expect(opened.state.money).toBe(s.money + opened.gift.coins);
      s = opened.state;
      expect(openCard(s, NY, date)).toBeNull();
      expect(cardWaiting(s, NY, date)).toBe(false);
    }
    expect(s.decor.owned).not.toContain('holiday_tree');
    // Пропустил день — не беда: считаются открытые, а не дни подряд.
    const seventh = openCard(s, NY, '2026-12-09')!;
    expect(seventh.gift.prize).toBe('holiday_tree');
    expect(activeDecor(seventh.state, 'holiday')?.id).toBe('holiday_tree');
    expect(openedCards(seventh.state, NY, '2026-12-09')).toHaveLength(7);
    // Последняя открытка декабря — втрое щедрее обычной.
    const last = openCard(seventh.state, NY, '2026-12-31')!;
    expect(last.gift.coins).toBe(3 * openCard(seventh.state, NY, '2026-12-30')!.gift.coins);
    // На будущий год — снова с нуля; позапрошлогодние открытки из сохранения убираются.
    const nextYear = openCard({ ...last.state, live: { ...last.state.live, cards: { ...last.state.live!.cards, 'newyear:2024': ['2024-12-01'] } } }, NY, '2027-12-01')!;
    expect(Object.keys(nextYear.state.live!.cards!).sort()).toEqual(['newyear:2026', 'newyear:2027']);
    // В дни без открыток открывать нечего.
    expect(openCard(s, NY, '2027-01-05')).toBeNull();
    expect(openCard(s, DEFAULT_EVENTS[1], '2026-12-05')).toBeNull();
  });

  it('гость заходит в свои дни, один раз за настоящий день, и оставляет подарок', () => {
    expect(guestOn(NY, '2026-12-06')).toBe('snegurochka');
    expect(guestOn(NY, '2026-12-07')).toBeNull();
    expect(nextGuest(NY, '2026-12-07')).toEqual({ date: '2026-12-13', who: 'moroz' });
    expect(nextGuest(NY, '2026-12-31')).toBeNull();
    const s = shop();
    expect(guestDue(s, NY, '2026-12-13')).toBe('moroz');
    const after = seeGuest(s, '2026-12-13');
    expect(after.money).toBeGreaterThan(s.money);
    expect(guestDue(after, NY, '2026-12-13')).toBeNull();
    expect(guestDue(after, NY, '2026-12-20')).toBe('snegurochka');
    expect(guestDue(after, null, '2026-12-20')).toBeNull();
  });

  it('украшения: тема праздника, а выключенные автором — без украшений', () => {
    expect(liveLook(DEFAULT_EVENTS, '2026-12-15')).toBe('newyear');
    expect(liveLook(DEFAULT_EVENTS, '2027-03-07')).toBe('march8');
    expect(liveLook([{ ...NY, decorate: false }], '2026-12-15')).toBeNull();
    expect(liveLook([{ ...NY, off: true }], '2026-12-15')).toBeNull();
  });

  it('календарь от сервера проверяется: неверные праздники отбрасываются с понятной ошибкой', () => {
    expect(parseEvents(DEFAULT_EVENTS)).toEqual({ events: DEFAULT_EVENTS, errors: [] });
    const { events, errors } = parseEvents([
      { id: 'ok', theme: 'march8', from: '03-01', to: '03-08', decorate: false },
      { id: 'Bad id', theme: 'newyear', from: '12-01', to: '12-31' },
      { id: 'x', theme: 'easter', from: '04-01', to: '04-02' },
      { id: 'y', theme: 'newyear', from: '12-1', to: '12-31' },
      { id: 'z', theme: 'newyear', from: '12-01', to: '12-31', cards: { from: '11-25', to: '12-31' } },
      { id: 'g', theme: 'newyear', from: '12-01', to: '12-31', guests: { '12-05': 'santa' } },
      { id: 'p', theme: 'newyear', from: '12-01', to: '12-31', prize: { decor: 'aquarium', cards: 3 } },
    ]);
    expect(events).toEqual([{ id: 'ok', theme: 'march8', from: '03-01', to: '03-08', decorate: false }]);
    expect(errors).toHaveLength(6);
    expect(parseEvents({ events: [] }).errors).toHaveLength(1);
  });

  it('у каждой праздничной вещи и открытки есть картинка, у вещей — текстура мира', () => {
    for (const e of DEFAULT_EVENTS) {
      if (e.prize) {
        expect(decorItem(e.prize.decor).holiday).toBe(e.theme);
        expect(TEXTURES).toContain(decorItem(e.prize.decor).texture);
      }
      const card = cardOf(e, `2026-${e.cards!.from}`)!;
      for (let n = 1; n <= card.total; n++) expect(existsSync(`public/assets/${cardArt(e.theme, n, card.total)}.png`)).toBe(true);
    }
    for (const who of ['moroz', 'snegurochka']) expect(existsSync(`public/assets/portrait_${who}_happy.png`)).toBe(true);
    for (const id of ['sign_frost', 'wall_winter']) expect(TEXTURES).toContain(id);
  });

  it('дата игрока по его часовому поясу; дни считаются через границы месяцев', () => {
    const now = Date.UTC(2026, 11, 31, 22, 30);
    expect(dateAt(now, 180)).toBe('2027-01-01');
    expect(dateAt(now, -300)).toBe('2026-12-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
  });
});

describe('поводы для напоминаний от игры', () => {
  it('Соня ждёт, порча, серия гостинцев, кассир', () => {
    const s = shop({ day: 2, gift: { lastDate: '2026-12-01', streak: 3 } });
    const hooks = comebackHooks(s);
    expect(hooks).toMatchObject({ sonya: 1, streak: 3, gift: '2026-12-01', cashier: 0, day: 2 });
    expect(hooks.spoil).toBeGreaterThanOrEqual(0);
    expect(comebackHooks({ ...s, day: 1 }).sonya).toBe(1);
  });
});
