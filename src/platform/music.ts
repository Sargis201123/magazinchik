// Музыка игры: настоящие треки (Suno) по настроению дня, тишина между ними, радио из приёмника
// в зале, оркестр на улице в особый день и заставки к важным моментам. Что и когда играть, решает
// расписание (playlist.ts), здесь — только звук. Всё идёт через канал «Музыка» пульта (mixer.ts):
// ползунок, «без звука», притихание под диалогами и глухой звук под меню работают сами.
//
// Файлы качаются только тогда, когда нужны (после первого касания — тот трек, что сейчас заиграет),
// разобранным в памяти держится только звучащий трек (audioFiles.ts). Пока играет радио или оркестр,
// своя музыка молчит; ночью радио молчит — играет ночная смена.

import { BufferCache, fetched, loadAudio, prefetchAudio } from './audioFiles';
import { duckMusic, existingAudioContext, mixer, busInput } from './mixer';
import { LoopPlayer, type LoopWant } from './radioSound';
import { Playlist, RESUME_GAP, STINGS, stingPath, TRACKS, type Key, type MusicMood, type StationId, type StingId, type TrackId } from './playlist';

export type { MusicMood, StationId, StingId } from './playlist';

/** Как часто расписание смотрит, что делать (мс). */
const TICK_MS = 250;
/** Смена трека, когда он не к месту (ночная смена), — секунды. */
const CROSSFADE = 4;
/** Вход трека после тишины: у треков Suno своё мягкое начало, здесь — только без щелчка. */
const FADE_IN = 0.08;
/** Трек не скачался — помолчим и попробуем снова. */
const RETRY_GAP = 20;
/** Заставка опоздала больше чем на столько (файл ещё качался) — уже не к месту, не играем. */
const LATE_MS = 1500;
/** Заставки, которые звучат чаще других: их держим скачанными в тональности текущей музыки. */
const COMMON_STINGS: StingId[] = ['coin', 'purchase', 'record', 'rank_up'];

const playlist = new Playlist(Math.random);
const loops = new LoopPlayer();
const stingBuffers = new BufferCache(6);

let mood: MusicMood = 'title';
let winter = false;
let radio: { station: StationId; x?: number } | null = null;
let parade: StationId | null = null;
/** Игрок сам крутил ручку приёмника — шипение и позывные; и тема на титуле больше не держит радио. */
let tuned = false;
let radioTouched = false;
let timer: ReturnType<typeof setInterval> | null = null;

interface Voice {
  track: TrackId;
  src: AudioBufferSourceNode;
  gain: GainNode;
}
/** Звучащий трек (на время смены уходящий уже отпущен — он доигрывает сам и выбрасывается). */
let voice: Voice | null = null;
let loads = 0;
let loading = 0;

/** Равная мощность: при смене двух треков общая громкость не проваливается посередине. */
function powerCurve(from: number, to: number): Float32Array<ArrayBuffer> {
  const n = 32;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const k = (i / (n - 1)) * (Math.PI / 2);
    curve[i] = to > from ? from + (to - from) * Math.sin(k) : to + (from - to) * Math.cos(k);
  }
  return curve;
}

/** Плавно к значению за seconds. Кривая не легла (другая ещё идёт) — прямой линией от текущего. */
function glide(param: AudioParam, to: number, at: number, seconds: number): void {
  const from = param.value;
  param.cancelScheduledValues(at);
  try {
    param.setValueCurveAtTime(powerCurve(from, to), at, seconds);
  } catch {
    param.cancelScheduledValues(0);
    param.setValueAtTime(from, at);
    param.linearRampToValueAtTime(to, at + seconds);
  }
}

function startTrack(ac: AudioContext, track: TrackId, buffer: AudioBuffer, fadeIn: number): void {
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const gain = ac.createGain();
  gain.gain.value = 0;
  src.connect(gain).connect(busInput(ac, 'music'));
  const at = ac.currentTime + 0.05;
  glide(gain.gain, 10 ** (TRACKS[track].gainDb / 20), at, fadeIn);
  src.start(at);
  const v: Voice = { track, src, gain };
  voice = v;
  src.onended = () => {
    src.disconnect();
    gain.disconnect();
    if (voice === v) voice = null;
  };
  playlist.started(track, at, buffer.duration);
}

/** Отпустить трек: тихо уходит за seconds и выбрасывается из памяти. */
function release(v: Voice, seconds: number): void {
  const ac = v.src.context;
  const now = ac.currentTime;
  glide(v.gain.gain, 0, now, seconds);
  try {
    v.src.stop(now + seconds + 0.05);
  } catch {
    v.src.disconnect();
  }
  if (voice === v) voice = null;
}

/** Скачать, разобрать и начать трек (fade — плавно сменить играющий). */
async function begin(ac: AudioContext, track: TrackId, fade: boolean): Promise<void> {
  const token = ++loads;
  loading = token;
  try {
    const buffer = await loadAudio(ac, TRACKS[track].path, { lean: true });
    // Пока качали: музыку выключили, отменили или включили радио (оркестр) — трек уже не нужен.
    if (loading !== token || ac.state === 'closed' || !mixer.audible('music') || wantedLoop()) return;
    const old = voice;
    if (old) release(old, fade ? CROSSFADE : 1.5);
    startTrack(ac, track, buffer, old && fade ? CROSSFADE : FADE_IN);
  } catch {
    // Не скачалось или не разобралось — помолчим, как после трека, и попробуем позже.
    if (loading === token) playlist.stopped(ac.currentTime, RETRY_GAP);
  } finally {
    if (loading === token) loading = 0;
  }
}

/**
 * Музыку выключили (ползунок, «без звука»): всё убрать из памяти; включат — через пару секунд
 * следующий трек (а если шла тишина между треками — она и продолжится).
 */
function hush(ac: AudioContext): void {
  loading = 0;
  tuned = false;
  if (voice) release(voice, 0.3);
  loops.stop();
  const now = ac.currentTime;
  if (playlist.playing) playlist.stopped(now, 1.5);
  else playlist.quietUntil = Math.max(playlist.quietUntil, now + 1.5);
}

/** Тема на титуле — первый трек захода: радио дожидается её конца (если игрок сам не трогал приёмник). */
const openingTheme = (): boolean => !radioTouched && (playlist.count === 0 || (playlist.count === 1 && playlist.playing?.track === 'theme'));

/** Что должно играть из «петель»: оркестр на параде важнее приёмника; ночью и на титуле радио молчит. */
function wantedLoop(): LoopWant | null {
  if (parade && mood !== 'night') return { station: parade, kind: 'parade' };
  if (radio && mood !== 'night' && mood !== 'title' && !openingTheme()) return { station: radio.station, kind: 'radio', x: radio.x };
  return null;
}

function tick(): void {
  const ac = existingAudioContext();
  // Ещё не было касания, игра свёрнута или весь звук выключен — ждём (часы звука тоже стоят).
  if (!ac) return;
  if (!mixer.audible('music')) {
    hush(ac);
    return;
  }
  const loop = wantedLoop();
  loops.update(ac, loop, tuned);
  tuned = false;
  if (loading) return;
  const now = ac.currentTime;
  // Зазвучала музыка в новой тональности — частые заставки скачать заранее (трек к тому времени уже скачан).
  const key = currentKey(now);
  if (key && key !== prefetched) {
    prefetched = key;
    prefetchStings(key);
  }
  const cue = playlist.next(now, mood, winter, loop !== null);
  // По расписанию трек кончился, а звук ещё идёт (прыжок во времени при отладке) — два трека сразу не звучат.
  if (!playlist.playing && voice) release(voice, 1);
  if (cue === 'stop') {
    if (voice) release(voice, 2.5);
    playlist.stopped(now, RESUME_GAP);
  } else if (cue) void begin(ac, cue.track, cue.fade);
}

/** Тональность того, что сейчас звучит (null — тишина): заставки берут вариант в ней. */
function currentKey(now: number): Key | null {
  return loops.key(now) ?? (voice ? TRACKS[voice.track].key : null);
}

/** Тональность, под которую заставки уже скачаны. */
let prefetched: Key | null = null;

/** Частые заставки — скачать заранее в тональности музыки, что только что зазвучала (и открытие с итогами дня). */
function prefetchStings(key: Key): void {
  for (const id of COMMON_STINGS) prefetchAudio(stingPath(id, key));
  prefetchAudio(stingPath('day_open', null));
  prefetchAudio(stingPath('day_close', null));
}

let stingUntil = 0;
const lastSting: Partial<Record<StingId, number>> = {};

function playSting(ac: AudioContext, id: StingId, buffer: AudioBuffer): void {
  const src = ac.createBufferSource();
  src.buffer = buffer;
  src.connect(busInput(ac, 'sting'));
  src.onended = () => src.disconnect();
  src.start();
  const duck = STINGS[id].duckDb;
  // Заставки в до мажоре не попадут в тональность музыки — на их время музыка притихает.
  if (duck) duckMusic(buffer.duration * 0.85, 10 ** (duck / 20));
}

export const music = {
  /** Включить расписание. Играет само, когда звук открыт касанием; до того ничего не качает. */
  start(): void {
    if (!timer) timer = setInterval(tick, TICK_MS);
  },

  /** Настроение момента и зима (зимой вальс иногда звучит вместо дня и вечера). Звать можно хоть каждый кадр. */
  setMood(next: MusicMood, isWinter = false): void {
    mood = next;
    winter = isWinter;
  },

  /**
   * Радио в зале: волна (null — выключено или приёмника нет) и где он стоит. byHand — волну сменил
   * сам игрок: шипение настройки и позывные «Радио Магазинчик». Та же волна — только место.
   */
  setRadio(station: StationId | null, x?: number, byHand = false): void {
    if (station !== (radio?.station ?? null) && byHand) {
      tuned = true;
      radioTouched = true;
    }
    radio = station ? { station, x } : null;
  },

  /** Оркестр на улице в особый день (самба, марш, хиты марафона); null — ушёл. */
  setParade(station: StationId | null): void {
    parade = station;
  },

  /**
   * Заставка к событию поверх музыки (в её тональности, а нет — музыка притихает). false — не прозвучит
   * (музыка выключена, звук ещё не открыт, только что звучала другая): тогда можно сыграть обычный звук.
   * gap — не чаще раза в столько секунд.
   */
  sting(id: StingId, gap = 1): boolean {
    const ac = existingAudioContext();
    if (!ac || !mixer.audible('music')) return false;
    const now = ac.currentTime;
    // Одна заставка за раз: вторая поверх первой — каша.
    if (now < stingUntil || now - (lastSting[id] ?? -Infinity) < gap) return false;
    stingUntil = now + STINGS[id].duration * 0.75;
    lastSting[id] = now;
    const path = stingPath(id, currentKey(now));
    const ready = stingBuffers.get(path);
    if (ready) {
      playSting(ac, id, ready);
      return true;
    }
    const asked = performance.now();
    void loadAudio(ac, path, { keep: true })
      .then((buffer) => {
        stingBuffers.set(path, buffer);
        if (performance.now() - asked < LATE_MS && mixer.audible('music')) playSting(ac, id, buffer);
      })
      .catch(() => {});
    return true;
  },

  /** Скачать заставку заранее (расширение, открытие дня) — чтобы прозвучала вовремя. */
  prefetch(id: StingId): void {
    if (existingAudioContext()) prefetchAudio(stingPath(id, null));
  },

  /** Ползунок «Музыка» отпустили: если сейчас тишина между треками — короткая заставка, чтобы было слышно громкость. */
  preview(): void {
    if (!voice && !loops.active) music.sting('coin', 0);
  },
};

// Отладка: ?debug открывает расписание из консоли (что играет, что скачано) и «прыжок» во времени.
if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug')) {
  Object.assign(window, {
    musicDebug: () => {
      const ac = existingAudioContext();
      const b = voice?.src.buffer;
      return {
        now: ac?.currentTime,
        mood,
        winter,
        radio,
        parade,
        loading: Boolean(loading),
        playlist: { playing: playlist.playing, quietUntil: playlist.quietUntil, last: playlist.last, count: playlist.count },
        track: voice && b ? { id: voice.track, duration: b.duration, sampleRate: b.sampleRate, channels: b.numberOfChannels, gain: voice.gain.gain.value } : null,
        loop: loops.debug(),
        key: ac ? currentKey(ac.currentTime) : null,
        stings: stingBuffers.keys(),
        fetched: fetched.slice(),
      };
    },
    musicSkip: (seconds: number) => playlist.skip(seconds),
    musicSting: (id: StingId) => music.sting(id),
    musicLoopBuffer: () => loops.buffer(),
  });
}
