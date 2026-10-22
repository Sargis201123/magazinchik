// Звуки окружения: дождь и ливень (из отдельных капель), ветер, капель с водостока, птицы днём,
// сверчки летними вечерами, гул холодильников, шаги продавца и колокольчик на двери. Шума улицы
// и проезжающих машин нет: вместе они звучали как прибой и сбивали спокойную атмосферу. Всё синтезируется WebAudio; дождь и шум ветра — заранее, в буферы
// (ambienceSynth.ts). Выключаются вместе со звуками.

import type { YearTime } from '../game/calendar';
import type { Weather } from '../game/weather';
import { brownNoise, rainTexture, seeded } from './ambienceSynth';
import { existingAudioContext, noiseBuffer, sound } from './sound';

interface Bed {
  gain: GainNode;
}

type BedId = 'rain' | 'downpour' | 'wind' | 'hum';

let master: GainNode | null = null;
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
  src.connect(filter).connect(mod).connect(gain).connect(master!);
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
  src.connect(filter).connect(mod).connect(gain).connect(master!);
  src.start();
  return { gain };
}

/** Ровный гул холодильников: две низкие ноты чуть врозь — «живое» биение. */
function humBed(ac: AudioContext): Bed {
  const gain = ac.createGain();
  gain.gain.value = 0;
  for (const f of [118, 121.5, 236]) {
    const osc = ac.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = f;
    osc.connect(gain);
    osc.start();
  }
  gain.connect(master!);
  return { gain };
}

function build(ac: AudioContext): void {
  noise = noiseBuffer(ac, 2);
  master = ac.createGain();
  master.gain.value = 1;
  master.connect(ac.destination);
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
  if (Math.abs(bed.gain.gain.value - target) < 0.0005) return;
  bed.gain.gain.setTargetAtTime(target, ac.currentTime, 0.6);
}

function blip(at: (ac: AudioContext, out: AudioNode) => void): void {
  const ac = existingAudioContext();
  if (!ac || !master || sound.isMuted()) return;
  at(ac, master);
}

/** Тон с огибающей и скольжением частоты; pan −1…1. */
function tone(ac: AudioContext, out: AudioNode, at: number, dur: number, f0: number, f1: number, vol: number, pan: number, type: OscillatorType = 'sine'): void {
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, at);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
  const gain = ac.createGain();
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

/** Сверчок: три быстрых стрекота на высокой ноте. */
function cricket(ac: AudioContext, out: AudioNode, at: number, pitch: number, pan: number): void {
  for (let i = 0; i < 3; i++) tone(ac, out, at + i * 0.045, 0.028, pitch, pitch * 0.98, 0.011, pan);
}

/** Расписать случайные звуки на ближайшие полсекунды (вызывается каждый кадр). */
function schedule(ac: AudioContext, weather: Weather, evening: number, season: YearTime): void {
  const now = ac.currentTime;
  const horizon = now + 0.5;
  const wet = weather === 'rain' || weather === 'storm';
  // Если долго не планировали (вкладка была свёрнута) — не выдавать всё разом.
  for (const key of Object.keys(next) as (keyof typeof next)[]) if (next[key] < now - 1) next[key] = now + Math.random();
  if (wet) {
    while (next.drip < horizon) {
      drip(ac, master!, Math.max(now, next.drip));
      next.drip += (weather === 'storm' ? 0.25 : 0.45) + Math.random() * 1.2;
    }
  } else next.drip = now + 1;
  const dayBirds = !wet && weather !== 'snow' && evening < 0.55 && season !== 'winter';
  if (dayBirds) {
    while (next.bird < horizon) {
      bird(ac, master!, Math.max(now, next.bird), season === 'autumn' ? 0.02 : 0.032);
      next.bird += (season === 'autumn' ? 4 : 1.6) + Math.random() * 4;
    }
  } else next.bird = now + 2;
  const crickets = (weather === 'clear' || weather === 'heat') && evening >= 0.45 && (season === 'summer' || season === 'spring');
  if (crickets) {
    while (next.cricket < horizon) {
      const at = Math.max(now, next.cricket);
      cricket(ac, master!, at, 4300, -0.5);
      if (Math.random() < 0.7) cricket(ac, master!, at + 0.21, 4650, 0.45);
      next.cricket += 0.55 + Math.random() * 0.25;
    }
  } else next.cricket = now + 1;
}

export const ambience = {
  /** Каждый кадр: фоновые звуки под погоду, время суток, сезон и то, открыт ли магазин. */
  update(weather: Weather, evening: number, open: boolean, season: YearTime = 'summer'): void {
    const ac = existingAudioContext();
    if (!ac) return;
    if (!beds) build(ac);
    const muted = sound.isMuted();
    fade(beds!.rain, ac, muted || weather !== 'rain' ? 0 : 0.11);
    fade(beds!.downpour, ac, muted || weather !== 'storm' ? 0 : 0.16);
    // В снегопад и листопад — едва слышный ветер: тихая погода, а не буря.
    const windy = weather === 'storm' ? 0.06 : weather === 'snow' ? 0.018 : weather === 'leaves' ? 0.012 : 0;
    fade(beds!.wind, ac, muted ? 0 : windy);
    fade(beds!.hum, ac, muted || !open ? 0 : 0.006);
    if (!muted) schedule(ac, weather, evening, season);
  },

  /** Шаг продавца: короткий глухой стук. */
  step(): void {
    blip((ac, out) => {
      const now = ac.currentTime;
      const src = ac.createBufferSource();
      src.buffer = noise;
      const filter = ac.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      src.connect(filter).connect(gain).connect(out);
      src.start(now, Math.random());
      src.stop(now + 0.07);
    });
  },

  /** Колокольчик над дверью: тихое «дзинь», когда входит покупатель. */
  chime(): void {
    blip((ac, out) => {
      const now = ac.currentTime;
      for (const [f, at] of [
        [2093, 0],
        [2637, 0.07],
      ]) {
        const osc = ac.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f;
        const gain = ac.createGain();
        gain.gain.setValueAtTime(0, now + at);
        gain.gain.linearRampToValueAtTime(0.025, now + at + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.6);
        osc.connect(gain).connect(out);
        osc.start(now + at);
        osc.stop(now + at + 0.65);
      }
    });
  },
};
