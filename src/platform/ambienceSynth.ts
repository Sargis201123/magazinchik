// Синтез фоновых звуков «в буфер»: дождь из тысяч отдельных капель, бурый шум для ветра и грома,
// отзвук комнаты для зала.
// Чистые функции (частота дискретизации и генератор случайных чисел — снаружи): их можно
// проверить тестами и отрисовать в файл, не открывая браузер.

export interface Stereo {
  left: Float32Array;
  right: Float32Array;
}

/**
 * Розовый шум (фильтр Пола Келлета): мягче белого, как далёкий шум воды. Длина n; последние
 * fade отсчётов подмешаны в начало, чтобы петля шла без щелчка на стыке.
 */
export function pinkNoise(n: number, random: () => number, fade = 0): Float32Array {
  const out = new Float32Array(n);
  const total = n + fade;
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  const tail = new Float32Array(fade);
  for (let i = 0; i < total; i++) {
    const white = random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
    if (i < n) out[i] = pink;
    else tail[i - n] = pink;
  }
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    out[i] = out[i] * t + tail[i] * (1 - t);
  }
  return out;
}

/** Бурый шум: низкий, «ватный» — основа ветра и раскатов грома. */
export function brownNoise(n: number, random: () => number, fade = 0): Float32Array {
  const out = new Float32Array(n);
  const tail = new Float32Array(fade);
  let last = 0;
  for (let i = 0; i < n + fade; i++) {
    last = (last + 0.02 * (random() * 2 - 1)) / 1.02;
    const v = last * 3.5;
    if (i < n) out[i] = v;
    else tail[i - n] = v;
  }
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    out[i] = out[i] * t + tail[i] * (1 - t);
  }
  return out;
}

export interface RainOptions {
  /** Капель в секунду: моросит ~60, дождь ~180, ливень ~500. */
  drops: number;
  /** Громкость ровного шума воды под каплями (0…1). */
  wash: number;
  /** Доля крупных капель с «бульком» (пузырёк в луже звенит вверх). */
  plops: number;
}

/**
 * Петля дождя: ровный шум воды и отдельные капли — у каждой своя сила, длина, сторона
 * (слева/справа) и «звонкость». Капли у конца петли переносятся в начало — стык не слышен.
 */
export function rainTexture(sampleRate: number, seconds: number, o: RainOptions, random: () => number): Stereo {
  const n = Math.floor(sampleRate * seconds);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  const fade = Math.floor(sampleRate * 0.08);
  const washL = pinkNoise(n, random, fade);
  const washR = pinkNoise(n, random, fade);
  for (let i = 0; i < n; i++) {
    left[i] = washL[i] * o.wash;
    right[i] = washR[i] * o.wash;
  }
  const count = Math.round(o.drops * seconds);
  for (let d = 0; d < count; d++) {
    const start = Math.floor(random() * n);
    // Мелких капель много, крупных мало.
    const amp = 0.08 + 0.6 * random() ** 3;
    const pan = random();
    const gl = Math.cos((pan * Math.PI) / 2);
    const gr = Math.sin((pan * Math.PI) / 2);
    // Удар капли: щелчок из «высокого» шума (разность соседних отсчётов), быстро затухает.
    const decay = sampleRate * (0.0015 + 0.006 * random());
    const len = Math.floor(decay * 6);
    let prev = 0;
    // Тон удара: по листу, по асфальту, по жести — сглаживаем шум по-разному.
    const smooth = 0.15 + 0.6 * random();
    for (let k = 0; k < len; k++) {
      const white = random() * 2 - 1;
      const hp = white - prev;
      prev = prev + smooth * (white - prev);
      const s = hp * amp * Math.exp(-k / decay);
      const idx = (start + k) % n;
      left[idx] += s * gl;
      right[idx] += s * gr;
    }
    // Иногда — «бульк»: пузырёк в луже, короткий тон, уходящий вверх.
    if (random() < o.plops) {
      const f0 = 900 + 2600 * random();
      const plen = Math.floor(sampleRate * (0.02 + 0.03 * random()));
      let phase = 0;
      for (let k = 0; k < plen; k++) {
        const t = k / plen;
        phase += (2 * Math.PI * f0 * (1 + 0.9 * t)) / sampleRate;
        const s = Math.sin(phase) * amp * 0.45 * (1 - t) ** 2;
        const idx = (start + len + k) % n;
        left[idx] += s * gl;
        right[idx] += s * gr;
      }
    }
  }
  normalize([left, right], 0.9);
  return { left, right };
}

function normalize(channels: Float32Array[], peak: number): void {
  let max = 0;
  for (const ch of channels) for (const v of ch) max = Math.max(max, Math.abs(v));
  if (!max) return;
  const k = peak / max;
  for (const ch of channels) for (let i = 0; i < ch.length; i++) ch[i] *= k;
}

/** Генератор случайных чисел с зерном (mulberry32) — чтобы буферы и тесты были повторяемыми. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Отзвук комнаты для свёртки (ConvolverNode): пара ранних отражений от стен и витрин, потом шум,
 * который затихает на 60 дБ за seconds. Верха гаснут быстрее низов — как в зале, заставленном
 * полками и товаром, а не в пустой плиточной ванной. Энергия каждого канала — 1: громкость
 * отзвука задаёт только посыл на него.
 */
export function roomImpulse(sampleRate: number, seconds: number, random: () => number): Stereo {
  const n = Math.max(1, Math.floor(sampleRate * seconds));
  const channels = [new Float32Array(n), new Float32Array(n)];
  // Первые отражения: у левого и правого уха — от разных стен, чуть в разное время.
  const early = [
    [0.011, 0.5],
    [0.019, 0.35],
    [0.027, 0.25],
    [0.041, 0.18],
  ];
  channels.forEach((ch, side) => {
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sampleRate;
      // Хвост начинается не сразу, а через ~10 мс, и мягко нарастает за 15 мс.
      const onset = Math.min(1, Math.max(0, (t - 0.01) / 0.015));
      const env = Math.exp((-6.9 * t) / seconds) * onset;
      const k = 0.85 - 0.7 * (i / n);
      lp += k * (random() * 2 - 1 - lp);
      ch[i] = lp * env * 0.6;
    }
    for (const [at, amp] of early) {
      const idx = Math.floor((at + side * 0.0035) * sampleRate);
      if (idx < n) ch[idx] += (side ? -amp : amp) * (random() < 0.5 ? 1 : -1);
    }
    let energy = 0;
    for (const v of ch) energy += v * v;
    const k = energy > 0 ? 1 / Math.sqrt(energy) : 0;
    for (let i = 0; i < n; i++) ch[i] *= k;
  });
  return { left: channels[0], right: channels[1] };
}
