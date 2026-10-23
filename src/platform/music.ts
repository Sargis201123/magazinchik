// Фоновая музыка: тёплый чиптюн, синтезируется WebAudio на лету — без файлов.
// Днём — бодрее, с ритмом; вечером — медленнее и тише. Громкость — свой ползунок «Музыка» (mixer.ts).
// Если в магазине играет радио, днём звучит его волна: ретро — медленный свинг, хиты — быстрый бит.
// Бас — октавой выше прежнего и с призвуками: на динамике телефона его теперь слышно. Фраза не
// крутится одинаково: каждый четвёртый проход мелодия молчит («вдох»), смена настроения и волны
// — с начала такта, а не посреди ноты.

import { busInput, existingAudioContext, mixer } from './mixer';

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
/** Ещё карнавальная самба и марш оркестра — играют в особый день (bigday.ts), пока идёт шествие. */
export type Station = 'retro' | 'hits' | 'samba' | 'march';
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
  // Самба: C — F — Dm — G, быстрая бочка, свинг и звонкая синкопа.
  samba: {
    bpm: 118,
    melody: 0.022,
    drums: true,
    kick: true,
    swing: 0.12,
    chords: [
      [60, 64, 67],
      [65, 69, 72],
      [62, 65, 69],
      [67, 71, 74],
    ],
    notes: [
      [79, -1, 79, 76, -1, 79, 81, -1],
      [81, 79, -1, 77, -1, 76, 77, -1],
      [77, -1, 74, 77, -1, 81, 79, -1],
      [79, 77, -1, 74, 71, -1, 72, -1],
    ],
    lead: 'square',
  },
  // Марш: C — G — C — F, ровная бочка на каждую долю и труба-квадрат.
  march: {
    bpm: 112,
    melody: 0.024,
    drums: true,
    kick: true,
    chords: [
      [60, 64, 67],
      [55, 59, 62],
      [60, 64, 67],
      [53, 57, 60],
    ],
    notes: [
      [72, -1, 72, 74, 76, -1, 72, -1],
      [74, -1, 71, -1, 67, -1, -1, -1],
      [72, -1, 76, 79, 84, -1, 79, -1],
      [77, 76, 74, -1, 72, -1, -1, -1],
    ],
    lead: 'square',
  },
};

const freq = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

let mood: Mood = 'day';
let station: Station | null = null;
/** Что попросили сменить — применится с начала следующего такта. */
let nextMood: Mood = 'day';
let nextStation: Station | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let step = 0;
let nextTime = 0;
let noise: AudioBuffer | null = null;

/** Выход музыки в своём контексте: громкость (плавный вход), мягкий бас и мягкое арпеджио. */
interface Out {
  ac: AudioContext;
  master: GainNode;
  bass: BiquadFilterNode;
  arp: BiquadFilterNode;
}
let out: Out | null = null;

function connectOut(ac: AudioContext): Out {
  const master = ac.createGain();
  master.gain.value = 0;
  master.gain.setValueAtTime(0, ac.currentTime);
  master.gain.linearRampToValueAtTime(1, ac.currentTime + 1.5);
  master.connect(busInput(ac, 'music'));
  // Бас — пила через фильтр: телефон не играет сам тон (~130 Гц), но слышит его призвуки.
  const bass = ac.createBiquadFilter();
  bass.type = 'lowpass';
  bass.frequency.value = 700;
  bass.Q.value = 0.6;
  bass.connect(master);
  // Квадратное арпеджио — без визгливого верха.
  const arp = ac.createBiquadFilter();
  arp.type = 'lowpass';
  arp.frequency.value = 2200;
  arp.Q.value = 0.5;
  arp.connect(master);
  return { ac, master, bass, arp };
}

function tone(ac: AudioContext, midi: number, at: number, dur: number, wave: OscillatorType, vol: number, to: AudioNode = out!.master): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  gain.gain.value = 0;
  osc.type = wave;
  osc.frequency.setValueAtTime(freq(midi), at);
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(vol, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(to);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

/** Бочка: «тук» повыше прежнего (телефон 40 Гц не играет) и щелчок колотушки сверху. */
function kick(ac: AudioContext, at: number): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  gain.gain.value = 0;
  osc.type = 'sine';
  osc.frequency.setValueAtTime(180, at);
  osc.frequency.exponentialRampToValueAtTime(75, at + 0.1);
  gain.gain.setValueAtTime(0.07, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.14);
  osc.connect(gain).connect(out!.master);
  osc.start(at);
  osc.stop(at + 0.16);
  hat(ac, at, 2500, 0.01, 0.015);
}

function hat(ac: AudioContext, at: number, cut = 6000, vol = 0.012, len = 0.04): void {
  if (!noise || noise.sampleRate !== ac.sampleRate) {
    noise = ac.createBuffer(1, ac.sampleRate * 0.05, ac.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = ac.createBufferSource();
  src.buffer = noise;
  const filter = ac.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = cut;
  const gain = ac.createGain();
  gain.gain.value = 0;
  gain.gain.setValueAtTime(vol, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + len);
  src.connect(filter).connect(gain).connect(out!.master);
  src.start(at);
}

/** Ставит в очередь ноты на 0.2 секунды вперёд — так музыка не сбивается при подвисаниях. */
function schedule(): void {
  const ac = existingAudioContext();
  // Не слышно (свёрнуто, без звука, ползунок на нуле) — ноты не копим, потом продолжим с того же места.
  if (!ac || !mixer.audible('music')) {
    nextTime = 0;
    return;
  }
  if (!out || out.ac !== ac) {
    out = connectOut(ac);
    nextTime = 0;
    step = 0;
  }
  if (nextTime < ac.currentTime) nextTime = ac.currentTime + 0.05;
  while (nextTime < ac.currentTime + 0.2) {
    // Новое настроение и волна — только с начала такта: темп не скачет посреди ноты.
    if (step % 8 === 0) {
      mood = nextMood;
      station = nextStation;
    }
    // Вечером радио стихает — играет вечерняя мелодия магазина.
    const radio = mood === 'day' && station ? STATIONS[station] : null;
    const tune: Tune = radio ?? { ...MOODS[mood], chords: CHORDS, notes: MELODY, lead: 'triangle' };
    const eighth = 60 / tune.bpm / 2;
    const bar = Math.floor(step / 8) % 4;
    const beat = step % 8;
    // Каждый четвёртый проход фразы — «вдох»: мелодия молчит, остаются аккорды и бас.
    const rest = Math.floor(step / 32) % 4 === 3;
    const at = nextTime + (beat % 2 === 1 ? eighth * (tune.swing ?? 0) : 0);
    const chord = tune.chords[bar];
    if (beat % 4 === 0) tone(ac, chord[0] - 12, at, eighth * 3.5, 'sawtooth', 0.035, out.bass);
    tone(ac, chord[[0, 1, 2, 1][beat % 4]], at, eighth * 0.9, radio ? 'triangle' : 'square', 0.012, out.arp);
    const note = tune.notes[bar][beat];
    if (note > 0 && !rest && (mood === 'day' || beat % 2 === 0))
      tone(ac, note, at, eighth * 1.6, tune.lead, radio?.lead === 'square' ? tune.melody * 0.5 : tune.melody, radio?.lead === 'square' ? out.arp : out.master);
    if (tune.kick && beat % 2 === 0) kick(ac, at);
    if (tune.drums && beat % 2 === 1) hat(ac, at);
    nextTime += eighth;
    step++;
  }
}

export const music = {
  /** Запускает музыку (после касания «Играть»). Играет, когда её слышно, — сама подхватывается. */
  start(): void {
    if (!timer) timer = setInterval(schedule, 50);
  },
  stop(): void {
    if (timer) clearInterval(timer);
    timer = null;
    if (out) {
      const old = out.master;
      old.gain.cancelScheduledValues(out.ac.currentTime);
      old.gain.setTargetAtTime(0, out.ac.currentTime, 0.12);
      setTimeout(() => old.disconnect(), 500);
    }
    out = null;
  },
  setMood(next: Mood): void {
    nextMood = next;
  },
  /** Волна радио в магазине (null — радио молчит, играет своя музыка). */
  setStation(next: Station | null): void {
    nextStation = next;
  },
};
