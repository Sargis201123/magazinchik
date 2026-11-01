import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game/economy';
import { restartGame } from '../src/game/restart';
import {
  addKeepsake, claimFarewell, claimLeague, dayCap, duelReward, farewellReward, guildReward, rushPrize, weekendDay, WEEKEND_BONUS, KEEP_CARDS, leagueReward, leagueScore, myStanding, nextTier, openPresents, presentGift, thankCoins, type Keepsake,
} from '../src/game/social';
import { ru } from '../src/i18n/ru';
import { en } from '../src/i18n/en';

// Подарки друзьям и турнир района — правила без сервера.

describe('подарки друзьям', () => {
  it('пирог — монеты, цветы — настроение, открытка — на полку памяти; «спасибо» — дарителю', () => {
    const s = { ...newGame(), level: 2, money: 1000, rating: 3 };
    const out = openPresents(s, [
      { name: 'Маша', kind: 'pie', phrase: 1, stars: 5 },
      { name: 'Петя', kind: 'flowers', phrase: 2, stars: 0 },
      { name: 'Оля', kind: 'card', phrase: 99, stars: 3 },
    ], 2);
    const coins = presentGift(2, 'pie').money + presentGift(2, 'flowers').money + presentGift(2, 'card').money + 2 * thankCoins(2);
    expect(out.money).toBe(coins);
    expect(out.state.money).toBe(1000 + coins);
    expect(out.state.rating).toBeCloseTo(3.05);
    expect(out.state.keepsakes).toEqual([{ k: 'card', from: 'Оля', kind: 'card', phrase: 7, day: s.day }]);
  });

  it('много цветов поднимают рейтинг не больше чем на 0,2 и не выше 5', () => {
    const many = Array.from({ length: 20 }, () => ({ name: 'Друг', kind: 'flowers' as const, phrase: 0, stars: 0 }));
    expect(openPresents({ ...newGame(), rating: 3 }, many, 0).state.rating).toBeCloseTo(3.2);
    expect(openPresents({ ...newGame(), rating: 4.95 }, many, 0).state.rating).toBe(5);
  });

  it('на полке не больше KEEP_CARDS открыток, кубки не вытесняются', () => {
    let list: Keepsake[] = [{ k: 'cup', week: 1, place: 1, tier: 0 }];
    for (let i = 0; i < KEEP_CARDS + 5; i++) list = addKeepsake(list, { k: 'card', from: `n${i}`, kind: 'card', phrase: 0, day: i });
    expect(list.filter((x) => x.k === 'card')).toHaveLength(KEEP_CARDS);
    expect(list[0]).toEqual({ k: 'cup', week: 1, place: 1, tier: 0 });
  });

  it('все фразы, подарки и лиги переведены', () => {
    for (const dict of [ru, en] as Record<string, string>[]) {
      for (let i = 0; i < 8; i++) expect(dict[`social.phrase.${i}`]).toBeTruthy();
      for (const k of ['flowers', 'pie', 'card']) expect(dict[`social.open.${k}`]).toContain('{name}');
      for (const n of [0, 1, 2]) expect(dict[`league.tier.${n}`]).toBeTruthy();
    }
  });
});

describe('турнир района', () => {
  it('очки — прирост по дням, каждый день не больше потолка по помещению', () => {
    const cap = dayCap(0);
    // Дни 5 и 6 (с 1970-01-01) — вторник и среда: без бонуса выходных.
    expect(leagueScore([{ day: 5, start: 0 }, { day: 6, start: 1000 }], 1500, 0)).toBe(1500);
    // Скачок за один день режется потолком; порядок дней неважен.
    expect(leagueScore([{ day: 6, start: 1000 }, { day: 5, start: 0 }], 1000 + cap * 10, 0)).toBe(1000 + cap);
    expect(leagueScore([], 5000, 0)).toBe(0);
    expect(dayCap(99)).toBe(dayCap(5));
  });

  it('выходные (суббота и воскресенье UTC) — очки дня ×WEEKEND_BONUS, потолок — до бонуса', () => {
    const day = (iso: string) => Math.floor(Date.parse(iso) / (24 * 3600_000));
    expect(['2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09'].map((d) => weekendDay(day(d)))).toEqual([false, true, true, false]);
    const sat = day('2026-11-07');
    expect(leagueScore([{ day: sat - 1, start: 0 }, { day: sat, start: 1000 }, { day: sat + 1, start: 2000 }], 3000, 0)).toBe(1000 + 2 * 1000 * WEEKEND_BONUS);
    const cap = dayCap(0);
    expect(leagueScore([{ day: sat, start: 0 }], cap * 5, 0)).toBe(cap * WEEKEND_BONUS);
  });

  it('прощание с дуэлью, гильдией и «Чёрной пятницей»: незабранное — один раз, забранное раньше — нет', () => {
    const s = { ...newGame(), money: 0 };
    const f = { duel: { week: 3000, won: true }, guild: { week: 3000, name: 'Друзья' }, rush: { week: 3000, rank: 5, players: 40 } };
    const all = duelReward(0, true) + guildReward(0) + rushPrize(0, 5, 40);
    expect(farewellReward(s, f)).toBe(all);
    const got = claimFarewell(s, f)!;
    expect(got.money).toBe(all);
    expect(got.state).toMatchObject({ money: all, duelClaimed: 3000, guildClaimed: 3000, rushClaimed: 3000 });
    expect(claimFarewell(got.state, f)).toBeNull();
    // Дуэль за эту неделю уже забрали в старой версии — только гильдия и выходные.
    expect(farewellReward({ ...s, duelClaimed: 3000 }, f)).toBe(guildReward(0) + rushPrize(0, 5, 40));
    expect(claimFarewell(s, undefined)).toBeNull();
    expect(farewellReward(s, {})).toBe(0);
  });

  it('тройка лучших — выше, тройка последних — ниже, пустая неделя без повышения', () => {
    expect(nextTier(0, 1, 10, 500)).toBe(1);
    expect(nextTier(2, 1, 10, 500)).toBe(2);
    expect(nextTier(1, 5, 10, 500)).toBe(1);
    expect(nextTier(1, 8, 10, 500)).toBe(0);
    expect(nextTier(0, 10, 10, 0)).toBe(0);
    expect(nextTier(0, 1, 10, 0)).toBe(0);
  });

  it('место и сколько до места выше', () => {
    const rows = [{ name: 'a', score: 900, level: 1 }, { name: 'b', score: 500, level: 1 }, { name: 'я', score: 300, level: 1, me: true }];
    expect(myStanding(rows)).toEqual({ place: 3, gap: 201 });
    expect(myStanding([{ name: 'я', score: 10, level: 0, me: true }])).toEqual({ place: 1, gap: 0 });
    expect(myStanding([])).toBeNull();
  });

  it('награда забирается один раз; кубок — тройке лучших; после «Начать заново» второй раз не забрать', () => {
    const s = { ...newGame(), money: 0, level: 1 };
    const last = { week: 100, place: 2, size: 10, tier: 1, next: 2, score: 5000 };
    const got = claimLeague(s, last)!;
    expect(got.money).toBe(leagueReward(1, 2, 1));
    expect(got.cup).toBe(true);
    expect(got.state.keepsakes).toEqual([{ k: 'cup', week: 100, place: 2, tier: 1 }]);
    expect(claimLeague(got.state, last)).toBeNull();
    expect(claimLeague(restartGame(got.state), last)).toBeNull();
    expect(restartGame(got.state).keepsakes).toEqual(got.state.keepsakes);
    // Пустая неделя — без монет и кубка, но итог отмечен.
    const none = claimLeague(s, { ...last, score: 0 })!;
    expect(none.money).toBe(0);
    expect(none.cup).toBe(false);
    expect(leagueReward(0, 1, 2)).toBeGreaterThan(leagueReward(0, 1, 0));
  });

  it('старое сохранение без новых полей: награда и подарки работают', () => {
    const old = JSON.parse(JSON.stringify(newGame())) as ReturnType<typeof newGame>;
    delete old.leagueClaimed;
    delete old.keepsakes;
    expect(claimLeague(old, { week: 1, place: 5, size: 10, tier: 0, next: 0, score: 10 })?.state.leagueClaimed).toBe(1);
    expect(openPresents(old, [{ name: 'x', kind: 'card', phrase: 0, stars: 0 }], 0).state.keepsakes).toHaveLength(1);
  });
});
