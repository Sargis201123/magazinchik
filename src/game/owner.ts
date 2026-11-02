// Хозяин растёт вместе с магазином: опыт — за каждого покупателя, которого обслужил магазин,
// с новым уровнем — очко навыка. Навыков четыре, у каждого три ступени:
// ловкие руки (быстрее пробиваешь), торгаш (легче сбить цену), силач (больше носишь со склада)
// и зоркий глаз (воры обходят магазин стороной). «Обаяние» (в очереди ждут дольше) убрано 02.11 —
// одно из шести «терпений очереди», что почти ничего не меняли; вложенные в него очки снова свободны.
// TODO(nx-staffcalm): при слиянии с автоматическим уровнем хозяина — проверить, что «обаяние» не вернулось.

import type { TextKey } from '../i18n/ru';
import { ownerScan, type ScanTiming, type StoreState } from './economy';

export type SkillId = 'hands' | 'haggle' | 'strong' | 'eye';

export const SKILLS: Record<SkillId, { icon: string; nameKey: TextKey; descKey: TextKey }> = {
  hands: { icon: '✋', nameKey: 'skill.hands', descKey: 'skill.hands.desc' },
  haggle: { icon: '🤝', nameKey: 'skill.haggle', descKey: 'skill.haggle.desc' },
  strong: { icon: '💪', nameKey: 'skill.strong', descKey: 'skill.strong.desc' },
  eye: { icon: '👁', nameKey: 'skill.eye', descKey: 'skill.eye.desc' },
};
export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];
export const SKILL_MAX = 3;

/** Сколько покупателей (за всю игру) нужно для каждого уровня хозяина. 12 очков = все навыки, лишние копятся. */
export const XP_LEVELS = [0, 40, 100, 180, 280, 400, 550, 750, 1000, 1300, 1700, 2200, 2800, 3500, 4300, 5200];

/** Опыт хозяина — все обслуженные магазином покупатели. */
export const ownerXp = (state: StoreState): number => state.lifetime?.served ?? 0;
export const ownerLevelOf = (state: StoreState): number => XP_LEVELS.filter((n) => ownerXp(state) >= n).length;
/** Сколько покупателей до следующего уровня (null — максимум). */
export const nextLevelXp = (state: StoreState): number | null => XP_LEVELS[ownerLevelOf(state)] ?? null;

export const skillLevel = (state: StoreState, id: SkillId): number => Math.min(SKILL_MAX, state.skills?.[id] ?? 0);
const spent = (state: StoreState): number => SKILL_IDS.reduce((sum, id) => sum + skillLevel(state, id), 0);
/** Свободные очки навыков. */
// Не больше, чем ещё можно вложить: уровней хозяина (15 очков) больше, чем ступеней у четырёх навыков (12).
export const skillPoints = (state: StoreState): number => Math.max(0, Math.min(ownerLevelOf(state) - 1, SKILL_IDS.length * SKILL_MAX) - spent(state));

export function learnSkill(state: StoreState, id: SkillId): StoreState | null {
  if (skillPoints(state) <= 0 || skillLevel(state, id) >= SKILL_MAX) return null;
  return { ...state, skills: { ...state.skills, [id]: skillLevel(state, id) + 1 } };
}

// ---------- Что дают навыки ----------

/** Ловкие руки: −10% времени пробивки за ступень. */
export const handsFactor = (state: StoreState): number => 1 - 0.1 * skillLevel(state, 'hands');
/** Время пробивки у хозяина: опыт кассы (ownerScan) и ловкие руки. */
export function ownerTiming(state: StoreState): ScanTiming {
  const base = ownerScan(state.ownerServed);
  const k = handsFactor(state);
  return { item: base.item * k, pay: base.pay * k };
}
/** Торгаш: +6% к шансу сбить цену за ступень. */
export const haggleBonus = (state: StoreState): number => 0.06 * skillLevel(state, 'haggle');
/** Силач: +2 штуки за ходку со склада за ступень. */
export const carryBonus = (state: StoreState): number => 2 * skillLevel(state, 'strong');
/** Зоркий глаз: воров на 10% меньше за ступень. */
export const eyeTheft = (state: StoreState): number => 1 - 0.1 * skillLevel(state, 'eye');
