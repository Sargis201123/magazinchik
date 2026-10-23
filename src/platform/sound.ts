// Звуки действий. Касса, монетки, товар на полке, колокольчик над дверью, распаковка, швабра, кот и пёс,
// щелчки меню и голоса героев — записи и модели предметов из «ленты» (samples.ts, art/sfx): у каждого
// звука 3–5 вариантов, подряд не повторяются, высота и громкость каждый раз чуть другие. Пока лента
// не скачалась (первые секунды после касания) или если не скачалась вовсе — те же звуки синтезируются
// WebAudio на лету, как раньше: огибающая без щелчков, мягкий фильтр сверху. Звуки мира (касса, полка,
// кот) слышны с той стороны экрана, где это случилось. Громкость, каналы, отзвук комнаты и сон в фоне —
// в mixer.ts.

import { brownNoise, seeded } from './ambienceSynth';
import { speak, voiceOf, type Syllable, type Voice as Speaker } from './babble';
import { MATERIAL, payWith, placeRate, type Material } from './foley';
import { jitter, pickVariant, type VoiceRule } from './mix';
import { allowVoice, audioContext, busInput, duckMusic, mixer, placeAt, type Bus } from './mixer';
import { liteMode } from './quality';
import { segment } from './samples';
import { SFX, SYLLABLES, type SfxId } from './sfxData';
import type { Category } from '../game/economy';

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

/** Какой вариант каждого записанного звука звучал в прошлый раз — следующий будет другим. */
const lastVariant: Partial<Record<SfxId, number>> = {};

interface SampleVoice extends Voice {
  /** Высота × (сверх разброса cents). */
  rate?: number;
  /** Громкость ×. */
  gain?: number;
  /** Через сколько секунд. */
  at?: number;
}

/**
 * Записанный звук id: вариант (не тот же, что в прошлый раз), разброс высоты и громкости, канал,
 * сторона и ограничение частоты — как у синтезированного. null — лента ещё не готова (или не скачалась):
 * играйте синтез; false — звук не нужен (канал выключен, за краем экрана, частый звук придержан); true — сыгран.
 */
function sample(id: SfxId, o: SampleVoice = {}): boolean | null {
  const variants = SFX[id];
  const v = pickVariant(lastVariant[id] ?? -1, variants.length, Math.random);
  const piece = segment('sfx', variants[v]);
  if (!piece) return null;
  const ac = audio(busOf(o));
  if (!ac) return false;
  const rate = o.rate ?? 1;
  // Ограничителю — не дольше 0.7 с: тихий хвост колокольчика не должен занимать место других звуков.
  const target = output(ac, o, Math.min(piece.dur / rate, 0.7));
  if (!target) return false;
  lastVariant[id] = v;
  const src = ac.createBufferSource();
  src.buffer = piece.buffer;
  src.playbackRate.value = rate * target.rate;
  const gain = ac.createGain();
  gain.gain.value = piece.gain * (o.gain ?? 1);
  src.connect(gain).connect(target.out);
  src.onended = () => {
    src.disconnect();
    gain.disconnect();
  };
  src.start(ac.currentTime + 0.005 + (o.at ?? 0), piece.offset, piece.dur);
  return true;
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

/** Синтезированное касание (пока нет записанного щелчка): короткий мягкий «ток». */
const synthTap = (): void => play([{ freq: 660, dur: 0.05, vol: 0.035, slide: 540 }], { bus: 'ui', lp: 2400, cents: 50, db: 1.5, limit: ['tap', { gap: 0.04, max: 2 }] });

/** Шаг швабры туда-обратно: «вжих» мокрой тряпки. */
const MOP_STROKE = 0.42;

/** Синтезированная швабра (пока нет записанной): шорох в полосе, туда-обратно. */
function synthMop(x: number | undefined, strokes: number): void {
  const ac = audio('world');
  if (!ac) return;
  const target = output(ac, { x, limit: ['mop', { gap: 0.8, max: 2, low: true }], skipOffscreen: true, db: 1.5 }, strokes * MOP_STROKE);
  if (!target) return;
  const now = ac.currentTime + 0.01;
  for (let i = 0; i < strokes; i++) noiseBurst(ac, target.out, now + i * MOP_STROKE, 0.34, 1000 + Math.random() * 500, 0.9, 0.03, 0.12);
}

/** Монетка: высота из нескольких, чтобы подряд не звенела одинаково. */
const COIN_NOTES = [1319, 1397, 1568, 1480];
let lastCoin = -1;
/** Мяу: три «кошки» — обычная, повыше и пониже. */
let lastMeow = -1;
/** Стук «что-то не так»: два варианта по очереди. */
let lastBad = -1;

export const sound = {
  /** Мяу: кот открывает и закрывает рот, тон вверх и вниз (пока нет записи — короткое скольжение). */
  meow: (x?: number) => {
    if (sample('meow', { x, cents: 90, db: 2, limit: ['meow', { gap: 0.6, max: 1 }] }) !== null) return;
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
  /** Гав: «гав», «гав-гав» или «тяв-тяв-тяв» (пока нет записи — два хриплых тявка, пила через фильтр). */
  bark: (x?: number) => {
    if (sample('bark', { x, cents: 70, db: 2, limit: ['bark', { gap: 0.5, max: 1 }] }) !== null) return;
    play(
      [
        { freq: 340, dur: 0.09, wave: 'sawtooth', vol: 0.045, slide: 220 },
        { freq: 360, at: 0.17, dur: 0.1, wave: 'sawtooth', vol: 0.045, slide: 230 },
      ],
      { x, lp: 1400, cents: 60, db: 2, limit: ['bark', { gap: 0.5, max: 1 }] },
    );
  },
  /** Пар кофемашины и шипение печи. */
  hiss,
  /** Касание, начало дела: деревянный «ток», каждый раз чуть другой. */
  tap: () => {
    if (sample('click', { bus: 'ui', cents: 120, db: 1.5, limit: ['tap', { gap: 0.04, max: 2 }] }) === null) synthTap();
  },
  /** Кнопка в меню — деревянный щелчок, вкладка — шорох страницы. */
  click: (kind: 'button' | 'tab' = 'button') => {
    if (sample(kind === 'tab' ? 'page' : 'click', { bus: 'ui', cents: 100, db: 1.5, gain: 0.85, limit: ['tap', { gap: 0.04, max: 2 }] }) === null) synthTap();
  },
  /**
   * Сканер на кассе: «пик» пьезопищалки и стук товара о стекло. Слышно, но не режет. Не чаще раза
   * в 0,35 с — на большой корзине не превращается в трель.
   */
  scan: (x?: number) => {
    if (sample('scan', { x, cents: 8, db: 1, limit: ['scan', { gap: 0.35, max: 1 }] }) !== null) return;
    play(
      [
        { freq: 1175, dur: 0.09, wave: 'sine', vol: 0.03, attack: 0.006 },
        { freq: 2350, dur: 0.06, wave: 'sine', vol: 0.006, attack: 0.006 },
      ],
      { x, lp: 3500, cents: 15, db: 1.5, limit: ['scan', { gap: 0.35, max: 1 }] },
    );
  },
  /** Деньги: звон монеток в горсти (пока нет записи — два мягких касания, высота каждый раз своя). */
  coin: (x?: number) => {
    if (sample('coin', { x, cents: 70, db: 1.5, limit: ['coin', { gap: 0.25, max: 2 }] }) !== null) return;
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
  /**
   * Покупатель расплатился на кассе: щелчок рычага, «дзынь» звонка, ящик выезжает — и в лоток ложится
   * мелочь, а за большую покупку шуршат купюры. Пока ленты нет — прежнее «дзынь» монеток.
   */
  till: (x?: number, total = 0) => {
    const played = sample('till', { x, cents: 30, db: 1, limit: ['coin', { gap: 0.25, max: 2 }] });
    if (played === null) sound.coin(x);
    else if (played) sample(payWith(total), { x, at: 0.2, gain: 0.5, cents: 60, db: 1.5 });
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
  /** Кто-то важный вошёл: колокольчики над дверью звенят от распахнутой двери (без ленты — два удара). */
  bell: (x?: number) => {
    if (sample('bell', { x, cents: 25, db: 1, limit: ['bell', { gap: 0.25, max: 2 }] }) !== null) return;
    ring(
      [
        { freq: 1175, vol: 0.035, ring: 1 },
        { freq: 880, at: 0.18, vol: 0.035, ring: 1.3 },
      ],
      BELL,
      { x, cents: 12, db: 1, limit: ['bell', { gap: 0.25, max: 2 }] },
    );
  },
  /**
   * Покупатель входит: тихое «дзинь» колокольчика над дверью (канал «зал»). false — записи ещё нет:
   * тогда звенит синтезированный колокольчик из ambience.ts.
   */
  doorbell: (x?: number): boolean => sample('door', { bus: 'hall', x, cents: 30, db: 1.5, limit: ['chime', { gap: 0.4, max: 2 }] }) !== null,
  /** Таймер печи: чистое «дзинь» чашечки (без ленты — колокольчик). */
  ding: (x?: number) => {
    if (sample('ding', { x, cents: 20, db: 1, limit: ['bell', { gap: 0.25, max: 2 }] }) === null) sound.bell(x);
  },
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
  /**
   * Товар встал на место: звук его материала (бутылка звякнула, банка стукнула, хлеб лёг мягко, коробка
   * шуршит картоном); n — какой по счёту, каждый следующий чуть выше. Без ленты — прежний «чпок».
   */
  place: (material: Material, n = 0, x?: number) => {
    if (sample(material, { x, rate: placeRate(n), cents: 40, db: 2, limit: ['pop', { gap: 0.06, max: 3, low: true }], skipOffscreen: true }) === null) sound.pop(n, x);
  },
  /** Товар отдела встал на полку. */
  shelf: (category: Category, n = 0, x?: number) => sound.place(MATERIAL[category], n, x),
  /** Коробка с новинкой упала на пол: глухой картонный стук (без ленты — «ток»). */
  boxLand: (x?: number) => {
    if (sample('boxland', { x, cents: 50, db: 1.5, limit: ['boxland', { gap: 0.15, max: 2 }] }) === null) synthTap();
  },
  /** Распаковка: «хрррт» скотча и два картонных клапана, через delay секунд. false — ленты ещё нет. */
  unbox: (x?: number, delay = 0): boolean => sample('unbox', { x, at: delay, cents: 40, db: 1.5, limit: ['unbox', { gap: 0.3, max: 2 }] }) !== null,
  /** Швабра трёт пол seconds секунд: мокрый «вжих» туда-обратно. */
  mop: (x?: number, seconds = 1.3) => {
    const strokes = Math.max(2, Math.round(seconds / MOP_STROKE));
    const first = sample('mop', { x, cents: 80, db: 2, limit: ['mop', { gap: 0.8, max: 2, low: true }], skipOffscreen: true });
    if (first === null) synthMop(x, strokes);
    else if (first) for (let i = 1; i < strokes; i++) sample('mop', { x, at: i * MOP_STROKE + Math.random() * 0.05, cents: 80, db: 2 });
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
  /**
   * Слог героя в диалоге (какой и когда — babble.ts): слог из банка голосов на скорости героя, интонация —
   * высотой, эмоция — тембром. Пока банк не скачан — прежний короткий «пик» на высоте героя.
   */
  syllable: (v: Speaker, s: Syllable) => {
    const seg = SYLLABLES[v.bank][s.index];
    const piece = seg ? segment('voice', seg) : null;
    if (!piece) {
      sound.voice(v.pitch * 2 ** (s.semitones / 12));
      return;
    }
    const ac = audio('voice');
    if (!ac) return;
    const j = jitter(Math.random, 20, 1);
    // Не выше 1.6 и не ниже 0.7 от записи: дальше голос звучит «бурундуком» или гулко.
    const rate = Math.min(1.6, Math.max(0.7, v.rate * 2 ** (s.semitones / 12) * j.rate));
    const dur = piece.dur * v.clip;
    if (!allowVoice('voice', { gap: 0.04, max: 3 }, dur / rate)) return;
    const now = ac.currentTime + 0.005;
    const src = ac.createBufferSource();
    src.buffer = piece.buffer;
    src.playbackRate.value = rate;
    const tone = ac.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = v.tone;
    tone.Q.value = 0.6;
    const env = ac.createGain();
    const g = piece.gain * v.gain * j.gain;
    env.gain.setValueAtTime(g, now);
    // Оборванный слог (злость) — не щелчком, а за 15 мс.
    if (v.clip < 1) {
      const end = now + dur / rate;
      env.gain.setValueAtTime(g, Math.max(now, end - 0.015));
      env.gain.linearRampToValueAtTime(0, end);
    }
    let chain: AudioNode = src.connect(tone);
    // «Звонкость» — полка около 2.5 кГц; на слабом телефоне без неё.
    if (v.bright && !liteMode()) {
      const bright = ac.createBiquadFilter();
      bright.type = 'peaking';
      bright.frequency.value = 2500;
      bright.Q.value = 0.9;
      bright.gain.value = v.bright;
      chain = chain.connect(bright);
    }
    chain.connect(env).connect(busInput(ac, 'voice'));
    src.onended = () => {
      src.disconnect();
      env.disconnect();
    };
    src.start(now, piece.offset, dur);
  },
  /** Пример голоса для ползунка «Голоса»: бабушка радостно здоровается. */
  speakSample: () => {
    const v = voiceOf('portrait_grandma_happy', 620);
    for (const { at, syllable } of speak('Ой, здравствуй, внучек!', v)) setTimeout(() => sound.syllable(v, syllable), at * 1000);
  },
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
