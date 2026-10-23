// Звуки синтезируются WebAudio на лету: без файлов и чужих лицензий, ничего не весят.
// Каждый звук — «предмет», а не пищалка: огибающая без щелчков, мягкий фильтр сверху, у частых —
// несколько вариантов и разброс высоты и громкости, чтобы подряд не звучали одинаково. Звуки
// мира (касса, полка, кот) слышны с той стороны экрана, где это случилось. Громкость, каналы,
// отзвук комнаты и сон в фоне — в mixer.ts.

import { brownNoise, seeded } from './ambienceSynth';
import { jitter, pickVariant, type VoiceRule } from './mix';
import { allowVoice, audioContext, busInput, duckMusic, mixer, placeAt, type Bus } from './mixer';

export { audioContext, existingAudioContext } from './mixer';

/** Контекст для звука канала bus: null — канал не слышен (без звука, ползунок на нуле). */
function audio(bus: Bus): AudioContext | null {
  return mixer.audible(bus) ? audioContext() : null;
}

/** Канал звука: с точкой в мире — звук мира (глохнет под меню), без неё — отклик интерфейса. */
const busOf = (o: Voice): Bus => o.bus ?? (o.x === undefined ? 'ui' : 'world');

interface Note {
  freq: number;
  /** Через сколько секунд от начала звука. */
  at?: number;
  dur: number;
  wave?: OscillatorType;
  vol?: number;
  /** Частота в конце ноты — скольжение вверх или вниз. */
  slide?: number;
  /** Нарастание громкости, секунды: длиннее — мягче, без «тика» в начале. */
  attack?: number;
}

interface Voice {
  /** Канал: по умолчанию с точкой x — звук мира, без неё — кнопки (busOf). */
  bus?: Bus;
  /** Точка мира по горизонтали: звук слышен с этой стороны экрана. */
  x?: number;
  /** Срез верхов, Гц: убирает «пищалку» у квадратной и пилообразной волны. */
  lp?: number;
  /** Разброс высоты (центы) и громкости (дБ) — каждый раз чуть другой. */
  cents?: number;
  db?: number;
  /** Ограничение частого звука: имя и правило. */
  limit?: [string, VoiceRule];
  /** Мелочь за краем экрана не играем вовсе. */
  skipOffscreen?: boolean;
}

/** Куда подключить звук: канал, сторона, громкость за краем. null — звук не нужен. */
function output(ac: AudioContext, o: Voice, dur: number): { out: AudioNode; rate: number } | null {
  const where = placeAt(o.x);
  if (o.skipOffscreen && !where.onScreen) return null;
  if (o.limit && !allowVoice(o.limit[0], o.limit[1], dur)) return null;
  const j = jitter(Math.random, o.cents ?? 0, o.db ?? 0);
  return { out: busInput(ac, busOf(o), where.pan, where.gain * j.gain), rate: j.rate };
}

function play(notes: Note[], o: Voice = {}): void {
  const ac = audio(busOf(o));
  if (!ac) return;
  const dur = Math.max(...notes.map((n) => (n.at ?? 0) + n.dur));
  const target = output(ac, o, dur);
  if (!target) return;
  const now = ac.currentTime + 0.01;
  // Один мягкий фильтр на весь звук.
  const tone = ac.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = o.lp ?? 4200;
  tone.Q.value = 0.5;
  tone.connect(target.out);
  for (const { freq, at = 0, dur, wave = 'triangle', vol = 0.05, slide, attack = 0.008 } of notes) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    // Ноль — ещё до начала ноты: по умолчанию усилитель открыт (1), и первый отсчёт звука,
    // попавший раньше события огибающей, проскакивал на полную громкость — резкий щелчок.
    gain.gain.value = 0;
    osc.type = wave;
    osc.frequency.setValueAtTime(freq * target.rate, now + at);
    if (slide) osc.frequency.exponentialRampToValueAtTime(slide * target.rate, now + at + dur);
    // Короткая атака и затухание — без щелчков.
    gain.gain.setValueAtTime(0, now + at);
    gain.gain.linearRampToValueAtTime(vol, now + at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + dur);
    osc.connect(gain).connect(tone);
    osc.start(now + at);
    osc.stop(now + at + dur + 0.02);
  }
}

/**
 * Звон металла и стекла: несколько негармонических призвуков, у каждого своё затухание
 * (верхние гаснут быстрее). Так звучит колокольчик или монетка, а не два синуса.
 */
interface Strike {
  freq: number;
  at?: number;
  vol: number;
  /** Сколько звенит основной тон, с. */
  ring: number;
}
const BELL = [
  [1, 1, 1],
  [2.76, 0.45, 0.55],
  [5.4, 0.22, 0.32],
  [8.93, 0.1, 0.2],
];
const COIN = [
  [1, 1, 1],
  [2.32, 0.6, 0.6],
  [3.81, 0.32, 0.4],
  [5.12, 0.15, 0.25],
];

function ring(strikes: Strike[], partials: number[][], o: Voice = {}): void {
  const ac = audio(busOf(o));
  if (!ac) return;
  const dur = Math.max(...strikes.map((s) => (s.at ?? 0) + s.ring));
  const target = output(ac, o, dur);
  if (!target) return;
  const now = ac.currentTime + 0.01;
  const tone = ac.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = o.lp ?? 7000;
  tone.connect(target.out);
  for (const s of strikes) {
    const at = now + (s.at ?? 0);
    for (const [ratio, level, decay] of partials) {
      const f = s.freq * ratio * target.rate;
      if (f > 16000) continue;
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const gain = ac.createGain();
      gain.gain.value = 0;
      const end = at + s.ring * decay;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(s.vol * level, at + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain).connect(tone);
      osc.start(at);
      osc.stop(end + 0.02);
    }
  }
}

/** Белый шум: основа грома, дождя и шагов. */
export function noiseBuffer(ac: AudioContext, seconds: number): AudioBuffer {
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** Общий кусок шума на короткие звуки (стук, шорох): берём случайное место в нём. */
let noise: AudioBuffer | null = null;
function sharedNoise(ac: AudioContext): AudioBuffer {
  if (!noise || noise.sampleRate !== ac.sampleRate) noise = noiseBuffer(ac, 2);
  return noise;
}

/** Шум через полосу с огибающей: стук, шорох, пар. Куда — out, когда — at. */
function noiseBurst(ac: AudioContext, out: AudioNode, at: number, dur: number, freq: number, q: number, vol: number, attack = 0.002): void {
  const src = ac.createBufferSource();
  const buffer = sharedNoise(ac);
  src.buffer = buffer;
  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = freq;
  band.Q.value = q;
  const gain = ac.createGain();
  gain.gain.value = 0;
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(vol, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(band).connect(gain).connect(out);
  // Случайное место в куске шума, но так, чтобы его хватило до конца звука.
  src.start(at, Math.random() * Math.max(0, buffer.duration - dur - 0.05));
  src.stop(at + dur + 0.02);
}

/**
 * Деревянный стук: щелчок шума в узкой полосе и короткий «корпус» на той же ноте — как костяшкой
 * по прилавку. Им отвечает игра, когда что-то не так, — вместо зуммера.
 */
function knock(ac: AudioContext, out: AudioNode, at: number, freq: number, vol: number): void {
  noiseBurst(ac, out, at, 0.05, freq * 2.1, 6, vol * 0.8, 0.001);
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq * 1.06, at);
  osc.frequency.exponentialRampToValueAtTime(freq, at + 0.03);
  const gain = ac.createGain();
  gain.gain.value = 0;
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(vol, at + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + 0.14);
}

/** Буфер раската грома (бурый шум) — один на всю игру. */
let rumbleBuffer: AudioBuffer | null = null;

/**
 * Гром: близкий — резкий треск и тяжёлый раскат, дальний — только глухое ворчание. Раскат
 * катится волнами (несколько подъёмов громкости) и уходит из стороны в сторону. Самый низ
 * телефон не сыграет — раскат держится в «слышимых» частотах, а не уходит в гул.
 */
function thunder(): void {
  const ac = audio('street');
  if (!ac || !allowVoice('thunder', { gap: 2.5, max: 2 }, 6)) return;
  const now = ac.currentTime + 0.01;
  const near = Math.random();
  if (!rumbleBuffer || rumbleBuffer.sampleRate !== ac.sampleRate) {
    const random = seeded(31);
    const n = Math.floor(ac.sampleRate * 6);
    rumbleBuffer = ac.createBuffer(1, n, ac.sampleRate);
    rumbleBuffer.copyToChannel(brownNoise(n, random) as Float32Array<ArrayBuffer>, 0);
  }
  const panner = ac.createStereoPanner();
  panner.pan.setValueAtTime(Math.random() * 1.2 - 0.6, now);
  panner.pan.linearRampToValueAtTime(Math.random() * 1.2 - 0.6, now + 5);
  panner.connect(busInput(ac, 'street'));
  // Треск — только у близкого грома.
  if (near > 0.45) {
    const crack = ac.createBufferSource();
    crack.buffer = sharedNoise(ac);
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1500;
    const cg = ac.createGain();
    cg.gain.value = 0;
    cg.gain.setValueAtTime(0, now);
    cg.gain.linearRampToValueAtTime(0.07 * near, now + 0.008);
    cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    crack.connect(hp).connect(cg).connect(panner);
    crack.start(now, Math.random());
    crack.stop(now + 0.4);
  }
  // Раскат: бурый шум, верха глохнут, громкость волнами.
  const src = ac.createBufferSource();
  src.buffer = rumbleBuffer;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(700 + 700 * near, now);
  lp.frequency.exponentialRampToValueAtTime(180, now + 5);
  const gain = ac.createGain();
  gain.gain.value = 0;
  const delay = (1 - near) * 0.6;
  const peak = 0.21 + 0.25 * near;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + delay + 0.12);
  let t = now + delay + 0.12;
  for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
    t += 0.35 + Math.random() * 0.6;
    gain.gain.linearRampToValueAtTime(peak * (0.35 + Math.random() * 0.5) * (1 - i * 0.12), t);
  }
  gain.gain.exponentialRampToValueAtTime(0.0001, Math.max(t + 1.2, now + 4.5));
  src.connect(lp).connect(gain).connect(panner);
  src.start(now, Math.random() * 0.5);
  src.stop(now + 6);
}

/** Шипение (пар кофемашины, противень из печи): шум через полосу, слышен оттуда, где машина. */
function hiss(seconds = 0.9, freq = 3200, vol = 0.05, x?: number): void {
  const ac = audio('world');
  if (!ac) return;
  const target = output(ac, { x, limit: ['hiss', { gap: 0.3, max: 2 }], cents: 60, db: 1.5 }, seconds);
  if (!target) return;
  const now = ac.currentTime + 0.01;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, seconds);
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq * target.rate;
  const gain = ac.createGain();
  gain.gain.value = 0;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(vol, now + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
  src.connect(filter).connect(gain).connect(target.out);
  src.start(now);
  src.stop(now + seconds);
}

/**
 * Мурчание: шорох в средних частотах, который пульсирует ~25 раз в секунду, и мягкий «моторчик»
 * под ним. Раньше гудело на 52 Гц — телефон это не играет, и кота было не слышно.
 */
function purr(x?: number): void {
  const ac = audio('world');
  if (!ac) return;
  const target = output(ac, { x, limit: ['purr', { gap: 1, max: 1 }], cents: 80, db: 1.5 }, 1.45);
  if (!target) return;
  const now = ac.currentTime + 0.01;
  const pulse = ac.createGain();
  pulse.gain.value = 0.5;
  const lfo = ac.createOscillator();
  lfo.frequency.value = 23 * target.rate;
  const depth = ac.createGain();
  depth.gain.value = 0.5;
  lfo.connect(depth).connect(pulse.gain);
  const env = ac.createGain();
  env.gain.value = 0;
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(1, now + 0.15);
  env.gain.setValueAtTime(1, now + 1);
  env.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
  pulse.connect(env).connect(target.out);
  noiseBurst(ac, pulse, now, 1.4, 380, 1.4, 0.09, 0.15);
  const motor = ac.createOscillator();
  motor.type = 'sawtooth';
  motor.frequency.value = 104 * target.rate;
  const soft = ac.createBiquadFilter();
  soft.type = 'lowpass';
  soft.frequency.value = 650;
  const mg = ac.createGain();
  mg.gain.value = 0.03;
  motor.connect(soft).connect(mg).connect(pulse);
  motor.start(now);
  lfo.start(now);
  motor.stop(now + 1.45);
  lfo.stop(now + 1.45);
}

/**
 * Подземный толчок: на телефоне гул в 30–70 Гц не слышен, поэтому толчок — это дребезг полок
 * и бутылок (шорох в средних частотах дрожит) поверх глухого удара.
 */
function rumble(): void {
  const ac = audio('world');
  if (!ac) return;
  const out = busInput(ac, 'world');
  const now = ac.currentTime + 0.01;
  // Глухой удар: низкая пила, но через фильтр — слышны её верхние призвуки, а не «подвал».
  const thud = ac.createOscillator();
  thud.type = 'sawtooth';
  thud.frequency.setValueAtTime(110, now);
  thud.frequency.exponentialRampToValueAtTime(55, now + 0.9);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 500;
  const tg = ac.createGain();
  tg.gain.value = 0;
  tg.gain.setValueAtTime(0, now);
  tg.gain.linearRampToValueAtTime(0.045, now + 0.03);
  tg.gain.exponentialRampToValueAtTime(0.0001, now + 1);
  thud.connect(lp).connect(tg).connect(out);
  thud.start(now);
  thud.stop(now + 1.05);
  // Дребезг полок: шорох, который часто вздрагивает.
  const shake = ac.createGain();
  shake.gain.value = 0.5;
  const lfo = ac.createOscillator();
  lfo.type = 'square';
  lfo.frequency.value = 13;
  const depth = ac.createGain();
  depth.gain.value = 0.5;
  lfo.connect(depth).connect(shake.gain);
  shake.connect(out);
  noiseBurst(ac, shake, now, 1.1, 650, 1.2, 0.06, 0.05);
  lfo.start(now);
  lfo.stop(now + 1.15);
  // Звякают бутылки на полках.
  for (let i = 0; i < 4; i++) {
    const at = now + 0.1 + Math.random() * 0.8;
    const f = 1800 + Math.random() * 1600;
    const osc = ac.createOscillator();
    osc.frequency.value = f;
    const g = ac.createGain();
    g.gain.value = 0;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.012, at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
    const p = ac.createStereoPanner();
    p.pan.value = Math.random() * 1.2 - 0.6;
    osc.connect(g).connect(p).connect(out);
    osc.start(at);
    osc.stop(at + 0.14);
  }
}

/** Монетка: высота из нескольких, чтобы подряд не звенела одинаково. */
const COIN_NOTES = [1319, 1397, 1568, 1480];
let lastCoin = -1;
/** Мяу: три «кошки» — обычная, повыше и пониже. */
let lastMeow = -1;
/** Стук «что-то не так»: два варианта по очереди. */
let lastBad = -1;

export const sound = {
  /** Мяу: короткое скольжение вверх и вниз. */
  meow: (x?: number) => {
    lastMeow = pickVariant(lastMeow, 3, Math.random);
    const k = [1, 1.14, 0.88][lastMeow];
    play(
      [
        { freq: 620 * k, dur: 0.12, vol: 0.04, slide: 900 * k, attack: 0.02 },
        { freq: 900 * k, at: 0.12, dur: 0.2 + 0.06 * lastMeow, vol: 0.036, slide: 520 * k },
      ],
      { x, lp: 2600, cents: 40, db: 2, limit: ['meow', { gap: 0.6, max: 1 }] },
    );
  },
  purr,
  /** Гав-гав: два коротких хриплых тявка, мягче, чем раньше (пила — через фильтр). */
  bark: (x?: number) =>
    play(
      [
        { freq: 340, dur: 0.09, wave: 'sawtooth', vol: 0.045, slide: 220 },
        { freq: 360, at: 0.17, dur: 0.1, wave: 'sawtooth', vol: 0.045, slide: 230 },
      ],
      { x, lp: 1400, cents: 60, db: 2, limit: ['bark', { gap: 0.5, max: 1 }] },
    ),
  /** Пар кофемашины и шипение печи. */
  hiss,
  /** Касание, начало дела: короткий мягкий «ток». */
  tap: () => play([{ freq: 660, dur: 0.05, vol: 0.035, slide: 540 }], { bus: 'ui', lp: 2400, cents: 50, db: 1.5, limit: ['tap', { gap: 0.04, max: 2 }] }),
  /**
   * Сканер на кассе: мягкое «пим». Слышно, но не режет: синус с октавой сверху и плавным
   * началом. Не чаще раза в 0,35 с — на большой корзине не превращается в трель.
   */
  scan: (x?: number) =>
    play(
      [
        { freq: 1175, dur: 0.09, wave: 'sine', vol: 0.03, attack: 0.006 },
        { freq: 2350, dur: 0.06, wave: 'sine', vol: 0.006, attack: 0.006 },
      ],
      { x, lp: 3500, cents: 15, db: 1.5, limit: ['scan', { gap: 0.35, max: 1 }] },
    ),
  /** Покупатель расплатился: мягкое «дзынь» монеток — два касания, высота каждый раз своя. */
  coin: (x?: number) => {
    lastCoin = pickVariant(lastCoin, COIN_NOTES.length, Math.random);
    const f = COIN_NOTES[lastCoin];
    ring(
      [
        { freq: f, vol: 0.028, ring: 0.16 },
        { freq: f * 1.335, at: 0.055 + Math.random() * 0.02, vol: 0.024, ring: 0.32 },
      ],
      COIN,
      { x, lp: 6000, cents: 20, db: 1.5, limit: ['coin', { gap: 0.25, max: 2 }] },
    );
  },
  /** Хорошо: поймали вора, задание выполнено, проверка пройдена. */
  good: () =>
    play(
      [
        { freq: 523, dur: 0.1, vol: 0.06 },
        { freq: 659, at: 0.08, dur: 0.1, vol: 0.06 },
        { freq: 784, at: 0.16, dur: 0.22, vol: 0.06 },
      ],
      { lp: 3200, cents: 10, limit: ['good', { gap: 0.15, max: 2 }] },
    ),
  /** Плохо (украли, ушёл злой, штраф): два мягких деревянных стука вниз, а не зуммер. */
  bad: () => {
    const ac = audio('ui');
    if (!ac || !allowVoice('bad', { gap: 0.3, max: 1 }, 0.4)) return;
    lastBad = pickVariant(lastBad, 2, Math.random);
    const j = jitter(Math.random, 30, 1.5);
    const out = busInput(ac, 'ui', 0, j.gain);
    const now = ac.currentTime + 0.01;
    const f = (lastBad ? 415 : 392) * j.rate;
    knock(ac, out, now, f, 0.036);
    knock(ac, out, now + 0.15, f * 0.794, 0.03);
  },
  /** Кто-то важный вошёл: колокольчик на двери — два удара, звенит и затихает. */
  bell: (x?: number) =>
    ring(
      [
        { freq: 1175, vol: 0.035, ring: 1 },
        { freq: 880, at: 0.18, vol: 0.035, ring: 1.3 },
      ],
      BELL,
      { x, cents: 12, db: 1, limit: ['bell', { gap: 0.25, max: 2 }] },
    ),
  /** Медаль достижения упала в рамку: высокий звон с отзвуком. */
  medal: () =>
    ring(
      [
        { freq: 1568, vol: 0.026, ring: 0.5 },
        { freq: 2093, at: 0.08, vol: 0.022, ring: 0.9 },
      ],
      BELL,
      { bus: 'ui', limit: ['medal', { gap: 0.2, max: 2 }] },
    ),
  /** Большое событие: редкий гость, новое звание, конец дня. Музыка на это время притихает. */
  fanfare: () => {
    if (!audio('ui')) return;
    duckMusic(1.1);
    play(
      [
        { freq: 523, dur: 0.12, wave: 'square', vol: 0.024 },
        { freq: 659, at: 0.1, dur: 0.12, wave: 'square', vol: 0.024 },
        { freq: 784, at: 0.2, dur: 0.12, wave: 'square', vol: 0.024 },
        { freq: 1047, at: 0.3, dur: 0.4, wave: 'square', vol: 0.024 },
        { freq: 523, at: 0.3, dur: 0.4, vol: 0.048 },
        { freq: 784, at: 0.3, dur: 0.45, vol: 0.028 },
      ],
      { bus: 'ui', lp: 2400, limit: ['fanfare', { gap: 0.5, max: 1 }] },
    );
  },

  /** Серия обслуживания: мягкое арпеджио только на вехах (3, 5, 10, 15…), а не на каждом покупателе. */
  combo: (n: number) => {
    if (n !== 3 && n % 5 !== 0) return;
    const base = 392 * 2 ** (Math.min(n / 5, 6) / 12);
    play(
      [
        { freq: base, dur: 0.09, wave: 'sine', vol: 0.03 },
        { freq: base * 1.26, at: 0.08, dur: 0.09, wave: 'sine', vol: 0.03 },
        { freq: base * 1.5, at: 0.16, dur: 0.24, wave: 'sine', vol: 0.028 },
      ],
      { bus: 'ui', lp: 5000, db: 1 },
    );
  },
  /** «Чпок» товара на полке; n — какой по счёту (каждый следующий чуть выше). */
  pop: (n = 0, x?: number) =>
    play([{ freq: 660 + n * 40, dur: 0.06, wave: 'sine', vol: 0.045, slide: 990 + n * 50, attack: 0.004 }], {
      x,
      cents: 35,
      db: 2,
      limit: ['pop', { gap: 0.06, max: 3, low: true }],
      skipOffscreen: true,
    }),
  /** «Голос» героя в диалоге: короткий слог на его высоте, мягкий, каждый раз чуть другой. */
  voice: (pitch: number) =>
    play([{ freq: pitch * (0.9 + Math.random() * 0.25), dur: 0.05, wave: 'square', vol: 0.03, attack: 0.006 }], {
      bus: 'voice',
      lp: 1500 + Math.random() * 500,
      db: 1.5,
      limit: ['voice', { gap: 0.045, max: 2 }],
    }),
  /** Раскат грома в грозу. */
  thunder,
  /** Позывные новостей: три сигнала вверх; музыка уступает им место. */
  news: () => {
    if (!audio('ui')) return;
    duckMusic(0.9);
    play(
      [
        { freq: 784, dur: 0.12, wave: 'square', vol: 0.025 },
        { freq: 988, at: 0.14, dur: 0.12, wave: 'square', vol: 0.025 },
        { freq: 1319, at: 0.28, dur: 0.3, wave: 'square', vol: 0.025 },
        { freq: 1319, at: 0.28, dur: 0.35, vol: 0.03 },
      ],
      { bus: 'ui', lp: 2600, limit: ['news', { gap: 0.5, max: 1 }] },
    );
  },
  /** Подземный толчок: дребезг полок и бутылок. */
  rumble,
};
