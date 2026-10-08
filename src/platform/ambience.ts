// Звуки окружения: шум дождя и грозы, гул улицы, проезжающие машины, гул холодильников,
// шаги продавца и колокольчик на двери. Всё синтезируется WebAudio из шума и простых волн.
// Выключаются вместе со звуками.

import type { Weather } from '../game/weather';
import { existingAudioContext, noiseBuffer, sound } from './sound';

interface Bed {
  gain: GainNode;
}

let master: GainNode | null = null;
let beds: Record<'rain' | 'storm' | 'street' | 'hum', Bed> | null = null;
let noise: AudioBuffer | null = null;

/** Петля шума через фильтр: дождь, ветер, улица. */
function noiseBed(ac: AudioContext, type: BiquadFilterType, freq: number, q = 0.7): Bed {
  const src = ac.createBufferSource();
  src.buffer = noise!;
  src.loop = true;
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ac.createGain();
  gain.gain.value = 0;
  src.connect(filter).connect(gain).connect(master!);
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
  beds = {
    rain: noiseBed(ac, 'bandpass', 2400, 0.5),
    storm: noiseBed(ac, 'lowpass', 260),
    street: noiseBed(ac, 'lowpass', 380),
    hum: humBed(ac),
  };
}

/** Плавно к нужной громкости — без щелчков. */
function fade(bed: Bed, ac: AudioContext, target: number): void {
  if (Math.abs(bed.gain.gain.value - target) < 0.0005) return;
  bed.gain.gain.setTargetAtTime(target, ac.currentTime, 0.4);
}

function blip(at: (ac: AudioContext, out: AudioNode) => void): void {
  const ac = existingAudioContext();
  if (!ac || !master || sound.isMuted()) return;
  at(ac, master);
}

export const ambience = {
  /** Каждый кадр: громкость фоновых звуков под погоду, время суток и где сейчас игрок. */
  update(weather: Weather, evening: number, open: boolean): void {
    const ac = existingAudioContext();
    if (!ac) return;
    if (!beds) build(ac);
    const muted = sound.isMuted();
    const wet = weather === 'rain' || weather === 'storm';
    fade(beds!.rain, ac, muted || !wet ? 0 : weather === 'storm' ? 0.07 : 0.045);
    fade(beds!.storm, ac, muted || weather !== 'storm' ? 0 : 0.05);
    fade(beds!.street, ac, muted || !open ? 0 : 0.03 * (1 - 0.6 * evening));
    fade(beds!.hum, ac, muted || !open ? 0 : 0.006);
  },

  /** Мимо проехала машина: шум нарастает и спадает. */
  carPass(): void {
    blip((ac, out) => {
      const now = ac.currentTime;
      const src = ac.createBufferSource();
      src.buffer = noise;
      const filter = ac.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(300, now);
      filter.frequency.linearRampToValueAtTime(900, now + 1.2);
      filter.frequency.linearRampToValueAtTime(250, now + 2.6);
      const gain = ac.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 1.2);
      gain.gain.linearRampToValueAtTime(0, now + 2.6);
      src.connect(filter).connect(gain).connect(out);
      src.start(now);
      src.stop(now + 2.7);
    });
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
