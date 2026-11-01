import { describe, expect, it } from 'vitest';
import { fire, hire, managerBoost, newGame, workSpeed, type StaffMember, type StoreState } from '../src/game/economy';
import {
  answerCeremony,
  answerOffer,
  ASK_AGAIN,
  BEST_EVERY,
  bestBonus,
  bestGift,
  careerMorning,
  careerNight,
  careerOf,
  dismissLeft,
  LEAVE_XP,
  LOYAL_DAYS,
  migrateCareer,
  NO_ANSWER_AGAIN,
  PLAQUES,
  promotedWage,
  XP_ADMIN,
  XP_BRANCH,
  XP_SENIOR,
  type Career,
} from '../src/game/career';
import { BRANCH_HEAD_BONUS, branchUsual } from '../src/game/branch';
import { letterGroup, planLetter, takeLetter } from '../src/game/returns';
import { nightCycle } from '../src/game/day';

const career = (patch: Partial<Career> = {}): Career => ({ hired: 1, xp: 0, ...patch });
const member = (role: StaffMember['role'], patch: Partial<StaffMember> = {}): StaffMember => ({ role, name: 1, skill: 2, wage: 400, months: 1, career: career(), ...patch });
const at = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 40, level: 3, money: 5000, staff: [member('cashier2'), member('cleaner', { name: 2 })], ...patch });

describe('карьера сотрудников', () => {
  it('нанятый получает летопись с дня найма', () => {
    const s = hire({ ...newGame(), day: 12, level: 2 }, { role: 'cleaner', name: 3, skill: 1, wage: 280, months: 0 })!;
    expect(s.staff[0].career).toEqual({ hired: 12, xp: 0, log: [{ day: 12, kind: 'hired' }] });
  });

  it('старое сохранение: опыт — по стажу, срок «сотрудника месяца» — с сегодняшнего дня', () => {
    const old = at({ staff: [{ role: 'cashier2', name: 0, skill: 3, wage: 500, months: 10 }] });
    const s = migrateCareer(old);
    expect(s.staff[0].career).toMatchObject({ hired: 1, xp: Math.round(70 * 0.85) });
    expect(s.career?.since).toBe(40);
    // Повторная миграция ничего не меняет.
    expect(migrateCareer(s)).toBe(s);
  });

  it('вечер: смена и опыт тем, кто вышел; заболевшему — неявка; выходной — ни то ни другое', () => {
    const s = at({ plan: { day: 40, sick: 'cleaner' } as StoreState['plan'], staff: [member('cashier2'), member('cleaner', { name: 2 }), member('loader', { offDay: 40 })] });
    const n = careerNight(s, { cashier2: 40 });
    const [cash, clean, load] = n.staff.map((m) => m.career!);
    expect(cash).toMatchObject({ xp: 1, shifts: 1, work: 10 });
    expect(clean).toMatchObject({ xp: 0, miss: 1 });
    expect(load.shifts).toBeUndefined();
    expect(n.career?.since).toBe(40);
  });

  it('старший на смене учит остальных: им опыта больше', () => {
    const s = at({ staff: [member('cashier2', { career: career({ rank: 'senior' }) }), member('cleaner')] });
    const n = careerNight(s);
    expect(n.staff[0].career!.xp).toBe(1);
    expect(n.staff[1].career!.xp).toBe(1.25);
  });

  it('звание ускоряет работу, администратор на смене — весь зал', () => {
    const plain = member('cashier2');
    expect(workSpeed(member('cashier2', { career: career({ rank: 'senior' }) }))).toBeGreaterThan(workSpeed(plain));
    expect(workSpeed(member('cashier2', { career: career({ rank: 'admin' }) }))).toBeGreaterThan(workSpeed(member('cashier2', { career: career({ rank: 'senior' }) })));
    expect(managerBoost(at())).toBe(1);
    expect(managerBoost(at({ staff: [member('cashier2', { career: career({ rank: 'admin' }) })] }))).toBeGreaterThan(1);
  });

  it('раз в четыре недели — «сотрудник месяца»: лучший по делу, имя на доске, срок с нуля', () => {
    const staff = [
      member('cashier2', { career: career({ shifts: 20, work: 300, miss: 0 }) }),
      member('cleaner', { name: 2, career: career({ shifts: 26, work: 400, miss: 1 }) }),
      member('loader', { name: 4, career: career({ shifts: 3, work: 60 }) }),
    ];
    const early = careerMorning(at({ staff, career: { since: 40 - BEST_EVERY + 1 } }));
    expect(early.career?.ceremony).toBeUndefined();
    const s = careerMorning(at({ staff, career: { since: 40 - BEST_EVERY } }));
    expect(s.career?.ceremony).toMatchObject({ role: 'cleaner', shifts: 26, miss: 1 });
    expect(s.career?.plaques).toEqual([{ name: 2, role: 'cleaner', day: 40 }]);
    expect(s.career?.since).toBe(40);
    const crowned = s.staff.find((m) => m.role === 'cleaner')!.career!;
    expect(crowned.best).toBe(1);
    expect(crowned.log?.at(-1)).toEqual({ day: 40, kind: 'best' });
    expect(s.staff.every((m) => !m.career?.shifts)).toBe(true);
    // Не больше одного события в день.
    expect(s.career?.offer).toBeUndefined();
  });

  it('на доске почёта — последние несколько имён', () => {
    let s = at({ staff: [member('cashier2')], career: { plaques: Array.from({ length: PLAQUES }, (_, i) => ({ name: 5, role: 'cashier2' as const, day: i })) } });
    s = { ...s, staff: [member('cashier2', { career: career({ shifts: 10 }) })], career: { ...s.career, since: 0 } };
    const next = careerMorning(s);
    expect(next.career?.plaques).toHaveLength(PLAQUES);
    expect(next.career?.plaques?.at(-1)?.day).toBe(40);
  });

  it('награды: премия стоит денег, выходной бесплатный, подарок дешевле; все воодушевляют', () => {
    const s = at({ career: { ceremony: { role: 'cashier2', day: 40, shifts: 20, work: 100, miss: 0 } } });
    const cash = answerCeremony(s, 'cash')!;
    expect(cash.money).toBe(5000 - bestBonus(s));
    expect(cash.staff[0].inspired).toBeGreaterThan(0);
    expect(cash.career?.ceremony).toBeUndefined();
    const off = answerCeremony(s, 'off')!;
    expect(off.money).toBe(5000);
    expect(off.staff[0]).toMatchObject({ offDay: 41, streak: 0 });
    expect(answerCeremony(s, 'gift')!.money).toBe(5000 - bestGift(s));
    expect(bestGift(s)).toBeLessThan(bestBonus(s));
    expect(answerCeremony({ ...s, money: 10 }, 'cash')).toBeNull();
    // Ушёл, пока ждали, — церемония просто закрывается.
    expect(answerCeremony({ ...s, staff: [] }, 'cash')!.money).toBe(5000);
  });

  it('повышение: по опыту, с прибавкой; отказ — спросит позже, без обиды', () => {
    const ready = at({ staff: [member('cashier2', { career: career({ xp: XP_SENIOR }) })] });
    const s = careerMorning(ready);
    expect(s.career?.offer).toEqual({ role: 'cashier2', to: 'senior', day: 40 });
    const yes = answerOffer(s, true);
    expect(yes.staff[0].career?.rank).toBe('senior');
    expect(yes.staff[0].wage).toBe(promotedWage(ready.staff[0]));
    expect(yes.staff[0].wage).toBeGreaterThan(400);
    expect(yes.staff[0].career?.log?.at(-1)).toEqual({ day: 40, kind: 'senior' });
    const no = answerOffer(s, false);
    expect(no.staff[0].upset).toBeFalsy();
    expect(no.staff[0].career?.askAfter).toBe(40 + ASK_AGAIN);
    expect(careerMorning({ ...no, day: 41 }).career?.offer).toBeUndefined();
    // Не ответили утром — предложение снимается, спросит через неделю.
    const ignored = careerMorning({ ...s, day: 41 });
    expect(ignored.career?.offer).toBeUndefined();
    expect(ignored.staff[0].career?.askAfter).toBe(41 + NO_ANSWER_AGAIN);
  });

  it('администратор зала — только из старших кассиров', () => {
    const cashier = at({ staff: [member('cashier2', { career: career({ xp: XP_ADMIN, rank: 'senior' }) })] });
    expect(careerMorning(cashier).career?.offer?.to).toBe('admin');
    const cleaner = at({ staff: [member('cleaner', { career: career({ xp: XP_ADMIN, rank: 'senior' }) })] });
    expect(careerMorning(cleaner).career?.offer).toBeUndefined();
  });

  it('с утра уже есть история с персоналом — карьера ждёт', () => {
    const s = at({ staff: [member('cashier2', { career: career({ xp: XP_SENIOR }) }), member('cleaner')], staffEvent: { kind: 'idea', roles: ['cleaner'], day: 40 } });
    expect(careerMorning(s).career?.offer).toBeUndefined();
  });

  it('свой управляющий филиала: уходит из зала, доход филиала растёт', () => {
    const s = at({
      level: 4,
      branch: { since: 10, tiers: {} },
      history: Array(7).fill(10000),
      staff: [member('cleaner', { career: career({ xp: XP_BRANCH, rank: 'senior' }) }), member('loader', { name: 4 })],
    });
    const offered = careerMorning(s);
    expect(offered.career?.offer).toMatchObject({ role: 'cleaner', to: 'branch' });
    const before = branchUsual(offered);
    const yes = answerOffer(offered, true);
    expect(yes.staff.map((m) => m.role)).toEqual(['loader']);
    expect(yes.career?.head).toMatchObject({ name: 1, since: 40 });
    expect(branchUsual(yes)).toBe(Math.round(before * (1 + BRANCH_HEAD_BONUS)));
    // Управляющий уже есть — больше не спрашивают.
    expect(promotionAgain(yes)).toBeUndefined();
  });

  it('давний сотрудник иногда уходит по своим делам: записка и прощальное письмо', () => {
    const veteran = member('cashier2', { career: career({ xp: LEAVE_XP }) });
    let left: StoreState | null = null;
    for (let day = 40; day < 4000 && !left; day++) {
      const s = careerMorning(at({ day, staff: [veteran], career: { since: day, asked: 0 } }));
      if (s.career?.left) left = s;
    }
    expect(left).not.toBeNull();
    expect(left!.staff).toHaveLength(0);
    expect(left!.career?.left).toMatchObject({ name: 1, role: 'cashier2', days: LEAVE_XP });
    expect(dismissLeft(left!).career?.left).toBeUndefined();
    // Вечером письмо уходит в почту, назавтра приходит — от него.
    const planned = planLetter(left!, '2026-11-01', () => 0.5);
    expect(planned.ret?.letter).toMatchObject({ from: 'staff', farewell: { name: 1 } });
    expect(planned.career?.letter).toBeUndefined();
    expect(letterGroup('staff')).toBe('staff');
    expect(takeLetter(planned, '2026-11-02')?.gift.letter.from).toBe('staff');
    // Друзья и недавние «сотрудники месяца» не уходят.
    const friend = member('cashier2', { friend: { id: 1, name: 'Петя' }, career: career({ xp: LEAVE_XP }) });
    const star = member('cashier2', { career: career({ xp: LEAVE_XP, log: [{ day: 39, kind: 'best' }] }) });
    for (let day = 40; day < 2000; day++) expect(careerMorning(at({ day, staff: [friend], career: { since: day } })).career?.left).toBeUndefined();
    for (let day = 40; day < 39 + LOYAL_DAYS; day++) expect(careerMorning(at({ day, staff: [star], career: { since: day } })).career?.left).toBeUndefined();
  });

  it('уволили — его повышение и церемония снимаются', () => {
    const s = at({ career: { offer: { role: 'cashier2', to: 'senior', day: 40 }, ceremony: { role: 'cleaner', day: 40, shifts: 9, work: 0, miss: 0 } } });
    expect(fire(s, 'cashier2').career?.offer).toBeUndefined();
    expect(fire(s, 'cashier2').career?.ceremony).toBeDefined();
    expect(fire(s, 'cleaner').career?.ceremony).toBeUndefined();
  });

  it('смена дня целиком: опыт растёт, оценка старых сотрудников — без летописи', () => {
    const old = at({ staff: [{ role: 'cashier2', name: 0, skill: 1, wage: 400, months: 3 }] });
    expect(careerOf(old.staff[0], 40).xp).toBe(Math.round(21 * 0.85));
    const next = nightCycle(old, { ...emptyStats(), work: { cashier2: 30 } }, () => 0.5).state;
    expect(next.staff[0].career?.xp).toBe(Math.round(21 * 0.85) + 1);
  });
});

const promotionAgain = (s: StoreState) => careerMorning({ ...s, day: s.day + 30 }).career?.offer;

function emptyStats() {
  return { revenue: 0, served: 0, lost: 0, complaints: 0, spoiled: 0, stolen: 0, caught: 0, skimmed: 0, sold: {}, trashCleaned: 0, bestCombo: 0 };
}
