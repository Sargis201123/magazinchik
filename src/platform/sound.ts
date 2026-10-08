// Звуки синтезируются WebAudio на лету: без файлов и чужих лицензий, ничего не весят.
// Браузер разрешает звук только после касания, поэтому контекст создаётся на первом касании.

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
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function audio(): AudioContext | null {
  if (muted) return null;
  return audioContext();
}

// Первое касание будит звук (особенно на iOS).
document.addEventListener('pointerdown', () => audioContext(), { once: true });

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

export const sound = {
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
