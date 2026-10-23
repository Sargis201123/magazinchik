// Радио и оркестр: волна-петля (art/music/tracks_radio.py) играет по кругу без шва. Радио звучит
// из самого приёмника в зале — как маленький динамик (полоса ~300 Гц–5 кГц, лёгкий «хрип») и с той
// стороны экрана, где он стоит; дальше от экрана — тише. Переключили волну — шипение настройки и
// позывные «Радио Магазинчик» (мотив игры в тональности волны). Оркестр в особый день идёт по улице:
// полный звук, только чуть глуше — через стекло витрины.

import { loadAudio } from './audioFiles';
import { busInput, placeAt } from './mixer';
import { jingleNotes, LOOPS, loopKeyAt, smoothSeam, type Key, type StationId } from './playlist';
import { liteMode } from './quality';

/** Что должно звучать: волна, откуда (радио в зале или оркестр на улице) и где по x. */
export interface LoopWant {
  station: StationId;
  kind: 'radio' | 'parade';
  /** Где приёмник (точка мира по x); у оркестра — нет. */
  x?: number;
}

/** Громкость: приёмник — фон зала, тише музыки; оркестр — почти как музыка. */
const LEVEL = { radio: 0.6, parade: 0.85 };
/** «Хрип» маленького динамика: насыщение tanh — тихое почти не меняется, пики чуть округляются. */
const DRIVE = 1.6;
/** Шипение настройки и позывные, секунды. */
const TUNE_LEN = 0.75;
const JINGLE_LEN = 1.6;
/** Не скачалось — через сколько секунд попробовать снова. */
const RETRY_MS = 15000;

let shaperCurve: Float32Array<ArrayBuffer> | null = null;
function softClip(): Float32Array<ArrayBuffer> {
  if (!shaperCurve) {
    const n = 1024;
    shaperCurve = new Float32Array(n);
    for (let i = 0; i < n; i++) shaperCurve[i] = Math.tanh(DRIVE * ((i / (n - 1)) * 2 - 1)) / Math.tanh(DRIVE);
  }
  return shaperCurve;
}

/** Цепочка звука: вход → «динамик» (у радио) или «стекло» (у оркестра) → громкость → сторона → канал «Музыка». */
interface Chain {
  input: GainNode;
  level: GainNode;
  /** Громкость посреди экрана (у радио — с поправкой на насыщение). */
  base: number;
  panner: StereoPannerNode | null;
  kind: LoopWant['kind'];
  /** Где он сейчас по сторонам и громкости — чтобы не дёргать параметры каждые четверть секунды зря. */
  at?: { pan: number; gain: number };
}

function chain(ac: AudioContext, kind: LoopWant['kind']): Chain {
  const input = ac.createGain();
  let node: AudioNode = input;
  const link = (next: AudioNode) => {
    node.connect(next);
    node = next;
  };
  const filter = (type: BiquadFilterType, freq: number, q = 0.707, gain = 0): BiquadFilterNode => {
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    f.gain.value = gain;
    return f;
  };
  let level = LEVEL[kind];
  if (kind === 'radio') {
    // Маленький динамик: баса нет совсем (две ступени среза), верх до 5 кГц, «нос» около 1.6 кГц.
    link(filter('highpass', 300));
    link(filter('highpass', 300));
    link(filter('lowpass', 5000));
    // На слабом телефоне — без «носа» и хрипа: полосы хватает, чтобы звучало как приёмник.
    if (!liteMode()) {
      link(filter('peaking', 1600, 0.9, 4));
      const shaper = ac.createWaveShaper();
      shaper.curve = softClip();
      link(shaper);
      // Насыщение поднимает тихое в DRIVE/tanh(DRIVE) раз — возвращаем уровень.
      level *= Math.tanh(DRIVE) / DRIVE;
    }
  } else {
    // Оркестр за витриной: самый низ и самый верх глуше.
    link(filter('highpass', 90));
    link(filter('lowpass', 6000));
  }
  const gain = ac.createGain();
  gain.gain.value = level;
  link(gain);
  // Старый Safari без StereoPanner — просто посередине.
  const panner = typeof ac.createStereoPanner === 'function' ? ac.createStereoPanner() : null;
  if (panner) link(panner);
  node.connect(busInput(ac, 'music'));
  return { input, level: gain, base: level, panner, kind };
}

/** Сторона и громкость приёмника по месту на экране (у оркестра — посередине). */
function place(c: Chain, ac: AudioContext, x: number | undefined, tau = 0.15): void {
  if (c.kind !== 'radio') return;
  const where = placeAt(x);
  if (c.at && Math.abs(c.at.pan - where.pan) < 0.01 && Math.abs(c.at.gain - where.gain) < 0.01) return;
  c.at = { pan: where.pan, gain: where.gain };
  const now = ac.currentTime;
  c.panner?.pan.setTargetAtTime(where.pan, now, tau);
  c.level.gain.setTargetAtTime(c.base * where.gain, now, tau);
}

function dispose(c: Chain, after: number): void {
  setTimeout(() => c.input.disconnect(), after * 1000);
}

interface LoopVoice {
  station: StationId;
  chain: Chain;
  src: AudioBufferSourceNode;
  fade: GainNode;
  /** Когда запущена (часы звука) и с какого места файла. */
  at: number;
  offset: number;
}

/** Общий кусок шума для шипения настройки. */
let noise: AudioBuffer | null = null;
function noiseOf(ac: AudioContext): AudioBuffer {
  if (!noise || noise.sampleRate !== ac.sampleRate) {
    noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noise;
}

/** Петля по кругу: радио в зале или оркестр на улице — одна за раз (при смене — плавно). */
export class LoopPlayer {
  private voice: LoopVoice | null = null;
  private wantKey = '';
  private loads = 0;
  private loading = 0;
  private retryAt = 0;
  /** Шипение и позывные, что ещё звучат или ждут своей очереди: снова крутанули ручку — их убрать. */
  private fx: Chain[] = [];

  /**
   * Каждые четверть секунды: что должно звучать (null — тишина). tuned — волну только что сменил
   * сам игрок: шипение настройки и позывные, а выключил — щелчок.
   */
  update(ac: AudioContext, want: LoopWant | null, tuned = false): void {
    const key = want ? `${want.kind}:${want.station}` : '';
    if (key !== this.wantKey) {
      this.wantKey = key;
      this.switchTo(ac, want, tuned);
    } else if (want && !this.voice && !this.loading && performance.now() >= this.retryAt) {
      this.switchTo(ac, want, false);
    }
    if (want && this.voice) place(this.voice.chain, ac, want.x);
  }

  /** Звучит ли сейчас петля. */
  get active(): boolean {
    return this.voice !== null;
  }

  /** Тональность того, что звучит сейчас (заставки подстраиваются), null — ничего не играет. */
  key(now: number): Key | null {
    const v = this.voice;
    if (!v) return null;
    const loop = LOOPS[v.station];
    return loopKeyAt(loop, v.offset - loop.loopStart + Math.max(0, now - v.at));
  }

  /** Убрать сразу (музыку выключили). */
  stop(): void {
    this.wantKey = '';
    this.loading = 0;
    if (this.voice) this.release(this.voice, 0.3);
    this.voice = null;
  }

  /** Для отладки: разобранная петля, что сейчас звучит (проверить шов). */
  buffer(): AudioBuffer | null {
    return this.voice?.src.buffer ?? null;
  }

  /** Для отладки: что играет и откуда. */
  debug(): Record<string, unknown> | null {
    const v = this.voice;
    if (!v) return this.loading ? { loading: this.wantKey } : null;
    const b = v.src.buffer!;
    const loop = LOOPS[v.station];
    return {
      station: v.station,
      kind: v.chain.kind,
      duration: b.duration,
      sampleRate: b.sampleRate,
      loop: [v.src.loopStart, v.src.loopEnd],
      loopLength: loop.loopEnd - loop.loopStart,
      pan: v.chain.panner?.pan.value,
      level: v.chain.level.gain.value,
      key: this.key(v.src.context.currentTime),
    };
  }

  private switchTo(ac: AudioContext, want: LoopWant | null, tuned: boolean): void {
    const old = this.voice;
    this.voice = null;
    for (const c of this.fx) c.input.gain.setTargetAtTime(0, ac.currentTime, 0.02);
    this.fx = [];
    // Ручку крутят только у приёмника: оркестр приходит и уходит сам.
    const tune = tuned && (want ? want.kind === 'radio' : old?.chain.kind === 'radio');
    if (old) this.release(old, tune ? 0.25 : 1.5);
    if (!want) {
      this.loading = 0;
      if (tune && old) this.click(ac, old.chain);
      return;
    }
    if (tune) this.tuning(ac, want.x);
    const token = ++this.loads;
    this.loading = token;
    const ready = ac.currentTime + (tune ? TUNE_LEN : 0);
    const loop = LOOPS[want.station];
    loadAudio(ac, loop.path, { lean: true, keep: true })
      .then((buffer) => {
        if (this.loading !== token) return;
        this.loading = 0;
        smoothSeam(Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c)), buffer.sampleRate, loop);
        let at = Math.max(ac.currentTime + 0.05, ready);
        if (tune) {
          this.jingle(ac, want, at);
          at += JINGLE_LEN;
        }
        this.voice = this.play(ac, want, buffer, at, tune ? 0.8 : 2);
      })
      .catch(() => {
        if (this.loading !== token) return;
        this.loading = 0;
        this.retryAt = performance.now() + RETRY_MS;
      });
  }

  private play(ac: AudioContext, want: LoopWant, buffer: AudioBuffer, at: number, fadeIn: number): LoopVoice {
    const loop = LOOPS[want.station];
    const c = chain(ac, want.kind);
    place(c, ac, want.x, 0.01);
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.loopStart = loop.loopStart;
    src.loopEnd = loop.loopEnd;
    const fade = ac.createGain();
    fade.gain.value = 0;
    fade.gain.setValueAtTime(0, at);
    fade.gain.linearRampToValueAtTime(1, at + fadeIn);
    src.connect(fade).connect(c.input);
    // Радио не начинается с начала песни: включили — а там уже середина.
    const offset = loop.loopStart + Math.random() * (loop.loopEnd - loop.loopStart);
    src.start(at, offset);
    src.onended = () => {
      src.disconnect();
      fade.disconnect();
      c.input.disconnect();
    };
    return { station: want.station, chain: c, src, fade, at, offset };
  }

  private release(v: LoopVoice, seconds: number): void {
    const ac = v.src.context;
    const now = ac.currentTime;
    v.fade.gain.cancelScheduledValues(now);
    v.fade.gain.setValueAtTime(v.fade.gain.value, now);
    v.fade.gain.linearRampToValueAtTime(0, now + seconds);
    try {
      v.src.stop(now + seconds + 0.05);
    } catch {
      // ещё не запущен — onended не придёт, отключим сами
      v.src.disconnect();
      v.chain.input.disconnect();
    }
  }

  /** Шипение настройки: шум «проезжает» по полосе, пара свистов соседних станций. */
  private tuning(ac: AudioContext, x?: number): void {
    const c = chain(ac, 'radio');
    this.fx.push(c);
    place(c, ac, x, 0.01);
    const now = ac.currentTime + 0.01;
    const src = ac.createBufferSource();
    src.buffer = noiseOf(ac);
    const band = ac.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 2.5;
    band.frequency.setValueAtTime(600, now);
    band.frequency.exponentialRampToValueAtTime(3200, now + 0.3);
    band.frequency.exponentialRampToValueAtTime(900, now + TUNE_LEN - 0.05);
    const g = ac.createGain();
    g.gain.value = 0;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.9, now + 0.04);
    g.gain.setValueAtTime(0.7, now + TUNE_LEN - 0.25);
    g.gain.linearRampToValueAtTime(0, now + TUNE_LEN);
    src.connect(band).connect(g).connect(c.input);
    src.start(now, Math.random() * 0.2);
    src.stop(now + TUNE_LEN + 0.05);
    for (const [at, from, to] of [
      [0.12, 1900, 950],
      [0.42, 2500, 3100],
    ]) {
      const osc = ac.createOscillator();
      osc.frequency.setValueAtTime(from, now + at);
      osc.frequency.exponentialRampToValueAtTime(to, now + at + 0.2);
      const og = ac.createGain();
      og.gain.value = 0;
      og.gain.setValueAtTime(0, now + at);
      og.gain.linearRampToValueAtTime(0.08, now + at + 0.03);
      og.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.2);
      osc.connect(og).connect(c.input);
      osc.start(now + at);
      osc.stop(now + at + 0.22);
    }
    dispose(c, TUNE_LEN + 1);
  }

  /** Позывные «Радио Магазинчик»: мотив игры звонким вибрафоном в тональности волны. */
  private jingle(ac: AudioContext, want: LoopWant, at: number): void {
    const c = chain(ac, 'radio');
    this.fx.push(c);
    place(c, ac, want.x, 0.01);
    for (const n of jingleNotes(LOOPS[want.station].key)) {
      const f = 440 * 2 ** ((n.midi - 69) / 12);
      // Основной тон, октава и «звон» 4-го призвука (гаснет быстрее).
      for (const [ratio, vol, ring] of [
        [1, 0.4, 1],
        [2, 0.1, 0.6],
        [4, 0.07, 0.3],
      ]) {
        const t0 = at + n.at;
        const end = t0 + (n.dur + 0.3) * ring;
        const osc = ac.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f * ratio;
        const g = ac.createGain();
        g.gain.value = 0;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(vol, t0 + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, end);
        osc.connect(g).connect(c.input);
        osc.start(t0);
        osc.stop(end + 0.02);
      }
    }
    dispose(c, at - ac.currentTime + JINGLE_LEN + 1);
  }

  /** Щелчок выключателя. */
  private click(ac: AudioContext, c: Chain): void {
    const now = ac.currentTime + 0.01;
    const src = ac.createBufferSource();
    src.buffer = noiseOf(ac);
    const g = ac.createGain();
    g.gain.value = 0;
    g.gain.setValueAtTime(0.35, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
    const out = chain(ac, 'radio');
    out.panner?.pan.setValueAtTime(c.panner?.pan.value ?? 0, now);
    src.connect(g).connect(out.input);
    src.start(now, Math.random() * 0.5);
    src.stop(now + 0.05);
    dispose(out, 1);
  }
}
