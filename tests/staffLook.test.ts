import { describe, expect, it } from 'vitest';
import { HAIR_TONES, SKIN_TONES, STAFF_FACES, staffFaceIndex, staffLook, UNIFORMS } from '../src/game/staffLook';

// Портреты в public/assets — как их видит сборка (без node:fs).
const files = Object.keys(import.meta.glob('../public/assets/portrait_staff*.png')).map((f) => f.replace('../public/assets/', '').replace(/\.png$/, ''));

describe('внешность сотрудника: один человек — одно лицо', () => {
  it('у каждого номера имени есть нарисованный портрет', () => {
    for (let name = 0; name < 40; name++) expect(files).toContain(`portrait_staff${staffFaceIndex(name)}`);
    expect(files).toHaveLength(STAFF_FACES);
    expect(staffFaceIndex(-1)).toBe(STAFF_FACES - 1);
  });

  it('в зале — одно и то же каждый день: кожа и волосы зависят только от человека, форма — от должности', () => {
    const a = staffLook({ name: 3, role: 'loader' });
    expect(staffLook({ name: 3, role: 'loader' })).toEqual(a);
    // Тот же человек в другой должности — то же лицо, другая форма.
    const b = staffLook({ name: 3, role: 'cleaner' });
    expect(b.skin).toBe(a.skin);
    expect(b.hair).toBe(a.hair);
    expect(b.shirt).toBe(UNIFORMS.cleaner);
    expect(a.shirt).toBe(UNIFORMS.loader);
    // Имя с тем же портретом (через восемь) — те же кожа и волосы.
    expect(staffLook({ name: 3 + STAFF_FACES, role: 'loader' })).toEqual(a);
  });

  it('цвета — из тех же наборов, что у покупателей; у охранника кепка в цвет формы, у пекаря белый колпак', () => {
    for (let name = 0; name < STAFF_FACES; name++) {
      const look = staffLook({ name, role: 'cashier' });
      expect(SKIN_TONES).toContain(look.skin);
      expect(HAIR_TONES).toContain(look.hair);
    }
    expect(staffLook({ name: 2, role: 'guard' }).hair).toBe(UNIFORMS.guard);
    expect(staffLook({ name: 2, role: 'baker' }).hair).toBe(0xffffff);
  });
});
