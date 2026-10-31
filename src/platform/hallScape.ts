// Звук зала по размеру магазина (что и как часто — hallLayers.ts): треск маленького радио в ларьке,
// тележки в больших залах, «пик» сканеров с других касс и объявления по громкой связи в гипермаркете —
// короткий приятный перезвон и «голос» без слов (синтез: гудение через две «гласные» полосы, как из
// динамика под потолком; записей речи нет). Плюс множители к гомону и гулу холодильников (ambience.ts)
// и размер комнаты (mixer.ts setRoom). Всё синтезируется WebAudio; разовые звуки — окружение (mix.ts,
// SoundBudget): когда игрок занят или звучат фанфары, они промолчат.
//
// Пересчитывается несколько раз в секунду (а не каждый кадр): новых объектов за кадр нет.

import type { Gap } from './ambienceLayers';
import { nextGap } from './ambienceLayers';
import { hallMix, type HallMix, type HallScene } from './hallLayers';
import type { VoiceRule } from './mix';
import { admitVoice, busInput, mixer, setRoom } from './mixer';
import { noiseBuffer } from './sound';

/** Как часто пересчитывать звук зала (секунды часов звука). */
const EVERY = 0.25;

/**
 * Громкость (до канала «зал»). Всё тише шагов продавца: фон, который замечаешь, только прислушавшись.
 * Объявление — самое громкое из них, но и оно тише колокольчика на двери.
 */
const LEVEL = { trolley: 0.02, clunk: 0.016, beep: 0.006, chime: 0.011, voice: 0.007, crackle: 0.006, hiss: 0.0012 };

const RULE: Record<'trolley' | 'beep' | 'pa', VoiceRule> = {
  trolley: { gap: 3, max: 1, tier: 'ambience', game: false },
  beep: { gap: 0.6, max: 2, tier: 'ambience', game: false, low: true },
  pa: { gap: 60, max: 1, tier: 'ambience', game: false },
};

/** Высота «пика» у каждой кассы своя (своя касса — sound.scan, ~1175 Гц: эти выше и тише). */
const BEEP_NOTES = [1568, 1661, 1760, 1865, 1976];

let ac0: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let mix: HallMix | null = null;
let checkedAt = -Infinity;
/** Когда в следующий раз (часы звука): тележка, «пик», объявление, треск радио. */
const next = { trolley: 0, beep: 0, pa: 0, crackle: 0 };
/** Радио ларька: тихий эфирный шум (петля), громкость которой плывёт к цели. */
let hiss: { src: AudioBufferSourceNode; gain: GainNode; target: number } | null = null;

/** Сколько раз что прозвучало — для отладки (?debug, ambienceDebug().hall). */
const played = { trolley: 0, beep: 0, pa: 0, crackle: 0 };

const rand = (a: number, b: number): number => a + Math.random() * (b - a);

function noiseSource(ac: AudioContext, at: number, dur: number): AudioBufferSourceNode {
  const src = ac.createBufferSource();
  src.buffer = noise;
  src.start(at, Math.random() * 1.5);
  src.stop(at + dur + 0.02);
  src.onended = () => src.disconnect();
  return src;
}

function sine(ac: AudioContext, out: AudioNode, at: number, f: number, vol: number, ring: number, type: OscillatorType = 'sine'): void {
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.value = f;
  const gain = ac.createGain();
  gain.gain.value = 0;
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(vol, at + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + ring);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + ring + 0.02);
  osc.onended = () => gain.disconnect();
}

/**
 * Тележка: колёса дребезжат по плитке (шум через полосу, громкость скачет каждые ~30 мс), снизу —
 * глухой гул, и сторона плывёт — едет через зал. Иногда в конце — «клац»: вставили в ряд тележек.
 */
function trolley(ac: AudioContext, gain: number): void {
  const level = admitVoice('hallTrolley', RULE.trolley, 2, 'hall');
  if (!level) return;
  played.trolley++;
  const at = ac.currentTime + 0.05;
  const dur = rand(1.2, 2.6);
  const from = rand(-0.8, 0.8);
  const panner = ac.createStereoPanner();
  panner.pan.setValueAtTime(from, at);
  panner.pan.linearRampToValueAtTime(Math.max(-0.9, Math.min(0.9, from + rand(-0.8, 0.8))), at + dur);
  const out = busInput(ac, 'hall', 0, gain * level * rand(0.6, 1));
  panner.connect(out);
  const rattle = ac.createBiquadFilter();
  rattle.type = 'bandpass';
  rattle.frequency.value = rand(1400, 2200);
  rattle.Q.value = 1.4;
  const env = ac.createGain();
  env.gain.value = 0;
  // Дребезг: громкость скачет, а края — мягкие (подъехала и уехала).
  const steps = Math.floor(dur / 0.03);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const edge = Math.min(1, t * 4, (1 - t) * 3);
    env.gain.setValueAtTime(LEVEL.trolley * edge * rand(0.25, 1), at + i * 0.03);
  }
  env.gain.linearRampToValueAtTime(0, at + dur + 0.05);
  noiseSource(ac, at, dur + 0.05).connect(rattle).connect(env).connect(panner);
  const rumble = ac.createBiquadFilter();
  rumble.type = 'lowpass';
  rumble.frequency.value = 260;
  const body = ac.createGain();
  body.gain.value = 0;
  body.gain.setValueAtTime(0, at);
  body.gain.linearRampToValueAtTime(LEVEL.trolley * 1.6, at + dur * 0.3);
  body.gain.linearRampToValueAtTime(0, at + dur);
  noiseSource(ac, at, dur).connect(rumble).connect(body).connect(panner);
  if (Math.random() < 0.35) {
    // «Клац»: глухой стук и короткий металлический звон.
    const t = at + dur + rand(0.05, 0.25);
    sine(ac, panner, t, rand(110, 140), LEVEL.clunk, 0.12);
    sine(ac, panner, t, rand(520, 600), LEVEL.clunk * 0.35, 0.25, 'triangle');
    sine(ac, panner, t + 0.01, rand(1300, 1450), LEVEL.clunk * 0.2, 0.18);
  }
  setTimeout(() => panner.disconnect(), (dur + 1) * 1000);
}

/** «Пик» сканера с другой кассы: тихо, с её стороны зала, иногда — два товара подряд. */
function beep(ac: AudioContext, gain: number, tills: number): void {
  const level = admitVoice('hallBeep', RULE.beep, 0.3, 'hall');
  if (!level) return;
  played.beep++;
  const till = 1 + Math.floor(Math.random() * Math.max(1, tills - 1));
  const out = busInput(ac, 'hall', Math.max(-0.8, Math.min(0.8, -0.6 + till * 0.3 + rand(-0.1, 0.1))), gain * level);
  const f = BEEP_NOTES[till % BEEP_NOTES.length];
  const at = ac.currentTime + 0.03;
  const twice = Math.random() < 0.4;
  for (let i = 0; i < (twice ? 2 : 1); i++) sine(ac, out, at + i * rand(0.35, 0.6), f, LEVEL.beep * (i ? 0.8 : 1), 0.09);
}

/**
 * Объявление по громкой связи: перезвон вверх (три ноты, как в больших магазинах), «голос» без слов —
 * 5–9 слогов, каждый со своей «гласной» и чуть другой высотой, через узкий динамик под потолком —
 * и перезвон вниз. Всё тихо и в большом гулком зале (mixer.ts setRoom).
 */
function announce(ac: AudioContext, gain: number): void {
  const level = admitVoice('hallPa', RULE.pa, 6, 'hall');
  if (!level) return;
  played.pa++;
  const out = busInput(ac, 'hall', rand(-0.2, 0.2), gain * level);
  // Динамик под потолком: без низа и без верха.
  const speaker = ac.createBiquadFilter();
  speaker.type = 'bandpass';
  speaker.frequency.value = 1100;
  speaker.Q.value = 0.6;
  speaker.connect(out);
  let t = ac.currentTime + 0.05;
  const chime = (notes: number[]): void => {
    for (const f of notes) {
      sine(ac, out, t, f, LEVEL.chime, 1.1);
      sine(ac, out, t, f * 2, LEVEL.chime * 0.25, 0.5);
      t += 0.32;
    }
  };
  chime([523.25, 659.25, 783.99]);
  t += 0.5;
  // «Голос»: пила на высоте речи → две полосы-форманты (гласная) → огибающая слога.
  const voice = ac.createOscillator();
  voice.type = 'sawtooth';
  const f1 = ac.createBiquadFilter();
  f1.type = 'bandpass';
  f1.Q.value = 5;
  const f2 = ac.createBiquadFilter();
  f2.type = 'bandpass';
  f2.Q.value = 7;
  const env = ac.createGain();
  env.gain.value = 0;
  voice.connect(f1).connect(env);
  voice.connect(f2).connect(env);
  env.connect(speaker);
  // Гласные: а, о, э, у (первая и вторая форманты, Гц).
  const vowels = [
    [750, 1250],
    [500, 900],
    [550, 1800],
    [350, 800],
  ];
  const pitch = rand(170, 230);
  const syllables = 5 + Math.floor(Math.random() * 5);
  const start = t;
  for (let i = 0; i < syllables; i++) {
    const [a, b] = vowels[Math.floor(Math.random() * vowels.length)];
    const len = rand(0.13, 0.24);
    // Интонация: фраза к концу опускается.
    voice.frequency.setTargetAtTime(pitch * (1 + rand(-0.06, 0.08) - (0.12 * i) / syllables), t, 0.03);
    f1.frequency.setTargetAtTime(a, t, 0.02);
    f2.frequency.setTargetAtTime(b, t, 0.02);
    env.gain.setTargetAtTime(LEVEL.voice * rand(0.7, 1), t, 0.02);
    env.gain.setTargetAtTime(0, t + len * 0.75, 0.03);
    // Между словами — пауза подлиннее.
    t += len + (Math.random() < 0.3 ? rand(0.12, 0.22) : rand(0.02, 0.05));
  }
  voice.frequency.setValueAtTime(pitch, start - 0.01);
  voice.start(start);
  voice.stop(t + 0.2);
  voice.onended = () => {
    env.disconnect();
    speaker.disconnect();
  };
  t += 0.35;
  chime([783.99, 659.25, 523.25]);
}

/** Треск эфира маленького радио: тихий щелчок где-то в углу ларька. */
function crackle(ac: AudioContext, vol: number): void {
  played.crackle++;
  const out = busInput(ac, 'hall', 0.5, vol);
  const at = ac.currentTime + 0.02;
  const dur = rand(0.004, 0.012);
  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = rand(1800, 3500);
  band.Q.value = 1.2;
  const env = ac.createGain();
  env.gain.value = 0;
  env.gain.setValueAtTime(LEVEL.crackle * rand(0.3, 1), at);
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  noiseSource(ac, at, dur).connect(band).connect(env).connect(out);
  setTimeout(() => env.disconnect(), 300);
}

/** Тихий эфирный шум радио ларька — петля, которая играет, только пока нужна. */
function radioHiss(ac: AudioContext, target: number): void {
  if (!hiss && target <= 0) return;
  if (!hiss) {
    const src = ac.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const band = ac.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 2400;
    band.Q.value = 0.9;
    const gain = ac.createGain();
    gain.gain.value = 0;
    src.connect(band).connect(gain).connect(busInput(ac, 'hall', 0.5));
    src.start();
    hiss = { src, gain, target: 0 };
  }
  if (hiss.target === target) return;
  hiss.target = target;
  hiss.gain.gain.setTargetAtTime(target * LEVEL.hiss, ac.currentTime, 0.8);
  if (target <= 0) {
    // Не нужна (ларёк сменили на магазин, звук выключили) — затихла и остановлена.
    const { src, gain } = hiss;
    src.stop(ac.currentTime + 3);
    src.onended = () => gain.disconnect();
    hiss = null;
  }
}

/** Расписать звук по промежутку: при долгом перерыве — не выдавать всё разом. */
function due(key: keyof typeof next, gap: Gap, now: number): boolean {
  if (!gap) {
    next[key] = now + 1;
    return false;
  }
  if (next[key] < now - 1) next[key] = now + nextGap(gap, Math.random) * Math.random();
  if (next[key] > now) return false;
  next[key] = now + nextGap(gap, Math.random);
  return true;
}

export const hallScape = {
  /**
   * Каждый кадр (контекст уже играет); пересчёт — несколько раз в секунду. Возвращает звук зала, чтобы
   * ambience.ts умножил на него гомон и гул холодильников (null — ещё не считали).
   */
  update(ac: AudioContext, s: HallScene): HallMix | null {
    const now = ac.currentTime;
    if (ac !== ac0) {
      ac0 = ac;
      noise = noiseBuffer(ac, 2);
      hiss = null;
    }
    if (now - checkedAt < EVERY && mix) return mix;
    checkedAt = now;
    mix = hallMix(s);
    setRoom(mix.room, mix.hall, mix.street);
    const audible = mixer.audible('hall');
    // Радио ларька — вместе с музыкой: музыку выключили — и треска нет.
    const radio = audible && mixer.audible('music') ? mix.radio : 0;
    radioHiss(ac, radio);
    if (radio > 0 && due('crackle', [0.3, 1.4], now)) crackle(ac, radio);
    if (!audible) return mix;
    if (due('trolley', mix.trolley, now)) trolley(ac, mix.gain);
    if (due('beep', mix.beep, now)) beep(ac, mix.gain, s.tills);
    if (due('pa', mix.pa, now)) announce(ac, mix.gain);
    return mix;
  },

  /** Послушать сразу (?debug, hallPreview('pa')): тележка, «пик» другой кассы или объявление — мимо расписания. */
  preview(kind: 'trolley' | 'beep' | 'pa'): boolean {
    const ac = ac0;
    if (!ac || !noise) return false;
    const was = played[kind];
    if (kind === 'trolley') trolley(ac, 1);
    else if (kind === 'beep') beep(ac, 1, 3);
    else announce(ac, 1);
    // Ограничитель (mix.ts) мог не пустить: звучало только что или игрок занят.
    return played[kind] > was;
  },
  /** Для отладки (?debug): звук зала сейчас и сколько раз что прозвучало. */
  debug: (): Record<string, unknown> => ({ mix, played: { ...played }, radio: hiss?.target ?? 0 }),
};
