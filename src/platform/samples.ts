// Записанные звуки действий и слоги голосов: две «ленты» (public/audio/sfx, art/sfx/render.py).
// Качаются только после первого касания, обе сразу (голоса не ждут звуков: окно бабушки уже открыто),
// разбираются один раз и лежат в памяти целиком — это меньше минуты моно. Пока лента не готова (или
// не скачалась — тогда пробуем ещё пару раз, реже), sound.ts играет прежние синтезированные звуки:
// тишины не бывает. Голос героя не меняется посреди реплики: писк или бормотание решает первый слог.

import { fetched, loadAudio } from './audioFiles';
import { clipSpan, markerShift } from './foley';
import { existingAudioContext, mixer } from './mixer';
import { SFX_BANK, VOICE_BANK, type Bank, type Segment } from './sfxData';

export type BankId = 'sfx' | 'voice';

const BANKS: Record<BankId, Bank> = { sfx: SFX_BANK, voice: VOICE_BANK };
/**
 * Не выше какой частоты разбирать: голоса сделаны до 6,5 кГц (art/sfx/voice.py) и сжаты со срезом 8 кГц,
 * им хватает 16 кГц — 2 МБ памяти вместо 4. Звукам действий (звон, стекло) нужны верха — как у музыки.
 */
const DECODE_RATE: Record<BankId, number> = { sfx: Infinity, voice: 16000 };
/** Не скачалось — следующая попытка через столько секунд (и ещё раз, вдвое позже); потом — только синтез. */
const RETRY = [20, 60];
const POLL_MS = 400;

interface State {
  buffer: AudioBuffer | null;
  /** На сколько секунд кодек сдвинул звук относительно таблицы (по метке в начале ленты). */
  shift: number;
  loading: boolean;
  failures: number;
  retryAt: number;
}

const state: Record<BankId, State> = {
  sfx: { buffer: null, shift: 0, loading: false, failures: 0, retryAt: 0 },
  voice: { buffer: null, shift: 0, loading: false, failures: 0, retryAt: 0 },
};

function load(ac: AudioContext, id: BankId): void {
  const s = state[id];
  s.loading = true;
  // Разбор сразу в пониженной частоте (32 кГц, на слабом телефоне — 22, голоса — 16): в телефоне не слышно,
  // памяти меньше.
  loadAudio(ac, BANKS[id].path, { lean: true, rate: DECODE_RATE[id] })
    .then((buffer) => {
      s.shift = markerShift(buffer.getChannelData(0), buffer.sampleRate, BANKS[id].marker);
      s.buffer = buffer;
    })
    .catch(() => {
      s.failures++;
      s.retryAt = performance.now() / 1000 + (RETRY[s.failures - 1] ?? Infinity);
    })
    .finally(() => {
      s.loading = false;
    });
}

/** Нужна ли лента сейчас: звук открыт касанием, а её канал не выключен. */
const wanted = (id: BankId): boolean =>
  id === 'voice' ? mixer.audible('voice') : mixer.audible('world') || mixer.audible('ui') || mixer.audible('hall');

let timer: ReturnType<typeof setInterval> | null = null;

function poll(): void {
  const ac = existingAudioContext();
  if (!ac) return;
  const now = performance.now() / 1000;
  for (const id of ['sfx', 'voice'] as BankId[]) {
    const s = state[id];
    if (s.buffer || s.loading || now < s.retryAt || !wanted(id)) continue;
    // Голоса не ждут звуков: иначе первый разговор с бабушкой начинался писком и посреди него
    // становился бормотанием (а лента голосов и так легче ленты звуков).
    load(ac, id);
  }
  const done = (id: BankId) => state[id].buffer !== null || state[id].retryAt === Infinity;
  if (done('sfx') && done('voice') && timer) {
    clearInterval(timer);
    timer = null;
  }
}

if (typeof window !== 'undefined') timer = setInterval(poll, POLL_MS);

/**
 * Кусок ленты, если она уже разобрана: буфер, откуда и сколько играть (с тишиной спереди — foley.ts,
 * clipSpan), множитель громкости. null — ещё нет.
 */
export function segment(id: BankId, seg: Segment): { buffer: AudioBuffer; offset: number; dur: number; gain: number } | null {
  const s = state[id];
  if (!s.buffer) return null;
  const [at, dur, gain] = seg;
  return { buffer: s.buffer, ...clipSpan(at, dur, s.shift, s.buffer.duration), gain };
}

/** Готова ли лента. */
export const ready = (id: BankId): boolean => state[id].buffer !== null;

// Отладка: ?debug — что скачано и разобрано, сдвиг кодека, неудачи.
if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug')) {
  Object.assign(window, {
    samplesDebug: () => ({
      sfx: { ...state.sfx, buffer: state.sfx.buffer && { duration: state.sfx.buffer.duration, sampleRate: state.sfx.buffer.sampleRate } },
      voice: { ...state.voice, buffer: state.voice.buffer && { duration: state.voice.buffer.duration, sampleRate: state.voice.buffer.sampleRate } },
      fetched: fetched.slice(),
    }),
  });
}
