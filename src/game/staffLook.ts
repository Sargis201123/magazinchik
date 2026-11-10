// Внешность сотрудника: форма по должности и лицо — своё у каждого человека. До 10.11 цвет кожи и волос
// выбирался случайно каждый раз, когда персонал выходил в зал: один и тот же Тимур сегодня был одним, завтра
// другим, а в карточке найма и в списке персонала лица не было вовсе — хотя восемь портретов сотрудников
// давно нарисованы (art/career.py, portrait_staff0…7) и показывались только в письмах и на церемониях.
// Теперь портрет стоит везде, где есть имя, а фигурка в зале носит те же кожу и волосы, что на портрете.
// Только данные и счёт, без Phaser: модуль читают и сцена (scenes/staff.ts), и окна (ui/).

import type { StaffRole } from './economy';

/** Причёска, как у слоёв фигурки (p_hair_<стиль>). */
export type StaffHair = 'short' | 'long' | 'bun' | 'cap' | 'bald' | 'ponytail' | 'curly' | 'beanie';
/** Деталь формы (слой acc_<деталь>). */
export type StaffAcc = 'apron' | 'vest' | 'badge' | 'tie';

/** Тон кожи и цвет волос — те же наборы, что у покупателей (scenes/common.ts берёт их отсюда). */
export const SKIN_TONES: readonly number[] = [0xf2d3ab, 0xd9a066, 0x8f563b, 0xeec39a];
export const HAIR_TONES: readonly number[] = [0x4a2c1a, 0x181425, 0x733e39, 0xfeae34, 0xb86f50, 0x8b9bb4];

/** Форма сотрудников: цвет рубашки. */
export const UNIFORMS: Record<StaffRole, number> = { cashier: 0x5fcde4, cashier2: 0x5fcde4, cashier3: 0x5fcde4, cashier4: 0x5fcde4, cashier5: 0x5fcde4, cleaner: 0xfbf236, loader: 0xdf7126, guard: 0x306082, manager: 0xf4f4f4, baker: 0xf4f4f4, barista: 0x3e8948, cook: 0xf4f4f4 };
/** Причёска (у охранника — форменная кепка, у пекаря — колпак). */
export const STAFF_HAIR: Record<StaffRole, StaffHair> = { cashier: 'long', cashier2: 'ponytail', cashier3: 'bun', cashier4: 'short', cashier5: 'curly', cleaner: 'short', loader: 'short', guard: 'cap', manager: 'short', baker: 'cap', barista: 'ponytail', cook: 'short' };
/** Деталь формы поверх рубашки. */
export const STAFF_ACC: Record<StaffRole, { acc: StaffAcc; tint: number }> = {
  cashier: { acc: 'apron', tint: 0xffffff },
  cashier2: { acc: 'apron', tint: 0xffffff },
  cashier3: { acc: 'apron', tint: 0xffffff },
  cashier4: { acc: 'apron', tint: 0xffffff },
  cashier5: { acc: 'apron', tint: 0xffffff },
  cleaner: { acc: 'apron', tint: 0x5fcde4 },
  loader: { acc: 'vest', tint: 0xffffff },
  guard: { acc: 'badge', tint: 0xffffff },
  manager: { acc: 'tie', tint: 0xffffff },
  baker: { acc: 'apron', tint: 0xffffff },
  barista: { acc: 'apron', tint: 0x8f563b },
  cook: { acc: 'apron', tint: 0xffffff },
};

/** Сколько нарисовано портретов сотрудников (art/career.py): чётные — мужские, нечётные — женские, как в списке имён. */
export const STAFF_FACES = 8;
/** Номер портрета по номеру имени. */
export const staffFaceIndex = (name: number): number => ((name % STAFF_FACES) + STAFF_FACES) % STAFF_FACES;

/** Кожа и волосы каждого из портретов — чтобы фигурка в зале была тем же человеком, что и в окне. */
const FACE_TONES: readonly { skin: number; hair: number }[] = [
  { skin: 0xf2d3ab, hair: 0x4a2c1a },
  { skin: 0xf2d3ab, hair: 0x733e39 },
  { skin: 0xd9a066, hair: 0x181425 },
  { skin: 0xf2d3ab, hair: 0xb86f50 },
  { skin: 0xeec39a, hair: 0x8b9bb4 },
  { skin: 0xf2d3ab, hair: 0x181425 },
  { skin: 0xeec39a, hair: 0xb86f50 },
  { skin: 0xd9a066, hair: 0xfeae34 },
];

export interface StaffFace {
  skin: number;
  /** Цвет слоя причёски: волосы, а у охранника и пекаря — кепка и колпак. */
  hair: number;
  style: StaffHair;
  shirt: number;
  acc: StaffAcc;
  accTint: number;
}

/** Как выглядит сотрудник в зале: кожа и волосы — как на его портрете, форма — по должности. Одно и то же каждый день. */
export function staffLook(member: { name: number; role: StaffRole }): StaffFace {
  const tones = FACE_TONES[staffFaceIndex(member.name)];
  // У охранника вместо волос форменная кепка, у пекаря — белый колпак.
  const hair = member.role === 'guard' ? UNIFORMS.guard : member.role === 'baker' ? 0xffffff : tones.hair;
  return { skin: tones.skin, hair, style: STAFF_HAIR[member.role], shirt: UNIFORMS[member.role], acc: STAFF_ACC[member.role].acc, accTint: STAFF_ACC[member.role].tint };
}
