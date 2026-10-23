// Атмосфера из файлов: дождь за витриной, гомон покупателей, птицы и вороны за окном, салют, редкие
// звуки улицы (велозвонок, трамвай вдали, голуби, «дзинь» фонаря) и жужжание неоновой вывески. Что
// нужно сейчас — решает ambienceLayers.ts; здесь — скачать (только нужное и только после первого
// касания), разобрать, играть и выбросить из памяти, когда долго не нужно. Улица звучит через стекло
// витрины (канал «улица», mixer.ts), гомон — в зале (канал «зал», с отзвуком комнаты).
//
// Свернули Telegram — контекст спит (mixer.ts), а с ним и петли; часы звука стоят, поэтому редкие
// звуки не «догоняют» пропущенное разом.

import { loadAudio } from './audioFiles';
import {
  AMB,
  birdGap,
  crowGap,
  fireworksOn,
  MURMUR_LAYERS,
  murmurGains,
  nextGap,
  rainFile,
  tramGap,
  wantedFiles,
  type AmbId,
  type AmbScene,
  type AmbSprite,
} from './ambienceLayers';
import { pickVariant } from './mix';
import { allowVoice, busInput, existingAudioContext, mixer, placeAt, type Bus } from './mixer';
import { smoothSeam } from './playlist';

/**
 * Громкость слоёв (файлы выровнены: петли — −22 LUFS, куски нарезки — −20 дБ RMS звучащей части).
 * Записанный дождь подобран замером (модель стекла и динамика телефона): вместе с синтезированным,
 * притихшим до трети, — как прежний синтезированный; на выходе пульта дождь на ~8 дБ тише музыки.
 * Гомон (замер в браузере): три покупателя — на ~12 дБ тише музыки, полный зал — на ~8, один — на ~20.
 * Остальное — рядом с прежними синтезированными птицами.
 */
const LEVEL = {
  rain: 0.18,
  downpour: 0.26,
  murmur: 0.04,
  bird: 0.2,
  crow: 0.24,
  burst: 0.3,
  bike: 0.16,
  tram: 0.2,
  tramBell: 0.1,
  pigeons: 0.2,
  lamp: 0.12,
  neon: 0.0025,
};
/** Синтезированный дождь, пока звучит записанный: треть громкости — капли по сторонам поверх записи. */
export const SYNTH_RAIN_UNDER = 0.35;
/** Не нужен столько секунд (часы звука) — выбросить из памяти. */
const DROP_AFTER = 120;
/** Не скачалось — через сколько секунд попробовать снова. */
const RETRY = 30;
/** Гомон: слои — та же петля со сдвигом, чуть иной высотой и с разных сторон (как разные компании). */
const MURMUR_SPREAD = [
  { pan: 0, rate: 1, offset: 0 },
  { pan: -0.45, rate: 0.965, offset: 1 / 3 },
  { pan: 0.45, rate: 1.035, offset: 2 / 3 },
];

interface Slot {
  buffer?: AudioBuffer;
  loading?: boolean;
  failedAt?: number;
  /** Когда был нужен в последний раз (часы звука). */
  usedAt: number;
}
const slots = new Map<AmbId, Slot>();

interface LoopVoice {
  id: AmbId;
  src: AudioBufferSourceNode;
  gain: GainNode;
  target: number;
}
let bed: LoopVoice | null = null;
const crowd: (LoopVoice | null)[] = Array.from({ length: MURMUR_LAYERS }, () => null);
/** С какого момента гомон молчит (часы звука): долго — петли останавливаем. */
let crowdQuietSince = 0;

/** Когда в следующий раз (часы звука): птица, ворона, трамвай, залп салюта, вспышка неона. */
const next = { bird: 0, crow: 0, tram: 0, burst: 0, flicker: 0 };
/** Через сколько после начала (или долгой паузы): трамвай — не сразу, неон мигает почти сразу. */
const CATCH_UP: Record<keyof typeof next, [number, number]> = { bird: [0, 3], crow: [2, 8], tram: [20, 60], burst: [1, 4], flicker: [0, 0.5] };
/** Салют идёт сериями: до какого момента серия (часы звука). */
let showUntil = 0;
/** Какой кусок нарезки звучал последним (чтобы не повторялся подряд). */
const lastPiece = new Map<string, number>();
/** Сколько раз что прозвучало — для отладки (?debug). */
const played: Record<string, number> = {};

function count(key: string): void {
  played[key] = (played[key] ?? 0) + 1;
}

/** Разобранный файл, если уже есть; если нет — начать качать (и вернуть null). */
function ensure(ac: AudioContext, id: AmbId): AudioBuffer | null {
  const now = ac.currentTime;
  let slot = slots.get(id);
  if (!slot) {
    slot = { usedAt: now };
    slots.set(id, slot);
  }
  slot.usedAt = now;
  if (slot.buffer) return slot.buffer;
  if (slot.loading || (slot.failedAt !== undefined && now - slot.failedAt < RETRY)) return null;
  slot.loading = true;
  const file = AMB[id];
  const done = slot;
  loadAudio(ac, file.path, { lean: true })
    .then((buffer) => {
      if (file.kind === 'loop') smoothSeam(Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c)), buffer.sampleRate, file);
      done.buffer = buffer;
      done.failedAt = undefined;
    })
    .catch(() => {
      done.failedAt = ac.currentTime;
    })
    .finally(() => {
      done.loading = false;
    });
  return null;
}

/** Уже скачан и разобран (не трогая очередь загрузки). */
const ready = (id: AmbId): AudioBuffer | null => slots.get(id)?.buffer ?? null;

function startLoop(ac: AudioContext, id: AmbId, buffer: AudioBuffer, bus: Bus, spread = MURMUR_SPREAD[0]): LoopVoice {
  const file = AMB[id];
  const src = ac.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  if (file.kind === 'loop') {
    src.loopStart = file.loopStart;
    src.loopEnd = file.loopEnd;
  }
  src.playbackRate.value = spread.rate;
  const gain = ac.createGain();
  gain.gain.value = 0;
  src.connect(gain).connect(busInput(ac, bus, spread.pan));
  const loop = file.kind === 'loop' ? file : { loopStart: 0, loopEnd: buffer.duration };
  // Не с начала: каждый раз с нового места петли (а слои гомона — с разных).
  const length = loop.loopEnd - loop.loopStart;
  src.start(ac.currentTime + 0.02, loop.loopStart + ((spread.offset + Math.random() * 0.2) % 1) * length);
  src.onended = () => {
    src.disconnect();
    gain.disconnect();
  };
  return { id, src, gain, target: 0 };
}

function level(v: LoopVoice, ac: AudioContext, target: number, tau: number): void {
  if (Math.abs(v.target - target) < 0.0005) return;
  v.target = target;
  v.gain.gain.setTargetAtTime(target, ac.currentTime, tau);
}

function stopLoop(v: LoopVoice, ac: AudioContext, seconds: number): void {
  v.gain.gain.cancelScheduledValues(ac.currentTime);
  v.gain.gain.setTargetAtTime(0, ac.currentTime, seconds / 4);
  try {
    v.src.stop(ac.currentTime + seconds);
  } catch {
    v.src.disconnect();
  }
}

/**
 * Кусок нарезки: случайный из группы (не тот же, что в прошлый раз), со своей стороной, громкостью
 * и высотой. pan — число или [откуда, куда] (трамвай проезжает слева направо). Длительность или null.
 */
function piece(ac: AudioContext, id: AmbId, group: string, bus: Bus, gain: number, pan: number | [number, number], rate = 1, delay = 0): number | null {
  const buffer = ensure(ac, id);
  if (!buffer) return null;
  const list = (AMB[id] as AmbSprite).groups[group];
  const key = `${id}:${group}`;
  const i = pickVariant(lastPiece.get(key) ?? -1, list.length, Math.random);
  lastPiece.set(key, i);
  const [start, dur] = list[i];
  const at = ac.currentTime + 0.02 + delay;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  let out: AudioNode;
  if (Array.isArray(pan) && typeof ac.createStereoPanner === 'function') {
    // Едет: сторона плывёт от pan[0] к pan[1] за всё время звука.
    const p = ac.createStereoPanner();
    p.pan.setValueAtTime(pan[0], at);
    p.pan.linearRampToValueAtTime(pan[1], at + dur / rate);
    p.connect(busInput(ac, bus, 0, gain));
    out = p;
  } else out = busInput(ac, bus, Array.isArray(pan) ? 0 : pan, gain);
  src.connect(out);
  src.start(at, start, dur);
  src.onended = () => src.disconnect();
  count(group);
  return dur / rate;
}

const rand = (a: number, b: number): number => a + Math.random() * (b - a);
const side = (spread = 0.85): number => rand(-spread, spread);

/** Дождь за витриной: записанная петля (её и только её погода), синтезированный — тише под ней. */
function weatherBed(ac: AudioContext, s: AmbScene): void {
  const want = mixer.audible('street') ? rainFile(s) : null;
  if (bed && bed.id !== want) {
    stopLoop(bed, ac, 2);
    bed = null;
  }
  if (!want) return;
  const buffer = ensure(ac, want);
  if (!buffer) return;
  if (!bed) bed = startLoop(ac, want, buffer, 'street');
  level(bed, ac, LEVEL[want], 1.2);
}

/** Гомон: слои по числу покупателей; долго тихо — петли останавливаем (CPU), память — по DROP_AFTER. */
function murmur(ac: AudioContext, s: AmbScene): void {
  const now = ac.currentTime;
  const gains = mixer.audible('hall') ? murmurGains(s.customers, s.lite) : [0, 0, 0];
  const loud = gains.some((g) => g > 0);
  if (loud) crowdQuietSince = now;
  const buffer = loud ? ensure(ac, 'murmur') : ready('murmur');
  crowd.forEach((v, i) => {
    if (!v && gains[i] > 0 && buffer) v = crowd[i] = startLoop(ac, 'murmur', buffer, 'hall', MURMUR_SPREAD[i]);
    if (!v) return;
    // Покупатели прибывают и уходят — гомон следует плавно, за пару секунд.
    level(v, ac, gains[i] * LEVEL.murmur, 1.5);
    if (!loud && now - crowdQuietSince > 10) {
      stopLoop(v, ac, 0.5);
      crowd[i] = null;
    }
  });
}

/** Птицы, вороны, трамвай и салют: случайные звуки на ближайшие полсекунды. */
function events(ac: AudioContext, s: AmbScene): void {
  if (!mixer.audible('street')) return;
  const now = ac.currentTime;
  const horizon = now + 0.5;
  // Первый раз или долго не планировали (свернули, звук выключали) — не выдавать всё разом.
  for (const key of Object.keys(next) as (keyof typeof next)[]) if (next[key] < now - 1) next[key] = now + rand(...CATCH_UP[key]);
  const birds = birdGap(s);
  if (birds && ensure(ac, 'birds')) {
    while (next.bird < horizon) {
      piece(ac, 'birds', 'bird', 'street', LEVEL.bird * (s.morning > 0.4 ? 1 : 0.75) * rand(0.55, 1), side(), rand(0.94, 1.06), Math.max(0, next.bird - now));
      next.bird += nextGap(birds, Math.random);
    }
  } else next.bird = now + 2;
  const crows = crowGap(s);
  if (crows && ensure(ac, 'crows')) {
    while (next.crow < horizon) {
      piece(ac, 'crows', 'crow', 'street', LEVEL.crow * rand(0.45, 1), side(0.9), rand(0.95, 1.04), Math.max(0, next.crow - now));
      next.crow += nextGap(crows, Math.random);
    }
  } else next.crow = now + rand(4, 12);
  if (fireworksOn(s) && ensure(ac, 'fireworks')) {
    while (next.burst < horizon) {
      // Серия залпов 6–16 с, потом пауза 20–50 с; в серии — залп раз в 0.7–3.2 с, то ближе, то дальше.
      if (next.burst >= showUntil) {
        if (played.burst) next.burst += rand(20, 50);
        showUntil = next.burst + rand(6, s.lite ? 10 : 16);
        continue;
      }
      piece(ac, 'fireworks', 'burst', 'street', LEVEL.burst * rand(0.35, 1), side(0.8), rand(0.9, 1.08), Math.max(0, next.burst - now));
      next.burst += rand(0.7, 3.2);
    }
  } else next.burst = now + rand(1, 4);
  const tram = tramGap(s);
  if (tram && next.tram < horizon && ensure(ac, 'street')) {
    const from = Math.random() < 0.5 ? -0.75 : 0.75;
    const dur = piece(ac, 'street', 'tram', 'street', LEVEL.tram * rand(0.7, 1), [from, -from], 1, Math.max(0, next.tram - now));
    // Иногда звенит, проезжая остановку.
    if (dur && Math.random() < 0.6) piece(ac, 'street', 'tramBell', 'street', LEVEL.tramBell * rand(0.7, 1), from * 0.3, rand(0.97, 1.03), Math.max(0, next.tram - now) + rand(1.5, dur * 0.55));
    next.tram += nextGap(tram, Math.random);
  }
}

/** Неоновая вывеска: тихое жужжание (сеть 50 Гц — гул 100 Гц, слышны его обертоны), изредка — треск мигания. */
interface Buzz {
  osc: OscillatorNode;
  level: GainNode;
  panner: StereoPannerNode | null;
  bus: Bus;
  at?: { pan: number; gain: number };
}
let buzz: Buzz | null = null;

function startBuzz(ac: AudioContext, bus: Bus): Buzz {
  const osc = ac.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = 100;
  const low = ac.createBiquadFilter();
  low.type = 'highpass';
  low.frequency.value = 350;
  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1400;
  band.Q.value = 0.8;
  const level = ac.createGain();
  level.gain.value = 0;
  const panner = typeof ac.createStereoPanner === 'function' ? ac.createStereoPanner() : null;
  osc.connect(low).connect(band).connect(level);
  (panner ? level.connect(panner) : level).connect(busInput(ac, bus));
  osc.start();
  return { osc, level, panner, bus };
}

function stopBuzz(ac: AudioContext): void {
  if (!buzz) return;
  const b = buzz;
  buzz = null;
  b.level.gain.cancelScheduledValues(ac.currentTime);
  b.level.gain.setTargetAtTime(0, ac.currentTime, 0.1);
  b.osc.stop(ac.currentTime + 0.6);
  b.osc.onended = () => b.level.disconnect();
}

/** Где вывеска (x в мире) и в зале ли она (иначе — снаружи, за стеклом); null — неон не горит. */
export interface Neon {
  x: number;
  inside: boolean;
  /** Только что зажглась и мигает. */
  flicker: boolean;
}

function neon(ac: AudioContext, sign: Neon | null, lite: boolean): void {
  const bus: Bus = sign?.inside ? 'hall' : 'street';
  if (!sign || lite || !mixer.audible(bus)) {
    stopBuzz(ac);
    return;
  }
  if (buzz && buzz.bus !== bus) stopBuzz(ac);
  if (!buzz) buzz = startBuzz(ac, bus);
  const where = placeAt(sign.x);
  const now = ac.currentTime;
  const base = LEVEL.neon * where.gain;
  if (!buzz.at || Math.abs(buzz.at.pan - where.pan) > 0.02 || Math.abs(buzz.at.gain - base) > base * 0.05) {
    buzz.at = { pan: where.pan, gain: base };
    buzz.panner?.pan.setTargetAtTime(where.pan, now, 0.2);
    if (now >= next.flicker) buzz.level.gain.setTargetAtTime(base, now, 0.3);
  }
  // Мигает: при зажигании — часто, потом раз в полминуты-минуту короткий треск «бзз-бз».
  if (now < next.flicker) return;
  const steps = 6 + Math.floor(Math.random() * 8);
  let t = now + 0.05;
  for (let i = 0; i < steps; i++) {
    buzz.level.gain.setValueAtTime(Math.random() < 0.5 ? base * 3 : base * 0.2, t);
    t += rand(0.04, 0.11);
  }
  buzz.level.gain.setValueAtTime(base, t);
  next.flicker = t + (sign.flicker ? rand(0.6, 2) : rand(30, 70));
  count('neon');
}

/** Выбросить из памяти то, что давно не нужно (и не звучит). */
function sweep(ac: AudioContext, wanted: AmbId[]): void {
  const now = ac.currentTime;
  for (const [id, slot] of slots) {
    if (wanted.includes(id) || !slot.buffer || now - slot.usedAt < DROP_AFTER) continue;
    if (bed?.id === id || (id === 'murmur' && crowd.some(Boolean))) continue;
    slot.buffer = undefined;
  }
}

let lastWanted: AmbId[] = [];

export const ambFiles = {
  /** Каждый кадр (контекст уже играет): петли, случайные звуки, неон и уборка памяти. */
  update(ac: AudioContext, s: AmbScene, sign: Neon | null): void {
    lastWanted = mixer.audible('street') || mixer.audible('hall') ? wantedFiles(s) : [];
    weatherBed(ac, s);
    murmur(ac, s);
    events(ac, s);
    neon(ac, sign, s.lite);
    sweep(ac, lastWanted);
  },

  /** Записанный дождь уже звучит — синтезированный можно приглушить. */
  rainPlaying: (): boolean => bed !== null && bed.target > 0,

  /** Записанные птицы готовы — синтезированные «чик-чирик» больше не нужны. */
  birdsReady: (): boolean => ready('birds') !== null,

  /**
   * Звук улицы по событию сцены: велозвонок проезжающего велосипедиста, голуби вспорхнули, фонарь
   * зажёгся. Сторона и громкость — по месту на экране; файла ещё нет — начнёт качаться, а звук пропустим.
   */
  street(kind: 'bike' | 'pigeons' | 'lamp', x?: number): void {
    const ac = existingAudioContext();
    if (!ac || !mixer.audible('street')) return;
    const rule = { bike: { gap: 6, max: 1 }, pigeons: { gap: 3, max: 1 }, lamp: { gap: 0.5, max: 2 } }[kind];
    const where = placeAt(x);
    if (kind === 'lamp' && !where.onScreen) return;
    if (!ready('street')) {
      ensure(ac, 'street');
      return;
    }
    if (!allowVoice(`amb-${kind}`, rule, 2)) return;
    piece(ac, 'street', kind, 'street', LEVEL[kind] * where.gain * rand(0.8, 1), where.pan, rand(0.95, 1.05));
  },

  /** Для отладки (?debug): что нужно, что скачано, что звучит. */
  debug(): Record<string, unknown> {
    return {
      wanted: lastWanted,
      loaded: [...slots].filter(([, s]) => s.buffer).map(([id, s]) => ({ id, sampleRate: s.buffer!.sampleRate, duration: s.buffer!.duration })),
      loading: [...slots].filter(([, s]) => s.loading).map(([id]) => id),
      bed: bed ? { id: bed.id, level: bed.target } : null,
      murmur: crowd.map((v) => (v ? Math.round(v.target * 10000) / 10000 : 0)),
      neon: buzz ? { bus: buzz.bus, gain: buzz.at?.gain } : null,
      next: { ...next },
      played: { ...played },
    };
  },
};
