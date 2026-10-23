import { describe, expect, it } from 'vitest';
import { DEFAULT_VOLUMES, jitter, parseVolumes, pickVariant, silenceMask, sliderGain, VoiceLimiter, worldPan } from '../src/platform/mix';
import { roomImpulse, seeded } from '../src/platform/ambienceSynth';

// Звуковой «пульт»: громкости и их перенос со старых выключателей, сторона звука, варианты, ограничитель.

describe('громкости в настройках', () => {
  it('новый игрок — всё по умолчанию', () => {
    expect(parseVolumes(null, null, null)).toEqual(DEFAULT_VOLUMES);
  });

  it('старые выключатели переносятся: «без звука» гасит эффекты, окружение и голоса, «без музыки» — музыку', () => {
    const noSound = parseVolumes(null, '1', null);
    expect(noSound).toMatchObject({ effects: 0, ambience: 0, voices: 0, music: DEFAULT_VOLUMES.music, master: DEFAULT_VOLUMES.master });
    const noMusic = parseVolumes(null, '0', '1');
    expect(noMusic).toMatchObject({ music: 0, effects: DEFAULT_VOLUMES.effects });
  });

  it('новые настройки важнее старых выключателей; мусор и выход за 0…1 не ломают', () => {
    expect(parseVolumes(JSON.stringify({ master: 0.5, music: 1 }), '1', '1')).toEqual({ ...DEFAULT_VOLUMES, master: 0.5, music: 1 });
    expect(parseVolumes(JSON.stringify({ master: 7, music: -2, effects: 'громко', voices: null }), null, null)).toEqual({
      ...DEFAULT_VOLUMES,
      master: 1,
      music: 0,
    });
    expect(parseVolumes('{не json', null, '1')).toEqual({ ...DEFAULT_VOLUMES, music: 0 });
  });

  it('ползунок → громкость: ноль — тишина, середина ≈ −12 дБ (на слух вдвое тише), край — полная', () => {
    expect(sliderGain(0)).toBe(0);
    expect(20 * Math.log10(sliderGain(0.5))).toBeCloseTo(-12.04, 1);
    expect(sliderGain(1)).toBe(1);
    expect(sliderGain(2)).toBe(1);
  });

  it('что выключено — битами для аналитики', () => {
    expect(silenceMask(DEFAULT_VOLUMES, false)).toBe(0);
    expect(silenceMask(DEFAULT_VOLUMES, true)).toBe(1);
    expect(silenceMask({ ...DEFAULT_VOLUMES, master: 0 }, false)).toBe(1);
    expect(silenceMask({ ...DEFAULT_VOLUMES, music: 0, voices: 0 }, false)).toBe(2 | 16);
  });
});

describe('звук мира — с той стороны экрана', () => {
  it('слева — влево, справа — вправо, посередине — ровно', () => {
    expect(worldPan(100, 0, 400).pan).toBeLessThan(0);
    expect(worldPan(300, 0, 400).pan).toBeGreaterThan(0);
    expect(worldPan(200, 0, 400).pan).toBeCloseTo(0);
    // Не в одно ухо: даже у края — не до упора.
    expect(Math.abs(worldPan(0, 0, 400).pan)).toBeLessThan(1);
  });

  it('за краем экрана — тише и «не видно», но не в ноль', () => {
    const on = worldPan(200, 0, 400);
    const off = worldPan(800, 0, 400);
    const far = worldPan(5000, 0, 400);
    expect(on).toMatchObject({ gain: 1, onScreen: true });
    expect(off.onScreen).toBe(false);
    expect(off.gain).toBeLessThan(1);
    expect(far.gain).toBeGreaterThanOrEqual(0.25);
    expect(worldPan(-300, 0, 400).pan).toBeLessThan(0);
  });

  it('нет камеры или координаты — посередине и полностью', () => {
    expect(worldPan(NaN, 0, 400)).toEqual({ pan: 0, gain: 1, onScreen: true });
    expect(worldPan(10, 0, 0)).toEqual({ pan: 0, gain: 1, onScreen: true });
  });
});

describe('варианты и разброс', () => {
  it('разброс высоты и громкости — в заданных пределах', () => {
    const random = seeded(3);
    for (let i = 0; i < 200; i++) {
      const j = jitter(random, 50, 2);
      expect(Math.abs(1200 * Math.log2(j.rate))).toBeLessThanOrEqual(50 + 1e-9);
      expect(Math.abs(20 * Math.log10(j.gain))).toBeLessThanOrEqual(2 + 1e-9);
    }
  });

  it('вариант не повторяется дважды подряд, и выпадают все', () => {
    const random = seeded(9);
    const seen = new Set<number>();
    let last = -1;
    for (let i = 0; i < 300; i++) {
      const next = pickVariant(last, 4, random);
      expect(next).not.toBe(last);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThan(4);
      seen.add(next);
      last = next;
    }
    expect(seen.size).toBe(4);
    expect(pickVariant(0, 1, random)).toBe(0);
  });
});

describe('ограничитель голосов', () => {
  it('частый звук — не чаще, чем раз в паузу, и не больше max сразу', () => {
    const lim = new VoiceLimiter(12);
    const rule = { gap: 0.25, max: 2 };
    expect(lim.allow('coin', rule, 0, 1)).toBe(true);
    expect(lim.allow('coin', rule, 0.1, 1)).toBe(false);
    expect(lim.allow('coin', rule, 0.3, 1)).toBe(true);
    // Два ещё звучат — третий не влезет, даже после паузы.
    expect(lim.allow('coin', rule, 0.6, 1)).toBe(false);
    // Первый отзвучал — можно.
    expect(lim.allow('coin', rule, 1.05, 1)).toBe(true);
  });

  it('пулемёт при ×2: из 40 сканов за секунду проходит лишь несколько', () => {
    const lim = new VoiceLimiter(12);
    let played = 0;
    for (let i = 0; i < 40; i++) if (lim.allow('scan', { gap: 0.35, max: 1 }, i * 0.025, 0.1)) played++;
    expect(played).toBeLessThanOrEqual(3);
    expect(played).toBeGreaterThanOrEqual(2);
  });

  it('общий запас: мелочь уступает место, когда звуков много', () => {
    const lim = new VoiceLimiter(4);
    for (let i = 0; i < 2; i++) expect(lim.allow(`big${i}`, { gap: 0, max: 9 }, 0, 2)).toBe(true);
    // Половина запаса занята — шаги уже не проходят, а важное ещё проходит.
    expect(lim.allow('step', { gap: 0, max: 9, low: true }, 0, 1)).toBe(false);
    expect(lim.allow('bell', { gap: 0, max: 9 }, 0, 2)).toBe(true);
    expect(lim.allow('bell2', { gap: 0, max: 9 }, 0, 2)).toBe(true);
    expect(lim.allow('bell3', { gap: 0, max: 9 }, 0, 2)).toBe(false);
    // Отзвучали — снова можно.
    expect(lim.allow('step', { gap: 0, max: 9, low: true }, 3, 1)).toBe(true);
  });
});

describe('отзвук комнаты', () => {
  const RATE = 8000;
  it('повторяем, стерео разное, энергия каждого канала — 1', () => {
    const a = roomImpulse(RATE, 0.9, seeded(1));
    const b = roomImpulse(RATE, 0.9, seeded(1));
    expect(a.left).toEqual(b.left);
    expect(a.left).not.toEqual(a.right);
    for (const ch of [a.left, a.right]) {
      expect(ch.every(Number.isFinite)).toBe(true);
      expect(ch.reduce((s, v) => s + v * v, 0)).toBeCloseTo(1, 5);
    }
  });

  it('затухает: в конце в десятки раз тише, чем в начале', () => {
    const r = roomImpulse(RATE, 0.9, seeded(2));
    const n = r.left.length;
    const rms = (from: number, to: number) => Math.sqrt(r.left.slice(from, to).reduce((s, v) => s + v * v, 0) / (to - from));
    expect(rms(Math.floor(n * 0.03), Math.floor(n * 0.15))).toBeGreaterThan(rms(Math.floor(n * 0.85), n) * 30);
  });
});
