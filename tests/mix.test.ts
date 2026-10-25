import { describe, expect, it } from 'vitest';
import { audibleAgain, BUDGET, DEFAULT_VOLUMES, inaudible, jitter, parseVolumes, pickVariant, silenceMask, sliderGain, SoundBudget, VoiceLimiter, worldPan, type VoiceRule } from '../src/platform/mix';
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

  it('«без звука» — и когда на нуле все каналы (старые оба выключателя); «включить» возвращает их', () => {
    const legacy = parseVolumes(null, '1', '1');
    expect(inaudible(legacy, false)).toBe(true);
    expect(inaudible(DEFAULT_VOLUMES, false)).toBe(false);
    expect(inaudible(DEFAULT_VOLUMES, true)).toBe(true);
    expect(inaudible({ ...DEFAULT_VOLUMES, master: 0 }, false)).toBe(true);
    // Выключена часть каналов — остальное слышно, это не «без звука».
    expect(inaudible(parseVolumes(null, '1', null), false)).toBe(false);
    expect(audibleAgain(legacy)).toEqual(DEFAULT_VOLUMES);
    // Свои ползунки игрока не трогаем: только общую с нуля.
    const mine = { ...DEFAULT_VOLUMES, master: 0, music: 0.3, effects: 0 };
    expect(audibleAgain(mine)).toEqual({ ...mine, master: DEFAULT_VOLUMES.master });
    expect(audibleAgain(DEFAULT_VOLUMES)).toEqual(DEFAULT_VOLUMES);
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

describe('бюджет звука', () => {
  const WORLD: VoiceRule = { gap: 0.3, max: 1 };
  const DOOR: VoiceRule = { gap: 4, max: 1, tier: 'ambience' };
  const TILL: VoiceRule = { gap: 0.25, max: 2, tier: 'feedback' };

  /** Поток одинаковых событий игры: count штук через step игровых секунд на скорости pace — сколько прозвучало. */
  const stream = (b: SoundBudget, key: string, rule: VoiceRule, count: number, step: number, pace: number, from = 0): number => {
    b.pace = pace;
    let played = 0;
    for (let i = 0; i < count; i++) if (b.admit(key, rule, from + (i * step) / pace, 0.1)) played++;
    return played;
  };

  it('на ×2 события мира звучат не чаще, чем на ×1, за настоящую секунду', () => {
    for (const step of [0.2, 0.5, 1, 3]) {
      const x1 = stream(new SoundBudget(12), 'scan', WORLD, 60, step, 1);
      const x2 = stream(new SoundBudget(12), 'scan', WORLD, 60, step, 2);
      // Тот же отрезок дня на ×2 длится вдвое меньше настоящих секунд — звуков за него вдвое меньше.
      expect(x2 / ((60 * step) / 2)).toBeLessThanOrEqual(x1 / (60 * step) + 1e-9);
      expect(x2).toBeGreaterThan(0);
    }
  });

  it('колокольчик двери: на ×1 — не чаще раза в 4 с, на ×2 — в 8 с', () => {
    // Покупатели входят каждую секунду игры, 40 секунд.
    expect(stream(new SoundBudget(12), 'chime', DOOR, 40, 1, 1)).toBe(10);
    expect(stream(new SoundBudget(12), 'chime', DOOR, 40, 1, 2)).toBeLessThanOrEqual(3);
  });

  it('отклик на ×2: редкий звучит всегда, частый по событию игры — через раз, на касание игрока — всегда', () => {
    // Вор пойман раз в 20 игровых секунд — каждый раз.
    expect(stream(new SoundBudget(12), 'good', TILL, 10, 20, 2)).toBe(10);
    // Хлеб из печи каждые 2 игровые секунды: на ×2 — половина, за настоящую секунду как на ×1.
    expect(stream(new SoundBudget(12), 'bread', TILL, 20, 2, 2)).toBe(10);
    // Касса хозяина — ответ на касание (game: false): каждая продажа.
    const b = new SoundBudget(12);
    expect(stream(b, 'till', { ...TILL, game: false }, 10, 2, 2)).toBe(10);
    const tap: VoiceRule = { gap: 0.04, max: 2, tier: 'feedback', game: false };
    b.pace = 2;
    expect(b.admit('tap', tap, 100, 0.05)).toBe(1);
    expect(b.admit('tap', tap, 100.05, 0.05)).toBe(1);
  });

  it('людно: окружение уступает первым, события мира — следом, отклик и сюжет звучат всегда', () => {
    const b = new SoundBudget(32);
    for (let i = 0; i < BUDGET.busy.ambience; i++) expect(b.admit(`coin${i}`, TILL, 10 + i * 0.01, 0.1)).toBe(1);
    expect(b.admit('chime', DOOR, 10.1, 0.5)).toBe(0);
    expect(b.admit('scan', WORLD, 10.1, 0.1)).toBe(1);
    for (let i = 0; i < 5; i++) b.admit(`till${i}`, TILL, 10.2, 0.1);
    expect(b.admit('meow', WORLD, 10.3, 0.3)).toBe(0);
    expect(b.admit('coin', TILL, 10.3, 0.1)).toBe(1);
    expect(b.admit('voice', { gap: 0, max: 9, tier: 'story', game: false }, 10.3, 0.1)).toBe(1);
    // Через окно «людности» — снова можно.
    expect(b.admit('chime', DOOR, 10.3 + BUDGET.window, 0.5)).toBe(1);
  });

  it('мелочь (шаги) не делает зал «людным»', () => {
    const b = new SoundBudget(32);
    for (let i = 0; i < 20; i++) b.admit('step', { gap: 0, max: 9, low: true }, 5 + i * 0.05, 0.05);
    expect(b.admit('chime', DOOR, 6, 0.5)).toBe(1);
  });

  it('игрок занят (касание, диалог): события мира тише, окружение молчит, отклик — как есть', () => {
    const b = new SoundBudget(12);
    b.calm(20);
    expect(b.admit('chime', DOOR, 20.5, 0.5)).toBe(0);
    expect(b.admit('scan', WORLD, 20.5, 0.1)).toBeCloseTo(BUDGET.calmGain, 6);
    expect(b.admit('till', TILL, 20.5, 0.1)).toBe(1);
    // Прошло — снова обычная громкость.
    expect(b.admit('scan', WORLD, 20 + BUDGET.calm + 0.5, 0.1)).toBe(1);
    expect(b.admit('chime', DOOR, 20 + BUDGET.calm + 2, 0.5)).toBe(1);
  });

  it('у каждого канала свой запас: мир не займёт место кнопок', () => {
    const b = new SoundBudget(64);
    const free: VoiceRule = { gap: 0, max: 99, tier: 'feedback' };
    let world = 0;
    for (let i = 0; i < 20; i++) if (b.admit(`w${i}`, free, 30, 2, 'world')) world++;
    expect(world).toBe(BUDGET.voices.world);
    expect(b.admit('tap', free, 30, 0.1, 'ui')).toBe(1);
    // Отзвучали — место снова есть; на слабом телефоне запас вдвое меньше.
    expect(b.admit('w99', free, 33, 2, 'world')).toBe(1);
    const lite = new SoundBudget(64, 0.5);
    let few = 0;
    for (let i = 0; i < 20; i++) if (lite.admit(`w${i}`, free, 0, 2, 'world')) few++;
    expect(few).toBe(BUDGET.voices.world / 2);
  });

  it('звук по часам атмосферы (птицы) на ×2 не прореживается', () => {
    const bird: VoiceRule = { gap: 2, max: 1, tier: 'ambience', game: false };
    const b = new SoundBudget(12);
    b.pace = 2;
    let played = 0;
    for (let t = 0; t < 60; t += 5) if (b.admit('bird', bird, t, 1)) played++;
    expect(played).toBe(12);
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
