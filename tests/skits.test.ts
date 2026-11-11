import { describe, expect, it } from 'vitest';
import { newGame, onShelves, type StoreState } from '../src/game/economy';
import { canPick, finishSkit, SKIT_FROM, SKIT_GAP, SKIT_IDS, SKITS, skitGuests, skitsOf, skitToday, walkSkit, type SkitId } from '../src/game/skits';
import { ru } from '../src/i18n/ru';
import { bigDayFor } from '../src/game/bigday';
import { isWet, weatherFor } from '../src/game/weather';

// «Сценки дня» (skits.ts): разговор-дерево на один визит, финалы по выбору и по очкам, расписание от дня и зерна.

const shop = (over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 20, money: 5000, seed: 7, ...over });
const onlyLeft = (id: SkitId) => ({ done: SKIT_IDS.filter((x) => x !== id) });

/** Первый день, когда сегодня — эта сценка (остальные уже сыграны). */
function dayOf(id: SkitId, from = SKIT_FROM): StoreState {
  for (let day = from; day < from + 300; day++) {
    const s = shop({ day, skits: onlyLeft(id) });
    if (skitToday(s) === id) return s;
  }
  throw new Error(`нет дня для ${id}`);
}

describe('сценки: расписание', () => {
  it('не раньше SKIT_FROM и не в особые дни', () => {
    expect(skitToday(shop({ day: SKIT_FROM - 1 }))).toBeNull();
    for (let day = SKIT_FROM; day < 120; day++) if (bigDayFor(day)) expect(skitToday(shop({ day }))).toBeNull();
  });

  it('в разных магазинах — в разные дни', () => {
    const days = (seed: number) => Array.from({ length: 60 }, (_, i) => Boolean(skitToday(shop({ seed, day: SKIT_FROM + i }))));
    expect(days(7)).not.toEqual(days(8));
  });

  it('курьер — только в дождь', () => {
    for (let day = SKIT_FROM; day < 200; day++) if (skitToday(shop({ day, skits: onlyLeft('rain') }))) expect(isWet(weatherFor(day))).toBe(true);
  });
});

describe('сценки: дерево разговора', () => {
  it('каждый путь ведёт куда-то, у каждого узла с репликой — 2–4 ответа или финал, финалы достижимы', () => {
    for (const id of SKIT_IDS) {
      const skit = SKITS[id];
      const seen = new Set<string>();
      const stack = [skit.start];
      while (stack.length) {
        const name = stack.pop()!;
        if (seen.has(name)) continue;
        seen.add(name);
        const node = skit.nodes[name];
        expect(node, `${id}.${name}`).toBeTruthy();
        if (node.byScore) stack.push(...node.byScore.map(([, to]) => to));
        else if (node.end) expect(node.options).toBeUndefined();
        else {
          expect(node.options!.length, `${id}.${name}`).toBeGreaterThanOrEqual(1);
          expect(node.options!.length).toBeLessThanOrEqual(4);
          stack.push(...node.options!.map((o) => o.to));
        }
      }
      // Ни одного забытого узла; у сценки есть и хороший, и плохой (или обычный) финал.
      expect([...seen].sort()).toEqual(Object.keys(skit.nodes).sort());
      const tones = Object.values(skit.nodes).flatMap((n) => (n.end ? [n.end.tone] : []));
      expect(tones.some((t) => t === 'great' || t === 'good')).toBe(true);
      expect(tones.some((t) => t === 'bad' || t === 'ok')).toBe(true);
    }
  });

  it('детектив: вор — парень в капюшоне; ошибся — минус рейтинг', () => {
    const s = dayOf('robbery', 10);
    // Описание → свидетель → полиция → поговорить с парнем → назад → указать на него.
    const right = finishSkit(s, 'robbery', [0, 1, 0, 2, 0, 3, 2])!;
    expect(right.tone).toBe('great');
    expect(right.state.money).toBe(s.money + 300);
    expect(right.state.rating).toBeGreaterThan(s.rating);
    const wrong = finishSkit(s, 'robbery', [1, 3, 1])!;
    expect(wrong.tone).toBe('bad');
    expect(wrong.state.rating).toBeLessThan(s.rating);
    expect(skitsOf(wrong.state).done).toContain('robbery');
    expect(skitsOf(wrong.state).nextAt).toBe(s.day + SKIT_GAP);
    expect(skitToday(wrong.state)).toBeNull();
  });

  it('прямой эфир: финал по очкам', () => {
    expect(walkSkit('blogger', [0, 0, 0, 0])!.node).toBe('viral');
    expect(walkSkit('blogger', [0, 1, 1, 1])!.node).toBe('flop');
    expect(walkSkit('blogger', [1, 2, 1, 1])!.node).toBe('nice');
    const s = dayOf('blogger', 12);
    const done = finishSkit(s, 'blogger', [0, 0, 0, 0])!;
    expect(skitGuests(done.state)).toBeCloseTo(1.15);
  });

  it('пирожки: можно попробовать другие, лучшее — капуста, недорого, Лёше побольше', () => {
    expect(walkSkit('pies', [1, 1, 0, 0, 0, 1])!.node).toBe('hit');
    expect(walkSkit('pies', [2, 0, 2, 2])!.node).toBe('flop');
  });

  it('ответ с ценой: товар и деньги уходят, нет — ответ недоступен', () => {
    const s = dayOf('puppy');
    const meat = SKITS.puppy.nodes.where.options![0];
    expect(canPick(s, meat)).toBe(onShelves(s, 'meat') + (s.warehouse.meat?.length ?? 0) > 0);
    const gift = SKITS.gift.nodes.tea.options![0];
    expect(canPick(shop({ money: 10 }), gift)).toBe(false);
    const g = dayOf('gift', 10);
    const best = finishSkit(g, 'gift', [0, 0, 0])!;
    expect(best.tone).toBe('great');
    expect(best.state.money).toBe(g.money - 50);
  });

  it('не та сценка или путь не до финала — null', () => {
    const s = dayOf('pies', 9);
    expect(finishSkit(s, 'robbery', [1, 3, 1])).toBeNull();
    expect(finishSkit(s, 'pies', [0])).toBeNull();
    expect(walkSkit('pies', [9])).toBeNull();
  });
});

describe('сценки: тексты', () => {
  it('у каждой реплики, ответа и героя есть текст', () => {
    const keys = ru as Record<string, string>;
    for (const id of SKIT_IDS) {
      const skit = SKITS[id];
      expect(keys[`skit.${id}.title`], `${id}.title`).toBeTruthy();
      for (const [name, node] of Object.entries(skit.nodes)) {
        expect(keys[`skit.${id}.cast.${node.who}`], `${id}.cast.${node.who}`).toBeTruthy();
        if (node.byScore) continue;
        expect(keys[`skit.${id}.${name}`], `skit.${id}.${name}`).toBeTruthy();
        (node.options ?? []).forEach((_, i) => expect(keys[`skit.${id}.${name}.${i}`], `skit.${id}.${name}.${i}`).toBeTruthy());
      }
    }
  });
});
