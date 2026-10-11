// Звуки синтезируются WebAudio на лету: без файлов и чужих лицензий, ничего не весят.
// Браузер разрешает звук только после касания, поэтому контекст создаётся на первом касании.

import { brownNoise, seeded } from './ambienceSynth';

const KEY = 'magazinchik.muted';

let ctx: AudioContext | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Общий аудиоконтекст для звуков и музыки (создаётся по первому касанию). */
export function audioContext(): AudioContext | null {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state !== 'running' && ctx.state !== 'closed') void ctx.resume().catch(() => {});
  return ctx;
}

/** Контекст, если он уже создан касанием; сам не создаёт (для фоновых звуков в каждом кадре). */
export function existingAudioContext(): AudioContext | null {
  return ctx && ctx.state === 'running' ? ctx : null;
}

function audio(): AudioContext | null {
  if (muted) return null;
  return audioContext();
}

/**
 * Браузер включает звук только внутри касания. В Telegram (особенно на iPhone) не каждое событие
 * считается касанием, а после сворачивания или звонка звук снова засыпает, — поэтому будим его
 * на любом касании, пока не заиграет, и ещё раз, когда игра снова на экране.
 */
function unlock(): void {
  if (ctx?.state === 'running') return;
  const ac = audioContext();
  if (!ac) return;
  // iOS: беззвучный отсчёт, сыгранный прямо в касании, окончательно открывает звук.
  try {
    const src = ac.createBufferSource();
    src.buffer = ac.createBuffer(1, 1, 22050);
    src.connect(ac.destination);
    src.start(0);
  } catch {
    // не страшно — попробуем на следующем касании
  }
}

for (const type of ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'click', 'keydown'])
  window.addEventListener(type, unlock, { capture: true, passive: true });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && ctx && ctx.state !== 'running') void ctx.resume().catch(() => {});
});

interface Note {
  freq: number;
  /** Через сколько секунд от начала звука. */
  at?: number;
  dur: number;
  wave?: OscillatorType;
  vol?: number;
  /** Частота в конце ноты — скольжение вверх или вниз. */
  slide?: number;
}

function play(notes: Note[]): void {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime + 0.01;
  for (const { freq, at = 0, dur, wave = 'square', vol = 0.05, slide } of notes) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, now + at);
    if (slide) osc.frequency.exponentialRampToValueAtTime(slide, now + at + dur);
    // Короткая атака и затухание — без щелчков.
    gain.gain.setValueAtTime(0, now + at);
    gain.gain.linearRampToValueAtTime(vol, now + at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(now + at);
    osc.stop(now + at + dur + 0.02);
  }
}

/** Белый шум: основа грома, дождя и шума улицы. */
export function noiseBuffer(ac: AudioContext, seconds: number): AudioBuffer {
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** Буфер раската грома (бурый шум) — один на всю игру. */
let rumbleBuffer: AudioBuffer | null = null;

/**
 * Гром: близкий — резкий треск и тяжёлый раскат, дальний — только глухое ворчание. Раскат
 * катится волнами (несколько подъёмов громкости) и уходит из стороны в сторону.
 */
function thunder(): void {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime + 0.01;
  const near = Math.random();
  if (!rumbleBuffer) {
    const random = seeded(31);
    const n = Math.floor(ac.sampleRate * 6);
    rumbleBuffer = ac.createBuffer(1, n, ac.sampleRate);
    rumbleBuffer.copyToChannel(brownNoise(n, random) as Float32Array<ArrayBuffer>, 0);
  }
  const panner = ac.createStereoPanner();
  panner.pan.setValueAtTime(Math.random() * 1.2 - 0.6, now);
  panner.pan.linearRampToValueAtTime(Math.random() * 1.2 - 0.6, now + 5);
  panner.connect(ac.destination);
  // Треск — только у близкого грома.
  if (near > 0.45) {
    const crack = ac.createBufferSource();
    crack.buffer = noiseBuffer(ac, 0.4);
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1500;
    const cg = ac.createGain();
    cg.gain.setValueAtTime(0, now);
    cg.gain.linearRampToValueAtTime(0.14 * near, now + 0.008);
    cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    crack.connect(hp).connect(cg).connect(panner);
    crack.start(now);
    crack.stop(now + 0.4);
  }
  // Раскат: бурый шум, верха глохнут, громкость волнами.
  const src = ac.createBufferSource();
  src.buffer = rumbleBuffer;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(400 + 500 * near, now);
  lp.frequency.exponentialRampToValueAtTime(70, now + 5);
  const gain = ac.createGain();
  const delay = (1 - near) * 0.6;
  const peak = 0.25 + 0.35 * near;
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

/** Шипение (пар кофемашины, противень из печи): шум через полосовой фильтр. */
function hiss(seconds = 0.9, freq = 3200, vol = 0.05): void {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime + 0.01;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, seconds);
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(vol, now + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(now);
  src.stop(now + seconds);
}

/** Мурчание: низкий гул, который пульсирует ~25 раз в секунду. */
function purr(): void {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime + 0.01;
  const osc = ac.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = 52;
  const lfo = ac.createOscillator();
  lfo.frequency.value = 24;
  const depth = ac.createGain();
  depth.gain.value = 0.03;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.035, now + 0.15);
  gain.gain.setValueAtTime(0.035, now + 1);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
  lfo.connect(depth).connect(gain.gain);
  osc.connect(gain).connect(ac.destination);
  osc.start(now);
  lfo.start(now);
  osc.stop(now + 1.45);
  lfo.stop(now + 1.45);
}

export const sound = {
  /** Мяу: короткое скольжение вверх и вниз. */
  meow: () =>
    play([
      { freq: 620, dur: 0.12, wave: 'triangle', vol: 0.05, slide: 900 },
      { freq: 900, at: 0.12, dur: 0.22, wave: 'triangle', vol: 0.045, slide: 520 },
    ]),
  purr,
  /** Гав-гав: два коротких хриплых тявка. */
  bark: () =>
    play([
      { freq: 340, dur: 0.09, wave: 'sawtooth', vol: 0.05, slide: 220 },
      { freq: 360, at: 0.17, dur: 0.1, wave: 'sawtooth', vol: 0.05, slide: 230 },
    ]),
  /** Пар кофемашины и шипение печи. */
  hiss,
  /** Касание, начало дела. */
  tap: () => play([{ freq: 520, dur: 0.05, wave: 'triangle', vol: 0.05 }]),
  /** Писк сканера на каждом товаре. */
  scan: () => play([{ freq: 1760, dur: 0.06, vol: 0.025 }]),
  /** Покупатель расплатился: «дзынь». */
  coin: () =>
    play([
      { freq: 988, dur: 0.08, vol: 0.04 },
      { freq: 1319, at: 0.07, dur: 0.22, vol: 0.04 },
    ]),
  /** Хорошо: поймали вора, задание выполнено, проверка пройдена. */
  good: () =>
    play([
      { freq: 523, dur: 0.1, wave: 'triangle', vol: 0.07 },
      { freq: 659, at: 0.08, dur: 0.1, wave: 'triangle', vol: 0.07 },
      { freq: 784, at: 0.16, dur: 0.2, wave: 'triangle', vol: 0.07 },
    ]),
  /** Плохо: украли, ушёл злой, штраф. */
  bad: () => play([{ freq: 300, dur: 0.25, wave: 'sawtooth', vol: 0.035, slide: 150 }]),
  /** Кто-то важный вошёл: колокольчик на двери. */
  bell: () =>
    play([
      { freq: 1175, dur: 0.25, wave: 'sine', vol: 0.08 },
      { freq: 880, at: 0.18, dur: 0.4, wave: 'sine', vol: 0.08 },
    ]),
  /** Большое событие: редкий гость, новое звание, конец дня. */
  fanfare: () =>
    play([
      { freq: 523, dur: 0.12, vol: 0.04 },
      { freq: 659, at: 0.1, dur: 0.12, vol: 0.04 },
      { freq: 784, at: 0.2, dur: 0.12, vol: 0.04 },
      { freq: 1047, at: 0.3, dur: 0.35, vol: 0.04 },
      { freq: 523, at: 0.3, dur: 0.35, wave: 'triangle', vol: 0.06 },
    ]),

  /** Серия обслуживания: короткое арпеджио, с каждой ступенью выше. */
  combo: (n: number) => {
    const base = 523 * 2 ** (Math.min(n - 2, 8) / 12);
    play([
      { freq: base, dur: 0.07, wave: 'square', vol: 0.03 },
      { freq: base * 1.26, at: 0.06, dur: 0.07, wave: 'square', vol: 0.03 },
      { freq: base * 1.5, at: 0.12, dur: 0.16, wave: 'square', vol: 0.03 },
    ]);
  },
  /** «Чпок» товара на полке; n — какой по счёту (каждый следующий чуть выше). */
  pop: (n = 0) => play([{ freq: 660 + n * 40, dur: 0.05, wave: 'sine', vol: 0.05, slide: 990 + n * 50 }]),
  /** «Голос» героя в диалоге: короткий писк на его высоте, каждый раз чуть другой. */
  voice: (pitch: number) => play([{ freq: pitch * (0.9 + Math.random() * 0.25), dur: 0.035, wave: 'square', vol: 0.018 }]),
  /** Раскат грома в грозу. */
  thunder,
  /** Позывные новостей: три сигнала вверх. */
  news: () =>
    play([
      { freq: 784, dur: 0.12, wave: 'square', vol: 0.03 },
      { freq: 988, at: 0.14, dur: 0.12, wave: 'square', vol: 0.03 },
      { freq: 1319, at: 0.28, dur: 0.3, wave: 'square', vol: 0.03 },
    ]),
  /** Подземный толчок: низкий гул, проседающий вниз. */
  rumble: () =>
    play([
      { freq: 70, dur: 0.9, wave: 'sawtooth', vol: 0.06, slide: 32 },
      { freq: 52, at: 0.1, dur: 0.8, wave: 'triangle', vol: 0.08, slide: 28 },
    ]),

  isMuted: (): boolean => muted,
  setMuted(next: boolean): void {
    muted = next;
    try {
      localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      // Без хранилища настройка живёт до перезапуска.
    }
    // Музыка играет через тот же контекст — его не останавливаем.
  },
};
