// Голоса героев без WebAudio: кто как говорит, какой слог «произнести» на напечатанных буквах,
// как идёт интонация фразы и когда пора следующий слог. Бормотание, как в Animal Crossing: слова
// неразборчивы, но звучат по-русски — слоги из банка (art/sfx/voice.py) берутся по самим буквам текста,
// у каждого героя свой голос, а эмоция портрета меняет тон. Чистые функции — их проверяют тесты
// (tests/babble.test.ts), а sound.ts только играет то, что решено здесь.

import type { Mood } from '../game/story';
import { ONSETS, VOWELS } from './sfxData';

export interface Voice {
  /** Банк слогов: низкий (мужской) или высокий (женский) голос. */
  bank: 'low' | 'high';
  /** Скорость воспроизведения слога: выше — и голос выше, и слог короче (дети — ~1.25). */
  rate: number;
  /** Секунд между слогами: бабушка не торопится, Соня тараторит. */
  gap: number;
  /** Громкость (1 — как у всех). */
  gain: number;
  /** Срез верхов, Гц: ниже — голос мягче, глуше. */
  tone: number;
  /** «Звонкость» около 2.5 кГц, дБ: злость — резче, грусть — тусклее. */
  bright: number;
  /** Размах интонации, полутоны. */
  swing: number;
  /** Какую долю слога играть: злой голос обрывает слоги. */
  clip: number;
  /** Куда уходит тон за фразу, полутоны: грусть — вниз, удивление — вверх. */
  lift: number;
  /** Высота прежнего «пика», Гц, — пока банк слогов не скачан. */
  pitch: number;
}

type Base = Omit<Voice, 'lift' | 'clip' | 'pitch'> & { clip?: number };

/** Голоса героев (имя — из имени портрета: portrait_grandma_sad → grandma). */
const VOICES: Record<string, Base> = {
  // Бабушка: низковатый тёплый голос, неторопливо и мягко.
  grandma: { bank: 'high', rate: 0.86, gap: 0.135, gain: 1, tone: 2600, bright: 0, swing: 2.2 },
  // Валя: голос пожилой соседки — повыше бабушки, но тоже без спешки.
  valya: { bank: 'high', rate: 0.93, gap: 0.115, gain: 1, tone: 3000, bright: 0.5, swing: 2.4 },
  // Соня: детский — высоко и быстро.
  sonya: { bank: 'high', rate: 1.27, gap: 0.078, gain: 0.95, tone: 4600, bright: 1.5, swing: 2.8 },
  // Ведущая новостей: чётко, бодро.
  anchor: { bank: 'high', rate: 1.04, gap: 0.092, gain: 1, tone: 4000, bright: 2, swing: 2.6 },
  // Марат-повар: добродушный, в среднем темпе.
  marat: { bank: 'low', rate: 1, gap: 0.105, gain: 1, tone: 3200, bright: 0, swing: 2 },
  // Эдуард: напористый, быстрый и «в нос».
  eduard: { bank: 'low', rate: 1.08, gap: 0.086, gain: 1, tone: 3800, bright: 3, swing: 2.6 },
  // Папа (сам игрок): спокойный.
  father: { bank: 'low', rate: 0.96, gap: 0.108, gain: 1, tone: 3000, bright: 0, swing: 1.8 },
  // Проверяющий: сухо и отрывисто, почти без интонации.
  inspector: { bank: 'low', rate: 1.04, gap: 0.09, gain: 0.95, tone: 3400, bright: 1, swing: 1.1, clip: 0.85 },
  // Участковый: басовитый и неспешный.
  police: { bank: 'low', rate: 0.9, gap: 0.118, gain: 1, tone: 2800, bright: 0, swing: 1.4 },
};

/** Эмоция портрета: радость — выше и звонче, грусть — ниже, тише и медленнее, злость — резче и отрывистее. */
const MOODS: Record<Mood, { rate: number; gap: number; gain: number; tone: number; bright: number; swing: number; clip: number; lift: number }> = {
  happy: { rate: 1.06, gap: 0.92, gain: 1, tone: 1.2, bright: 2, swing: 1.35, clip: 1, lift: 0.5 },
  sad: { rate: 0.93, gap: 1.25, gain: 0.8, tone: 0.7, bright: -2, swing: 0.6, clip: 1, lift: -1.5 },
  angry: { rate: 1, gap: 0.88, gain: 1.15, tone: 1.3, bright: 4, swing: 0.9, clip: 0.8, lift: 0 },
  surprised: { rate: 1.08, gap: 0.95, gain: 1.05, tone: 1.15, bright: 2, swing: 1.6, clip: 1, lift: 1.5 },
};

const MOOD_RE = /_(happy|sad|angry|surprised)$/;

/** Кто говорит и с каким настроением — по имени портрета (portrait_grandma_sad → grandma, sad). */
export function speakerOf(portrait: string): { who: string; mood?: Mood } {
  const name = portrait.replace(/^.*\//, '').replace(/\.png$/, '').replace(/^portrait_/, '');
  const mood = MOOD_RE.exec(name)?.[1] as Mood | undefined;
  return { who: name.replace(MOOD_RE, ''), mood };
}

/** Голос незнакомца (поставщики и прочие) — по высоте прежнего «пика»: высокий — женский банк. */
function byPitch(pitch: number): Base {
  const high = pitch >= 450;
  const rate = Math.min(1.25, Math.max(0.85, pitch / (high ? 600 : 320)));
  return { bank: high ? 'high' : 'low', rate, gap: 0.1, gain: 1, tone: 3200, bright: 0, swing: 2 };
}

/** Голос героя в диалоге: по портрету (кто и с какой эмоцией); pitch — запасной вариант и прежний «пик». */
export function voiceOf(portrait: string, pitch: number): Voice {
  const { who, mood } = speakerOf(portrait);
  const base = VOICES[who] ?? byPitch(pitch);
  const m = mood ? MOODS[mood] : undefined;
  return {
    bank: base.bank,
    rate: base.rate * (m?.rate ?? 1),
    gap: base.gap * (m?.gap ?? 1),
    gain: base.gain * (m?.gain ?? 1),
    tone: base.tone * (m?.tone ?? 1),
    bright: base.bright + (m?.bright ?? 0),
    swing: base.swing * (m?.swing ?? 1),
    clip: Math.min(base.clip ?? 1, m?.clip ?? 1),
    lift: m?.lift ?? 0,
    pitch: pitch * (m?.rate ?? 1),
  };
}

// ---------- Буквы → слог ----------

const VOWEL_OF: Record<string, number> = {};
const ONSET_OF: Record<string, number> = {};
const vowel = (letters: string, v: (typeof VOWELS)[number]) => {
  for (const ch of letters) VOWEL_OF[ch] = VOWELS.indexOf(v);
};
const onset = (letters: string, o: (typeof ONSETS)[number]) => {
  for (const ch of letters) ONSET_OF[ch] = ONSETS.indexOf(o);
};
vowel('аяa', 'a');
vowel('оёo', 'o');
vowel('уюu', 'u');
vowel('эеe', 'e');
vowel('иi', 'i');
vowel('ыy', 'y');
onset('мm', 'm');
onset('нn', 'n');
onset('лl', 'l');
onset('рr', 'r');
onset('бb', 'b');
onset('дd', 'd');
onset('пp', 'p');
onset('тt', 't');
onset('кгхkgcqx', 'k');
onset('вфvfw', 'v');
onset('сзцsz', 's');
onset('шщжчj', 'sh');

const isLetter = (ch: string | undefined): boolean => ch !== undefined && /[\p{L}\p{N}]/u.test(ch);

/**
 * Слог для напечатанного куска текста [from, to): последний гласный в нём и согласный перед ним
 * («здравствуй» → «ву»); гласного нет — берём ближайший следующий, нет и его — «а».
 * Возвращает номер слога в банке: начало × VOWELS.length + гласный.
 */
export function syllableAt(chars: readonly string[], from: number, to: number): number {
  let at = -1;
  for (let i = Math.min(to, chars.length) - 1; i >= Math.max(0, from); i--) {
    if (VOWEL_OF[chars[i].toLowerCase()] !== undefined) {
      at = i;
      break;
    }
  }
  for (let i = to; at < 0 && i < Math.min(chars.length, to + 4); i++) if (VOWEL_OF[chars[i].toLowerCase()] !== undefined) at = i;
  const v = at >= 0 ? VOWEL_OF[chars[at].toLowerCase()] : 0;
  const before = at > 0 ? chars[at - 1].toLowerCase() : '';
  const o = ONSET_OF[before] ?? 0;
  return o * VOWELS.length + v;
}

// ---------- Интонация ----------

const STOP = /[.!?…]/;

/**
 * Высота слога на месте i фразы, полутоны: к концу предложения голос опускается, перед «?» —
 * поднимается, «!» — всё предложение чуть выше; соседние слоги немного разные, как в живой речи.
 */
export function intonation(chars: readonly string[], i: number, swing: number): number {
  let start = 0;
  for (let k = Math.min(i, chars.length) - 1; k >= 0; k--) {
    if (STOP.test(chars[k])) {
      start = k + 1;
      break;
    }
  }
  let end = chars.length;
  let mark = '.';
  for (let k = Math.max(i, 0); k < chars.length; k++) {
    if (STOP.test(chars[k])) {
      end = k;
      mark = chars[k];
      break;
    }
  }
  const p = end > start ? Math.min(1, Math.max(0, (i - start) / (end - start))) : 0.5;
  let st = swing * 0.3 * (1 - 2 * p);
  if (mark === '?' && p > 0.65) st += swing * 1.4 * ((p - 0.65) / 0.35);
  else if (mark === '!') st += swing * 0.4;
  else if (p > 0.75) st -= swing * 0.5 * ((p - 0.75) / 0.25);
  // Слоги чуть пляшут вокруг линии фразы: детерминированно, чтобы фраза звучала одинаково.
  st += (((i * 7919) % 5) - 2) * 0.12 * swing;
  return st;
}

// ---------- Когда говорить ----------

/** Предел интонации, полутоны. */
export const MAX_SHIFT = 5;

export interface Syllable {
  /** Номер слога в банке (начало × VOWELS.length + гласный). */
  index: number;
  /** Сдвиг высоты, полутоны (интонация и эмоция). */
  semitones: number;
}

/**
 * Бормотание по мере печати: на букве, если с прошлого слога прошло не меньше gap; знаки препинания
 * дают паузу (запятая — короткую, точка — длиннее), пробелы и цифры — без своего слога.
 */
export class Babbler {
  private last = -Infinity;
  private from = 0;
  private paused = -1;
  private spoken = 0;

  constructor(
    readonly voice: Voice,
    private readonly chars: readonly string[],
  ) {}

  /** Напечатано shown букв к моменту now (секунды): слог или null. */
  next(shown: number, now: number): Syllable | null {
    if (shown <= this.from || shown > this.chars.length) return null;
    const ch = this.chars[shown - 1];
    if (!isLetter(ch)) {
      // Пауза: после запятой следующий слог — не раньше чем через 0.6 gap, после точки — через целый gap.
      if (this.paused !== shown && /[,;:—–-]/.test(ch)) this.last = Math.max(this.last, now - this.voice.gap * 0.4);
      else if (this.paused !== shown && STOP.test(ch)) this.last = Math.max(this.last, now);
      this.paused = shown;
      return null;
    }
    if (now - this.last < this.voice.gap) return null;
    const index = syllableAt(this.chars, this.from, shown);
    const total = this.chars.length || 1;
    // Не дальше кварты от своего голоса: выше слог звучит уже «бурундуком», ниже — гулко.
    const semitones = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, intonation(this.chars, shown - 1, this.voice.swing) + this.voice.lift * (shown / total)));
    this.from = shown;
    this.last = now;
    this.spoken++;
    return { index, semitones };
  }

  /** Сколько слогов уже сказано. */
  get count(): number {
    return this.spoken;
  }
}

/**
 * Вся фраза сразу (пример голоса в настройках): какой слог и через сколько секунд от начала,
 * как если бы текст печатался по charMs на букву.
 */
export function speak(text: string, voice: Voice, charMs = 26): { at: number; syllable: Syllable }[] {
  const chars = [...text];
  const talk = new Babbler(voice, chars);
  const out: { at: number; syllable: Syllable }[] = [];
  for (let shown = 1; shown <= chars.length; shown++) {
    const at = (shown * charMs) / 1000;
    const s = talk.next(shown, at);
    if (s) out.push({ at, syllable: s });
  }
  return out;
}
