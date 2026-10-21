import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import { answerLife, companionOf, LIFE, LIFE_GIFT, lifeNews, livedRegular } from '../src/game/life';
import { regularById, regularState, regularsToday } from '../src/game/regulars';

const at = (day: number, patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day, money: 1000, ...patch });

describe('живой район', () => {
  it('новость приходит в свой день, давние — без новости', () => {
    expect(lifeNews(at(24))).toBeNull();
    expect(lifeNews(at(25))?.id).toBe('kostya_diploma');
    // Давно прошедшее (старое сохранение) — уже прожито, новостью не всплывает.
    expect(lifeNews(at(40 + 30))?.id).toBe('kostya_wedding');
    expect(lifeNews(at(300))).toBeNull();
  });

  it('подарок поднимает доверие сильнее и стоит денег; ответ — один раз', () => {
    const s = at(40);
    const ev = lifeNews(s)!;
    expect(ev.who).toEqual(['petr', 'olga']);
    const gift = answerLife(s, ev, true)!;
    const congrats = answerLife(s, ev, false)!;
    expect(gift.money).toBe(s.money - LIFE_GIFT);
    expect(regularState(gift, 'petr').loyalty).toBe(regularState(congrats, 'petr').loyalty + 1);
    expect(lifeNews(congrats)).toBeNull();
    expect(answerLife({ ...s, money: 0 }, ev, true)).toBeNull();
  });

  it('жизнь меняет людей: диплом, седина, коляска, пары, подросший сын', () => {
    const kostya = regularById('kostya');
    expect(livedRegular(at(10), kostya).tolerance).toBe(kostya.tolerance);
    expect(livedRegular(at(30), kostya).tolerance).toBeGreaterThan(kostya.tolerance);
    expect(livedRegular(at(100), regularById('akhmed')).look.hair).not.toBe(regularById('akhmed').look.hair);
    expect(livedRegular(at(60), regularById('sveta')).look.stroller).toBeDefined();
    expect(livedRegular(at(200), regularById('sveta')).look.stroller).toBeUndefined();
    expect(companionOf(at(30), 'petr')).toBeNull();
    expect(companionOf(at(45), 'olga')?.regular).toBe('petr');
    expect(companionOf(at(80), 'kostya')).not.toBeNull();
    const withJuice = (day: number) => at(day, { shelves: [{ kind: 'drinks', level: 0, items: {} }] });
    expect(regularsToday(withJuice(100)).map((r) => r.id)).not.toContain('misha');
    expect(regularsToday(withJuice(LIFE.find((e) => e.id === 'misha_grown')!.day)).map((r) => r.id)).toContain('misha');
  });
});
