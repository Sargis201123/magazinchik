// Фоновая музыка: тёплый чиптюн, синтезируется WebAudio на лету — без файлов.
// Днём — бодрее, с ритмом; вечером — медленнее и тише. Отдельный выключатель от звуков.
// Если в магазине играет радио, днём звучит его волна: ретро — медленный свинг, хиты — быстрый бит.

import { audioContext } from './sound';

const KEY = 'magazinchik.music';

export type Mood = 'day' | 'evening';

/** Аккорды по тактам (MIDI-ноты): C — Am — F — G. */
const CHORDS = [
  [60, 64, 67],
  [57, 60, 64],
  [53, 57, 60],
  [55, 59, 62],
];
/** Мелодия: 8 восьмых на такт, -1 — пауза. */
const MELODY = [
  [76, -1, 79, 76, 74, -1, 72, -1],
  [72, -1, 76, 74, 72, -1, 69, -1],
  [69, 72, -1, 74, 72, -1, 69, 67],
  [67, -1, 71, 74, 72, -1, -1, -1],
];
const MOODS: Record<Mood, { bpm: number; melody: number; drums: boolean }> = {
  day: { bpm: 104, melody: 0.022, drums: true },
  evening: { bpm: 82, melody: 0.014, drums: false },
};

/** Волна радио: свои аккорды, мелодия, темп и барабаны. */
export type Station = 'retro' | 'hits';
interface Tune {
  bpm: number;
  melody: number;
  drums: boolean;
  /** Бочка на каждую четверть. */
  kick?: boolean;
  /** Свинг: вторая восьмая запаздывает. */
  swing?: number;
  chords: number[][];
  notes: number[][];
  lead: OscillatorType;
}
const STATIONS: Record<Station, Tune> = {
  // Ретро: Dm7 — G7 — Cmaj7 — A7, мягкий синус и свинг.
  retro: {
    bpm: 88,
    melody: 0.026,
    drums: false,
    swing: 0.18,
    chords: [
      [62, 65, 69],
      [55, 59, 65],
      [60, 64, 71],
      [57, 61, 67],
    ],
    notes: [
      [74, -1, 72, 69, -1, 65, 69, -1],
      [71, -1, 67, -1, 65, 67, -1, -1],
      [72, 76, -1, 74, 72, -1, 71, -1],
      [73, -1, 69, -1, 67, -1, -1, -1],
    ],
    lead: 'sine',
  },
  // Хиты: Am — F — C — G, быстрый бит с бочкой и звонкой мелодией.
  hits: {
    bpm: 128,
    melody: 0.02,
    drums: true,
    kick: true,
    chords: [
      [57, 60, 64],
      [53, 57, 60],
      [60, 64, 67],
      [55, 59, 62],
    ],
    notes: [
      [76, 76, -1, 72, 76, -1, 79, -1],
      [77, -1, 76, 72, -1, 69, 72, -1],
      [72, 72, -1, 76, 79, -1, 84, -1],
      [83, -1, 79, -1, 74, 76, 74, -1],
    ],
    lead: 'square',
  },
};

const freq = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

let muted = readMuted();
let mood: Mood = 'day';
let station: Station | null = null;
let master: GainNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let step = 0;
let nextTime = 0;
let noise: AudioBuffer | null = null;

function readMuted(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function tone(ac: AudioContext, midi: number, at: number, dur: number, wave: OscillatorType, vol: number): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq(midi), at);
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(vol, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(master!);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

function kick(ac: AudioContext, at: number): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, at);
  osc.frequency.exponentialRampToValueAtTime(40, at + 0.12);
  gain.gain.setValueAtTime(0.09, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.15);
  osc.connect(gain).connect(master!);
  osc.start(at);
  osc.stop(at + 0.17);
}

function hat(ac: AudioContext, at: number): void {
  if (!noise) {
    noise = ac.createBuffer(1, ac.sampleRate * 0.05, ac.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = ac.createBufferSource();
  src.buffer = noise;
  const filter = ac.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 6000;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.012, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.04);
  src.connect(filter).connect(gain).connect(master!);
  src.start(at);
}

/** Ставит в очередь ноты на 0.2 секунды вперёд — так музыка не сбивается при подвисаниях. */
function schedule(): void {
  const ac = audioContext();
  if (!ac || !master) return;
  // Вечером радио стихает — играет вечерняя мелодия магазина.
  const radio = mood === 'day' && station ? STATIONS[station] : null;
  const tune: Tune = radio ?? { ...MOODS[mood], chords: CHORDS, notes: MELODY, lead: 'triangle' };
  const eighth = 60 / tune.bpm / 2;
  if (nextTime < ac.currentTime) nextTime = ac.currentTime + 0.05;
  while (nextTime < ac.currentTime + 0.2) {
    const bar = Math.floor(step / 8) % 4;
    const beat = step % 8;
    const at = nextTime + (beat % 2 === 1 ? eighth * (tune.swing ?? 0) : 0);
    const chord = tune.chords[bar];
    if (beat % 4 === 0) tone(ac, chord[0] - 24, at, eighth * 3.5, 'triangle', 0.06);
    tone(ac, chord[[0, 1, 2, 1][beat % 4]], at, eighth * 0.9, radio ? 'triangle' : 'square', 0.012);
    const note = tune.notes[bar][beat];
    if (note > 0 && (mood === 'day' || beat % 2 === 0)) tone(ac, note, at, eighth * 1.6, tune.lead, radio?.lead === 'square' ? tune.melody * 0.5 : tune.melody);
    if (tune.kick && beat % 2 === 0) kick(ac, at);
    if (tune.drums && beat % 2 === 1) hat(ac, at);
    nextTime += eighth;
    step++;
  }
}

export const music = {
  /** Запускает музыку (после касания — иначе браузер не даст звук). */
  start(): void {
    if (muted || timer) return;
    const ac = audioContext();
    if (!ac) return;
    master = ac.createGain();
    master.gain.setValueAtTime(0, ac.currentTime);
    master.gain.linearRampToValueAtTime(1, ac.currentTime + 1.5);
    master.connect(ac.destination);
    nextTime = ac.currentTime + 0.1;
    timer = setInterval(schedule, 50);
  },
  stop(): void {
    if (timer) clearInterval(timer);
    timer = null;
    const ac = audioContext();
    if (ac && master) {
      const old = master;
      old.gain.linearRampToValueAtTime(0, ac.currentTime + 0.4);
      setTimeout(() => old.disconnect(), 500);
    }
    master = null;
  },
  setMood(next: Mood): void {
    mood = next;
  },
  /** Волна радио в магазине (null — радио молчит, играет своя музыка). */
  setStation(next: Station | null): void {
    station = next;
  },
  isMuted: (): boolean => muted,
  setMuted(next: boolean): void {
    muted = next;
    try {
      localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      // Без хранилища настройка живёт до перезапуска.
    }
    if (next) music.stop();
    else music.start();
  },
};
