// Звуки окружения: дождь и ливень (из отдельных капель), ветер, капель с водостока, птицы днём,
// сверчки летними вечерами, гул холодильников, шаги продавца и колокольчик на двери. Шума улицы
// и проезжающих машин нет: вместе они звучали как прибой и сбивали спокойную атмосферу. Всё синтезируется WebAudio; дождь и шум ветра — заранее, в буферы
// (ambienceSynth.ts). Погода и птицы — канал «улица» (за стеклом, без отзвука зала), гул, шаги
// и колокольчик — канал «зал» (mixer.ts); оба слушаются ползунка «Окружение».
//
// Поверх синтеза — атмосфера из файлов (ambienceFiles.ts): записанный дождь за витриной, гомон
// покупателей, записанные птицы и вороны, салют на Новый год, трамвай вдали, велозвонок, голуби,
// «дзинь» фонаря и жужжание неона. Пока файл не скачан (или на слабом телефоне) — звучит синтез.

import type { YearTime } from '../game/calendar';
import type { Weather } from '../game/weather';
import { ambFiles, SYNTH_RAIN_UNDER, type Neon } from './ambienceFiles';
import { birdGap, type AmbScene } from './ambienceLayers';
import { brownNoise, rainTexture, seeded } from './ambienceSynth';
import { fetched } from './audioFiles';
import { jitter } from './mix';
import { allowVoice, busInput, existingAudioContext, mixer, placeAt, setDoorAir, STREET_LOW, type Bus } from './mixer';
import { noiseBuffer } from './sound';

export type { Neon } from './ambienceFiles';

/** Жизнь вокруг — для атмосферы из файлов: покупатели, утро, Новый год, поздняя осень, ночная смена, неон. */
export interface AmbLife {
  /** Покупателей в зале. */
  customers: number;
  /** Утро: 1 — только открылись (и утренний экран), 0 — с середины дня. */
  morning: number;
  /** Новогодняя неделя в игре или 31 декабря — 1 января по календарю. */
  newYear: boolean;
  /** Поздняя осень (после урожая, до Нового года) — вороны. */
  lateAutumn: boolean;
  night: boolean;
  /** Облегчённый режим: меньше слоёв, без записанного дождя. */
  lite: boolean;
  /** Неоновая вывеска, которая сейчас горит (или null). */
  neon: Neon | null;
}

interface Bed {
  gain: GainNode;
  /** К какой громкости петля уже плывёт — не планируем то же самое каждый кадр. */
  target?: number;
}

type BedId = 'rain' | 'downpour' | 'wind' | 'hum';

/** Входы каналов «улица» и «зал» того контекста, для которого собраны петли. */
let street: AudioNode | null = null;
let hall: AudioNode | null = null;
let beds: Record<BedId, Bed> | null = null;
let noise: AudioBuffer | null = null;
/** Когда в следующий раз: капля с водостока, птица, сверчок (время аудиоконтекста). */
const next = { drip: 0, bird: 0, cricket: 0 };

function stereoBuffer(ac: AudioContext, left: Float32Array, right: Float32Array): AudioBuffer {
  const buffer = ac.createBuffer(2, left.length, ac.sampleRate);
  buffer.copyToChannel(left as Float32Array<ArrayBuffer>, 0);
  buffer.copyToChannel(right as Float32Array<ArrayBuffer>, 1);
  return buffer;
}

/** Медленное «дыхание» громкости (порывы дождя и ветра): усилитель, которым качает LFO. */
function swell(ac: AudioContext, rate: number, depth: number): GainNode {
  const mod = ac.createGain();
  mod.gain.value = 1;
  const lfo = ac.createOscillator();
  lfo.frequency.value = rate;
  const amount = ac.createGain();
  amount.gain.value = depth;
  lfo.connect(amount).connect(mod.gain);
  lfo.start();
  return mod;
}

/** Зацикленный буфер → фильтр → порывы → громкость. */
function loopBed(ac: AudioContext, buffer: AudioBuffer, type: BiquadFilterType, freq: number, q: number, sway: [number, number]): Bed {
  const src = ac.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const mod = swell(ac, sway[0], sway[1]);
  const gain = ac.createGain();
  gain.gain.value = 0;
  src.connect(filter).connect(mod).connect(gain).connect(street!);
  src.start(0, Math.random() * buffer.duration);
  return { gain };
}

/** Ветер: бурый шум через полосу, которая медленно гуляет вверх-вниз, — «завывание». */
function windBed(ac: AudioContext): Bed {
  const random = seeded(7);
  const n = Math.floor(ac.sampleRate * 9);
  const data = brownNoise(n, random, Math.floor(ac.sampleRate * 0.1));
  const buffer = stereoBuffer(ac, data, brownNoise(n, random, Math.floor(ac.sampleRate * 0.1)));
  const src = ac.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 520;
  filter.Q.value = 1.1;
  const howl = ac.createOscillator();
  howl.frequency.value = 0.07;
  const howlDepth = ac.createGain();
  howlDepth.gain.value = 260;
  howl.connect(howlDepth).connect(filter.frequency);
  howl.start();
  const mod = swell(ac, 0.13, 0.55);
  const gain = ac.createGain();
  gain.gain.value = 0;
  src.connect(filter).connect(mod).connect(gain).connect(street!);
  src.start();
  return { gain };
}

/**
 * Ровный гул холодильников: две ноты чуть врозь — медленное «живое» биение. Раньше гудело на 118 Гц:
 * динамик телефона это не играет, а запас громкости низ съедал. Теперь октавой выше и на самом
 * пороге слышимости (~−52 дБ): чувствуется в тишине, когда музыка выключена, и не мешает ей.
 */
function humBed(ac: AudioContext): Bed {
  const gain = ac.createGain();
  gain.gain.value = 0;
  const soft = ac.createBiquadFilter();
  soft.type = 'lowpass';
  soft.frequency.value = 900;
  for (const f of [236, 238, 472]) {
    const osc = ac.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = f;
    osc.connect(soft);
    osc.start();
  }
  soft.connect(gain).connect(hall!);
  return { gain };
}

function build(ac: AudioContext): void {
  noise = noiseBuffer(ac, 2);
  street = busInput(ac, 'street');
  hall = busInput(ac, 'hall');
  // Дождь — 7 с, ливень — 5.3 с: разная длина петель, чтобы повтор не угадывался.
  const light = rainTexture(ac.sampleRate, 7, { drops: 170, wash: 0.35, plops: 0.06 }, seeded(11));
  const heavy = rainTexture(ac.sampleRate, 5.3, { drops: 520, wash: 0.6, plops: 0.04 }, seeded(23));
  beds = {
    rain: loopBed(ac, stereoBuffer(ac, light.left, light.right), 'lowpass', 8500, 0.5, [0.09, 0.22]),
    downpour: loopBed(ac, stereoBuffer(ac, heavy.left, heavy.right), 'lowpass', 5200, 0.5, [0.15, 0.3]),
    wind: windBed(ac),
    hum: humBed(ac),
  };
}

/** Плавно к нужной громкости — без щелчков. */
function fade(bed: Bed, ac: AudioContext, target: number): void {
  if (bed.target === target) return;
  bed.target = target;
  bed.gain.gain.setTargetAtTime(target, ac.currentTime, 0.6);
}

/** Разовый звук зала: только когда петли уже собраны (контекст играет) и окружение слышно. */
function blip(bus: Bus, at: (ac: AudioContext) => void): void {
  const ac = existingAudioContext();
  if (!ac || !beds || !mixer.audible(bus)) return;
  at(ac);
}

/** Тон с огибающей и скольжением частоты; pan −1…1. */
function tone(ac: AudioContext, out: AudioNode, at: number, dur: number, f0: number, f1: number, vol: number, pan: number, type: OscillatorType = 'sine'): void {
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, at);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
  const gain = ac.createGain();
  gain.gain.value = 0;
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(vol, at + Math.min(0.012, dur / 4));
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  const panner = ac.createStereoPanner();
  panner.pan.value = pan;
  osc.connect(gain).connect(panner).connect(out);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

/** Капля с водостока в лужу: короткий «плинк», звенящий вверх. */
function drip(ac: AudioContext, out: AudioNode, at: number): void {
  const f = 700 + Math.random() * 600;
  tone(ac, out, at, 0.07, f, f * 1.9, 0.02, Math.random() * 1.4 - 0.7);
}

/** Птица: одна из трёх «песен» — чик-чирик, трель или свист с переливом. */
function bird(ac: AudioContext, out: AudioNode, at: number, vol: number): void {
  const pan = Math.random() * 1.6 - 0.8;
  const kind = Math.random();
  if (kind < 0.45) {
    // Воробей: 2–4 коротких «чик» сверху вниз.
    const notes = 2 + Math.floor(Math.random() * 3);
    const base = 3200 + Math.random() * 1200;
    for (let i = 0; i < notes; i++) tone(ac, out, at + i * 0.13, 0.07, base * 1.25, base * 0.8, vol, pan);
  } else if (kind < 0.8) {
    // Синица-трель: частые одинаковые ноты.
    const notes = 6 + Math.floor(Math.random() * 5);
    const base = 4300 + Math.random() * 900;
    for (let i = 0; i < notes; i++) tone(ac, out, at + i * 0.055, 0.035, base, base * (i % 2 ? 0.92 : 1.05), vol * 0.8, pan);
  } else {
    // Дрозд: протяжный свист с переливом вверх и вниз.
    const base = 1900 + Math.random() * 600;
    tone(ac, out, at, 0.22, base, base * 1.45, vol * 0.9, pan);
    tone(ac, out, at + 0.24, 0.3, base * 1.4, base * 1.1, vol * 0.9, pan);
  }
}

/** Сверчок: три быстрых стрекота на высокой ноте (за стеклом витрины верх глуше — чуть громче, чем был). */
function cricket(ac: AudioContext, out: AudioNode, at: number, pitch: number, pan: number): void {
  for (let i = 0; i < 3; i++) tone(ac, out, at + i * 0.045, 0.028, pitch, pitch * 0.98, 0.015, pan);
}

/**
 * Расписать случайные звуки на ближайшие полсекунды (вызывается каждый кадр). recordedBirds — звучат
 * записанные птицы (ambienceFiles.ts): синтезированные тогда молчат.
 */
function schedule(ac: AudioContext, weather: Weather, evening: number, season: YearTime, recordedBirds: boolean): void {
  const now = ac.currentTime;
  const horizon = now + 0.5;
  const wet = weather === 'rain' || weather === 'storm';
  // Если долго не планировали (вкладка была свёрнута) — не выдавать всё разом.
  for (const key of Object.keys(next) as (keyof typeof next)[]) if (next[key] < now - 1) next[key] = now + Math.random();
  if (wet) {
    while (next.drip < horizon) {
      drip(ac, street!, Math.max(now, next.drip));
      next.drip += (weather === 'storm' ? 0.25 : 0.45) + Math.random() * 1.2;
    }
  } else next.drip = now + 1;
  const dayBirds = !recordedBirds && !wet && weather !== 'snow' && evening < 0.55 && season !== 'winter';
  if (dayBirds) {
    while (next.bird < horizon) {
      bird(ac, street!, Math.max(now, next.bird), season === 'autumn' ? 0.02 : 0.032);
      next.bird += (season === 'autumn' ? 4 : 1.6) + Math.random() * 4;
    }
  } else next.bird = now + 2;
  const crickets = (weather === 'clear' || weather === 'heat') && evening >= 0.45 && (season === 'summer' || season === 'spring');
  if (crickets) {
    while (next.cricket < horizon) {
      const at = Math.max(now, next.cricket);
      cricket(ac, street!, at, 4300, -0.5);
      if (Math.random() < 0.7) cricket(ac, street!, at + 0.21, 4650, 0.45);
      next.cricket += 0.55 + Math.random() * 0.25;
    }
  } else next.cricket = now + 1;
}

/** Шаги продавца: левая-правая нога чуть по разные стороны, каждый шаг немного другой. */
let foot = 1;

export const ambience = {
  /**
   * Каждый кадр: фоновые звуки под погоду, время суток, сезон и то, открыт ли магазин; life — что
   * вокруг (покупатели, утро, Новый год, неон) для атмосферы из файлов.
   */
  update(weather: Weather, evening: number, open: boolean, season: YearTime = 'summer', life?: AmbLife): void {
    const ac = existingAudioContext();
    if (!ac) return;
    if (!beds) build(ac);
    const scene: AmbScene = {
      weather,
      season,
      lateAutumn: life?.lateAutumn ?? false,
      evening,
      morning: life?.morning ?? 0,
      customers: life?.customers ?? 0,
      newYear: life?.newYear ?? false,
      night: life?.night ?? false,
      lite: life?.lite ?? false,
    };
    if (life) ambFiles.update(ac, scene, life.neon);
    // Громкость задаёт канал (ползунок «Окружение»); здесь — только что звучит при такой погоде.
    // Дождь — на ~9 дБ тише музыки, ливень с ветром — на ~6: слышно, но музыку не перекрывает.
    // Звучит записанный дождь — синтезированный остаётся тихим слоем капель поверх него.
    const under = ambFiles.rainPlaying() ? SYNTH_RAIN_UNDER : 1;
    fade(beds!.rain, ac, weather !== 'rain' ? 0 : 0.2 * under);
    fade(beds!.downpour, ac, weather !== 'storm' ? 0 : 0.19 * under);
    // В снегопад и листопад — едва слышный ветер: тихая погода, а не буря. Ветер низкий, стекло витрины
    // его не глушит — без прибавки канала улицы (STREET_LOW).
    const windy = weather === 'storm' ? 0.06 : weather === 'snow' ? 0.018 : weather === 'leaves' ? 0.012 : 0;
    fade(beds!.wind, ac, windy * STREET_LOW);
    fade(beds!.hum, ac, !open ? 0 : 0.0005);
    if (mixer.audible('street')) schedule(ac, weather, evening, season, Boolean(life) && birdGap(scene) !== null && ambFiles.birdsReady());
  },

  /** Насколько открыта дверь (0…1, каждый кадр): улица на миг «входит» в зал — ярче и чуть громче. */
  door(open: number): void {
    setDoorAir(open);
  },

  /** Звук улицы по событию: велосипедист звонит, голуби вспорхнули, фонарь зажёгся (x — где в мире). */
  street(kind: 'bike' | 'pigeons' | 'lamp', x?: number): void {
    ambFiles.street(kind, x);
  },

  /**
   * Шаг продавца: мягкий шорох подошвы. Не чаще ~4 раз в секунду, каждый раз чуть другой по
   * тону и громкости; продавец за краем экрана не слышен.
   */
  step(x?: number): void {
    blip('hall', (ac) => {
      const where = placeAt(x);
      if (!where.onScreen || !allowVoice('step', { gap: 0.22, max: 1, low: true }, 0.08)) return;
      foot = -foot;
      const j = jitter(Math.random, 0, 3);
      const out = busInput(ac, 'hall', Math.max(-1, Math.min(1, where.pan + foot * 0.06)), where.gain * j.gain);
      const now = ac.currentTime;
      const src = ac.createBufferSource();
      src.buffer = noise;
      const filter = ac.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 450 + Math.random() * 450;
      filter.Q.value = 1.1;
      const gain = ac.createGain();
      gain.gain.value = 0;
      const dur = 0.045 + Math.random() * 0.025;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      src.connect(filter).connect(gain).connect(out);
      src.start(now, Math.random() * 1.8);
      src.stop(now + dur + 0.01);
    });
  },

  /** Колокольчик над дверью: тихое «дзинь» с той стороны, где дверь, — металл, а не два писка. */
  chime(x?: number): void {
    blip('hall', (ac) => {
      if (!allowVoice('chime', { gap: 0.4, max: 2 }, 0.8)) return;
      const where = placeAt(x);
      const j = jitter(Math.random, 20, 1.5);
      const out = busInput(ac, 'hall', where.pan, where.gain * j.gain);
      const now = ac.currentTime;
      // Язычок задевает колокольчик то сверху вниз, то снизу вверх.
      const pair = Math.random() < 0.5 ? [2093, 2637] : [2637, 2093];
      pair.forEach((f, i) => {
        const at = now + i * (0.06 + Math.random() * 0.03);
        for (const [ratio, level, ring] of [
          [1, 1, 0.7],
          [2.76, 0.35, 0.3],
          [5.4, 0.12, 0.15],
        ]) {
          if (f * ratio > 16000) continue;
          const osc = ac.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = f * ratio * j.rate;
          const gain = ac.createGain();
          gain.gain.value = 0;
          gain.gain.setValueAtTime(0, at);
          gain.gain.linearRampToValueAtTime(0.022 * level, at + 0.004);
          gain.gain.exponentialRampToValueAtTime(0.0001, at + ring);
          osc.connect(gain).connect(out);
          osc.start(at);
          osc.stop(at + ring + 0.02);
        }
      });
    });
  },
};

// Отладка: ?debug открывает атмосферу из консоли (что нужно, что скачано, что звучит, сколько раз).
if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug'))
  Object.assign(window, {
    ambienceDebug: () => ({ ...ambFiles.debug(), fetched: fetched.filter((f) => f.url.includes('audio/amb/')).map((f) => f.url) }),
  });
