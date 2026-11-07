import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import { startCohort } from '../src/game/onboarding';
import { learningEvening, QUIET_DAYS, shelfWaits } from '../src/game/firstday';
import { ru } from '../src/i18n/ru';
import { en } from '../src/i18n/en';

// Тихие дни новичка после первого (07.11): во 2-й день новичок впервые сам и за кассой, и у полок.
// Покупатель у опустевшей полки ждёт, а вечером бабушка подсказывает, а не ругает (рейтинг — firstday.test.ts).

const fresh = (patch: Partial<StoreState> = {}): StoreState => ({ ...startCohort(newGame(), 'play'), ...patch });
const old = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), tourDone: true, ...patch });

describe('тихие дни: у пустой полки ждут', () => {
  it('в первый день — пока бабушка в зале (она разложит), во 2-й и 3-й — новичка', () => {
    expect(shelfWaits(fresh(), true)).toBe(true);
    expect(shelfWaits(fresh(), false)).toBe(false);
    expect(shelfWaits(fresh({ day: 2 }), false)).toBe(true);
    expect(shelfWaits(fresh({ day: QUIET_DAYS }), false)).toBe(true);
    expect(shelfWaits(fresh({ day: QUIET_DAYS + 1 }), false)).toBe(false);
  });

  it('старые сохранения и прежнее начало — как раньше: не ждут', () => {
    for (const s of [old(), old({ day: 2 }), startCohort(newGame(), 'tour'), { ...startCohort(newGame(), 'tour'), day: 2 }]) {
      expect(shelfWaits(s, true)).toBe(false);
      expect(shelfWaits(s, false)).toBe(false);
    }
  });
});

describe('тихие дни: вечером бабушка подсказывает', () => {
  it('только во 2-й и 3-й вечер новичка (в первый — её прощание)', () => {
    expect(learningEvening(fresh())).toBe(false);
    expect(learningEvening(fresh({ day: 2 }))).toBe(true);
    expect(learningEvening(fresh({ day: QUIET_DAYS }))).toBe(true);
    expect(learningEvening(fresh({ day: QUIET_DAYS + 1 }))).toBe(false);
    expect(learningEvening(old({ day: 2 }))).toBe(false);
  });

  it('строчка — про пустую полку, без «продавца»', () => {
    expect(ru['summary.granny.learn']).toMatch(/полк/);
    expect(ru['summary.granny.learn']).not.toMatch(/продав/);
    expect(en['summary.granny.learn']).toMatch(/shelf/);
  });
});
