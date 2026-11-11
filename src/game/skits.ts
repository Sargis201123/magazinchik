// «Сценки дня» (11.11, идея автора: доп. сюжеты с выбором и сценками; на время сюжета магазин на паузе).
// Посреди рабочего дня в магазин заходит житель района со своей историей, магазин замирает (scenes/skitsFx.ts),
// и идёт разговор с портретами (ui/skits.ts). Каждая сценка — маленькое приключение на один визит: развилки по
// 2–4 варианта, 3–5 решений подряд, несколько концовок — от провала до лучшего финала. Детектив «Меня ограбили»
// (расспросить, посмотреть камеру, допросить трёх подозреваемых и указать на вора), «Крупная купюра» (распознать
// фальшивку), «Прямой эфир» (три вопроса блогера — финал по набранным очкам), «Пирожки Лёши» (выбрать начинку,
// цену и долю), «Подарок учительнице» (угадать по подсказкам), «Где Бублик?» (найти щенка), «Курьер в ливень».
// Финал даёт деньги, рейтинг или гостей на несколько дней; неудачный — немного рейтинга или денег.
//
// Каждая сценка — один раз. Когда и какая — от дня и зерна магазина (как хроники района, arcs.ts): перезапуск дня
// ничего не перекатывает, а общий генератор случайностей (симулятор) не сдвигается. Не в первые тихие дни, не в
// особые дни и не в день, когда утром ждёт своя история постоянного (tales.ts).

import { onShelves, warehouseOf, type ProductId, type StoreState } from './economy';
import { take, taleToday } from './tales';
import { bigDayFor } from './bigday';
import { quietDays } from './firstday';
import { inZar } from './zarechye';
import { isWet, weatherFor } from './weather';
import { rng } from './random';

export type SkitId = 'robbery' | 'puppy' | 'counterfeit' | 'pies' | 'gift' | 'blogger' | 'rain';
export type SkitMood = 'happy' | 'sad' | 'surprised' | 'angry' | null;
export type SkitTone = 'great' | 'good' | 'ok' | 'bad';

export interface SkitEffect {
  money?: number;
  rating?: number;
  /** Больше гостей: на сколько (0.1 = +10%) и сколько дней. */
  boost?: [number, number];
  /** Отдать товар (с полок, потом со склада). */
  take?: [ProductId, number];
}

export interface SkitOption {
  /** Куда ведёт ответ (узел той же сценки). */
  to: string;
  /** Что ответ стоит сразу (отдать товар, заплатить). */
  effect?: SkitEffect;
  /** Очки за ответ: финал «по очкам» (byScore) выбирается по их сумме. */
  score?: number;
}

export interface SkitNode {
  /** Кто говорит (ключ в cast) и с каким лицом. Текст — skit.<id>.<узел>, варианты — skit.<id>.<узел>.<i>. */
  who: string;
  mood: SkitMood;
  options?: SkitOption[];
  /** Узел-развилка по очкам: [сколько нужно, куда] по убыванию; последний — для всех остальных. Без реплики. */
  byScore?: [number, string][];
  /** Финал: итог разговора. */
  end?: { tone: SkitTone; effect: SkitEffect };
}

export interface Skit {
  /** С какого дня история может случиться. */
  from: number;
  /** Только в дождь (курьер прячется от ливня). */
  wet?: boolean;
  /** Кто приходит в зал (ключ в cast) — его и видно у кассы. */
  guest: string;
  /** Портреты героев: ключ → имя картинки без portrait_ и настроения. Имена — skit.<id>.cast.<ключ>. */
  cast: Record<string, string>;
  start: string;
  nodes: Record<string, SkitNode>;
}

const end = (who: string, mood: SkitMood, tone: SkitTone, effect: SkitEffect = {}): SkitNode => ({ who, mood, end: { tone, effect } });

export const SKITS: Record<SkitId, Skit> = {
  // Детектив: у входа вырвали сумочку. Улики — запах краски, капюшон, свежая белая краска на перилах (видел Фёдор
  // Иванович) и пятно на рукаве (камера). Подозреваемых трое, у каждого — три вопроса; кто-то путается в показаниях.
  // Вор — парень в капюшоне: «облокотился» на те самые перила. Прижать его уликой — признается (лучший финал);
  // просто указать на него — тоже поймали, но похуже; на другого — ошибка.
  robbery: {
    from: 10,
    guest: 'galina',
    cast: { galina: 'skit_galina', fyodor: 'skit_fyodor', police: 'police', ruslan: 'skit_ruslan', painter: 'skit_painter', hoodie: 'skit_hoodie' },
    start: 'start',
    nodes: {
      start: { who: 'galina', mood: 'sad', options: [{ to: 'describe' }, { to: 'police' }, { to: 'witness' }] },
      describe: { who: 'galina', mood: 'sad', options: [{ to: 'camera' }, { to: 'witness' }, { to: 'police' }] },
      witness: { who: 'fyodor', mood: 'surprised', options: [{ to: 'police' }, { to: 'camera' }] },
      camera: { who: 'galina', mood: 'surprised', options: [{ to: 'police' }] },
      police: { who: 'police', mood: null, options: [{ to: 'ruslan' }, { to: 'painter' }, { to: 'hoodie' }, { to: 'accuse' }] },
      ruslan: { who: 'ruslan', mood: 'sad', options: [{ to: 'ruslanWhere' }, { to: 'ruslanRun' }, { to: 'ruslanSleeves' }, { to: 'police' }] },
      ruslanWhere: { who: 'ruslan', mood: null, options: [{ to: 'ruslan' }] },
      ruslanRun: { who: 'ruslan', mood: 'sad', options: [{ to: 'ruslan' }] },
      ruslanSleeves: { who: 'ruslan', mood: 'happy', options: [{ to: 'ruslan' }] },
      painter: { who: 'painter', mood: 'angry', options: [{ to: 'painterWhere' }, { to: 'painterSmell' }, { to: 'painterRun' }, { to: 'police' }] },
      painterWhere: { who: 'painter', mood: null, options: [{ to: 'painter' }] },
      painterSmell: { who: 'painter', mood: 'angry', options: [{ to: 'painter' }] },
      painterRun: { who: 'painter', mood: null, options: [{ to: 'painter' }] },
      hoodie: { who: 'hoodie', mood: 'surprised', options: [{ to: 'hoodieWhere' }, { to: 'hoodieRun' }, { to: 'hoodieSleeve' }, { to: 'police' }] },
      hoodieWhere: { who: 'hoodie', mood: 'sad', options: [{ to: 'hoodie' }] },
      hoodieRun: { who: 'hoodie', mood: 'surprised', options: [{ to: 'hoodie' }] },
      hoodieSleeve: { who: 'hoodie', mood: 'surprised', options: [{ to: 'confess' }, { to: 'hoodie' }] },
      confess: { who: 'hoodie', mood: 'sad', options: [{ to: 'right' }] },
      accuse: { who: 'police', mood: null, options: [{ to: 'wrong' }, { to: 'wrong' }, { to: 'rightGuess' }] },
      right: end('galina', 'happy', 'great', { money: 400, rating: 0.12, boost: [0.1, 5] }),
      rightGuess: end('galina', 'happy', 'good', { money: 200, rating: 0.06 }),
      wrong: end('police', 'sad', 'bad', { rating: -0.04 }),
    },
  },
  // Найти щенка: обойти места (пекарня, парк, курьер) — следы ведут к парковке; выманить — лучше всего колбасой.
  puppy: {
    from: 6,
    guest: 'tyoma',
    cast: { tyoma: 'skit_tyoma', sveta: 'caller2', ruslan: 'skit_ruslan' },
    start: 'start',
    nodes: {
      start: { who: 'tyoma', mood: 'sad', options: [{ to: 'about' }, { to: 'announce' }, { to: 'cold' }] },
      cold: end('tyoma', 'sad', 'ok'),
      about: { who: 'tyoma', mood: 'sad', options: [{ to: 'hub' }] },
      announce: { who: 'sveta', mood: null, options: [{ to: 'hub' }] },
      hub: { who: 'tyoma', mood: null, options: [{ to: 'bakery' }, { to: 'park' }, { to: 'courier' }, { to: 'lure' }] },
      bakery: { who: 'tyoma', mood: 'sad', options: [{ to: 'hub' }] },
      park: { who: 'tyoma', mood: 'surprised', options: [{ to: 'hub' }] },
      courier: { who: 'ruslan', mood: 'happy', options: [{ to: 'hub' }] },
      lure: { who: 'tyoma', mood: null, options: [{ to: 'foundShop', effect: { take: ['meat', 1] } }, { to: 'found' }, { to: 'waited' }] },
      found: end('tyoma', 'happy', 'good', { rating: 0.05, boost: [0.06, 5] }),
      foundShop: end('tyoma', 'happy', 'great', { rating: 0.07, boost: [0.1, 5] }),
      waited: end('tyoma', null, 'ok', { rating: 0.02 }),
    },
  },
  // Фальшивая купюра: осмотреть её (просвет, бумага, откуда) — и решить; отдал сдачу — ещё можно догнать.
  counterfeit: {
    from: 8,
    guest: 'viktor',
    cast: { viktor: 'skit_viktor', police: 'police', me: 'father' },
    start: 'start',
    nodes: {
      start: { who: 'viktor', mood: 'happy', options: [{ to: 'accepted' }, { to: 'check' }, { to: 'refuse' }] },
      refuse: end('viktor', 'angry', 'ok'),
      check: { who: 'viktor', mood: 'surprised', options: [{ to: 'light' }, { to: 'touch' }, { to: 'atm' }, { to: 'decide' }] },
      light: { who: 'me', mood: 'surprised', options: [{ to: 'check' }] },
      touch: { who: 'me', mood: null, options: [{ to: 'check' }] },
      atm: { who: 'viktor', mood: 'angry', options: [{ to: 'check' }] },
      decide: { who: 'viktor', mood: 'angry', options: [{ to: 'arrest' }, { to: 'card' }, { to: 'accepted' }] },
      accepted: { who: 'viktor', mood: 'happy', options: [{ to: 'chase' }, { to: 'lost' }] },
      lost: end('police', null, 'bad', { money: -400 }),
      chase: { who: 'viktor', mood: 'surprised', options: [{ to: 'caught' }, { to: 'gaveBack' }] },
      caught: end('police', 'happy', 'good', { money: 300, rating: 0.05 }),
      gaveBack: end('viktor', 'angry', 'ok'),
      arrest: end('police', 'happy', 'great', { money: 500, rating: 0.08 }),
      card: end('viktor', 'sad', 'ok', { rating: 0.02 }),
    },
  },
  // Пирожки: расспросить Лёшу, выбрать начинку, цену, долю и место в зале — финал по очкам.
  pies: {
    from: 9,
    guest: 'lyosha',
    cast: { lyosha: 'skit_lyosha' },
    start: 'start',
    nodes: {
      start: { who: 'lyosha', mood: 'happy', options: [{ to: 'cabbage' }, { to: 'cherry' }, { to: 'meat' }, { to: 'about' }] },
      about: { who: 'lyosha', mood: 'happy', options: [{ to: 'start' }] },
      cabbage: { who: 'lyosha', mood: 'happy', options: [{ to: 'price', score: 2 }, { to: 'start' }] },
      cherry: { who: 'lyosha', mood: null, options: [{ to: 'price', score: 1 }, { to: 'start' }] },
      meat: { who: 'lyosha', mood: 'sad', options: [{ to: 'price', score: 0 }, { to: 'start' }] },
      price: { who: 'lyosha', mood: null, options: [{ to: 'share', score: 2 }, { to: 'share', score: 1 }, { to: 'share', score: 0 }] },
      share: { who: 'lyosha', mood: 'surprised', options: [{ to: 'place', score: 1 }, { to: 'place', score: 2 }, { to: 'place', score: 0 }] },
      place: { who: 'lyosha', mood: null, options: [{ to: 'verdict', score: 2 }, { to: 'verdict', score: 1 }, { to: 'verdict', score: 0 }] },
      verdict: { who: 'lyosha', mood: null, byScore: [[7, 'hit'], [4, 'fine'], [0, 'flop']] },
      hit: end('lyosha', 'happy', 'great', { money: 600, boost: [0.06, 5] }),
      fine: end('lyosha', 'happy', 'good', { money: 250 }),
      flop: end('lyosha', 'sad', 'bad', { money: -100 }),
    },
  },
  // Подарок: расспросить про учительницу (биология, чай, чихает от цветов, не ест сладкое) — и угадать.
  gift: {
    from: 10,
    guest: 'masha',
    cast: { masha: 'skit_masha' },
    start: 'start',
    nodes: {
      start: { who: 'masha', mood: null, options: [{ to: 'hub' }, { to: 'roses' }, { to: 'candy' }] },
      hub: { who: 'masha', mood: 'happy', options: [{ to: 'subject' }, { to: 'loves' }, { to: 'hates' }, { to: 'choose' }] },
      subject: { who: 'masha', mood: 'happy', options: [{ to: 'hub' }] },
      loves: { who: 'masha', mood: 'happy', options: [{ to: 'hub' }] },
      hates: { who: 'masha', mood: 'sad', options: [{ to: 'hub' }] },
      choose: { who: 'masha', mood: 'surprised', options: [{ to: 'tea' }, { to: 'roses' }, { to: 'candy' }, { to: 'seedling' }] },
      roses: { who: 'masha', mood: 'sad', options: [{ to: 'tea' }, { to: 'rosesEnd' }] },
      rosesEnd: end('masha', 'sad', 'bad'),
      candy: { who: 'masha', mood: null, options: [{ to: 'tea' }, { to: 'candyEnd' }] },
      candyEnd: end('masha', 'happy', 'ok', { rating: 0.02 }),
      seedling: end('masha', 'happy', 'good', { rating: 0.05 }),
      tea: { who: 'masha', mood: 'surprised', options: [{ to: 'best', effect: { money: -50 } }, { to: 'good' }, { to: 'later' }] },
      best: end('masha', 'happy', 'great', { rating: 0.08, boost: [0.05, 5] }),
      good: end('masha', 'happy', 'good', { rating: 0.04 }),
      later: end('masha', null, 'ok', { rating: 0.02 }),
    },
  },
  // Прямой эфир: что показать в кадре, три вопроса и тролль в чате — финал по очкам.
  blogger: {
    from: 12,
    guest: 'karina',
    cast: { karina: 'skit_karina' },
    start: 'start',
    nodes: {
      start: { who: 'karina', mood: 'happy', options: [{ to: 'frame' }, { to: 'frame', score: 1 }, { to: 'no' }] },
      no: end('karina', null, 'ok', { boost: [0.03, 2] }),
      frame: { who: 'karina', mood: null, options: [{ to: 'q1', score: 2 }, { to: 'q1', score: 0 }, { to: 'q1', score: 1 }] },
      q1: { who: 'karina', mood: null, options: [{ to: 'q2', score: 2 }, { to: 'q2', score: 0 }, { to: 'q2', score: 1 }] },
      q2: { who: 'karina', mood: null, options: [{ to: 'troll', score: 2 }, { to: 'troll', score: 1 }, { to: 'troll', score: 0 }] },
      troll: { who: 'karina', mood: 'surprised', options: [{ to: 'q3', score: 2 }, { to: 'q3', score: 0 }, { to: 'q3', score: -1 }] },
      q3: { who: 'karina', mood: 'surprised', options: [{ to: 'verdict', score: 2 }, { to: 'verdict', score: 1 }, { to: 'verdict', score: 0 }] },
      verdict: { who: 'karina', mood: null, byScore: [[8, 'viral'], [5, 'nice'], [-99, 'flop']] },
      viral: end('karina', 'surprised', 'great', { rating: 0.05, boost: [0.15, 5] }),
      nice: end('karina', 'happy', 'good', { boost: [0.08, 4] }),
      flop: end('karina', 'sad', 'bad', { rating: -0.03 }),
    },
  },
  // Курьер в ливень: что в заказах (лекарства — срочно!), спасти мороженое, зарядить самокат — и решить, как быть.
  rain: {
    from: 14,
    wet: true,
    guest: 'ruslan',
    cast: { ruslan: 'skit_ruslan', boss: 'caller4' },
    start: 'start',
    nodes: {
      start: { who: 'ruslan', mood: 'sad', options: [{ to: 'inside' }, { to: 'door' }] },
      door: end('ruslan', 'sad', 'ok'),
      inside: { who: 'ruslan', mood: null, options: [{ to: 'orders' }, { to: 'freezer' }, { to: 'charge' }, { to: 'plan' }] },
      orders: { who: 'ruslan', mood: 'sad', options: [{ to: 'inside' }] },
      freezer: { who: 'ruslan', mood: 'happy', options: [{ to: 'inside' }] },
      charge: { who: 'ruslan', mood: 'happy', options: [{ to: 'inside' }] },
      plan: { who: 'ruslan', mood: 'surprised', options: [{ to: 'meds', effect: { rating: 0.05 } }, { to: 'dispatch' }, { to: 'late' }] },
      meds: { who: 'boss', mood: null, options: [{ to: 'deal' }, { to: 'good' }] },
      dispatch: { who: 'boss', mood: null, options: [{ to: 'thanks' }, { to: 'partner' }, { to: 'meh' }] },
      thanks: { who: 'boss', mood: null, options: [{ to: 'good' }] },
      partner: { who: 'boss', mood: null, options: [{ to: 'deal' }, { to: 'good' }] },
      good: end('ruslan', 'happy', 'good', { boost: [0.06, 4] }),
      deal: end('ruslan', 'happy', 'great', { money: 200, boost: [0.12, 7] }),
      late: end('ruslan', 'sad', 'bad', { rating: -0.02 }),
      meh: end('ruslan', 'sad', 'ok'),
    },
  },
};

export const SKIT_IDS = Object.keys(SKITS) as SkitId[];

/** С какого дня сценки, шанс в свободный день и передышка после сценки. */
export const SKIT_FROM = 6;
export const SKIT_CHANCE = 0.45;
export const SKIT_GAP = 2;
/** Сколько шагов разговора самое большее (защита от зацикленного пути). */
export const SKIT_MAX_STEPS = 24;

export interface SkitsState {
  done: SkitId[];
  /** Раньше этого дня новая сценка не начнётся. */
  nextAt?: number;
  /** Прибавка гостей от сценок. */
  boost?: { pct: number; until: number };
}

export const skitsOf = (state: StoreState): SkitsState => ({ done: state.skits?.done ?? [], nextAt: state.skits?.nextAt, boost: state.skits?.boost });

/** Случай дня: от зерна магазина и дня (не общий генератор — симулятор не сдвигается). */
const roll = (state: StoreState, salt: number): number => rng(((state.seed ?? 1) ^ Math.imul(state.day * 131 + salt, 0x9e3779b1)) >>> 0)();

/** Сценка сегодня (или null). Каждая — один раз. */
export function skitToday(state: StoreState): SkitId | null {
  if (inZar(state) || state.day < SKIT_FROM || quietDays(state) || bigDayFor(state.day) || taleToday(state)) return null;
  const skits = skitsOf(state);
  if (state.day < (skits.nextAt ?? 0) || roll(state, 1) >= SKIT_CHANCE) return null;
  const wet = isWet(weatherFor(state.day));
  const options = SKIT_IDS.filter((id) => !skits.done.includes(id) && state.day >= SKITS[id].from && (!SKITS[id].wet || wet));
  if (!options.length) return null;
  return options[Math.floor(roll(state, 2) * options.length)];
}

const stockOf = (state: StoreState, id: ProductId): number => warehouseOf(state, id) + onShelves(state, id);

/** Хватает ли на этот ответ денег и товара. */
export function canPick(state: StoreState, option: SkitOption): boolean {
  const e = option.effect;
  if (!e) return true;
  if (e.money !== undefined && e.money < 0 && state.money < -e.money) return false;
  if (e.take && stockOf(state, e.take[0]) < e.take[1]) return false;
  return true;
}

export interface SkitWalk {
  /** Узел, на котором остановились: реплика с вариантами или финал. */
  node: string;
  /** Какие ответы уже выбирали: «узел:номер» — окно показывает их серыми с галочкой. */
  picked: Set<string>;
  score: number;
  /** Что ответы уже стоили по пути (товар, деньги). */
  spent: SkitEffect[];
}

/** Пройти разговор по выбранным ответам: где оказались и сколько набрали. Развилки по очкам проходятся сами. */
export function walkSkit(id: SkitId, path: number[]): SkitWalk | null {
  const skit = SKITS[id];
  let node = skit.start;
  let score = 0;
  const spent: SkitEffect[] = [];
  const picked = new Set<string>();
  const settle = () => {
    for (let guard = 0; skit.nodes[node]?.byScore && guard < 4; guard++) node = skit.nodes[node].byScore!.find(([min]) => score >= min)?.[1] ?? skit.nodes[node].byScore!.at(-1)![1];
  };
  settle();
  for (const pick of path.slice(0, SKIT_MAX_STEPS)) {
    const option = skit.nodes[node]?.options?.[pick];
    if (!option) return null;
    picked.add(`${node}:${pick}`);
    score += option.score ?? 0;
    if (option.effect) spent.push(option.effect);
    node = option.to;
    settle();
  }
  return skit.nodes[node] ? { node, score, spent, picked } : null;
}

const applyEffect = (state: StoreState, e: SkitEffect): StoreState => {
  let s = state;
  if (e.take) s = take(s, e.take[0], Math.min(e.take[1], stockOf(s, e.take[0])));
  if (e.money) s = { ...s, money: Math.max(0, s.money + e.money) };
  if (e.rating) s = { ...s, rating: Math.round(Math.min(5, Math.max(0, s.rating + e.rating)) * 100) / 100 };
  if (e.boost) {
    const [pct, days] = e.boost;
    const skits = skitsOf(s);
    const still = skits.boost && skits.boost.until >= s.day ? skits.boost : undefined;
    const boost = still && still.pct > pct ? still : { pct, until: s.day + days - 1 };
    s = { ...s, skits: { ...skits, boost } };
  }
  return s;
};

/**
 * Разговор окончен: всё, что стоили ответы по пути, и итог финала; сценка больше не повторится. null — сегодня не
 * эта сценка или путь не ведёт к финалу.
 */
export function finishSkit(state: StoreState, id: SkitId, path: number[]): { state: StoreState; tone: SkitTone; effect: SkitEffect } | null {
  if (skitToday(state) !== id) return null;
  const walk = walkSkit(id, path);
  const node = walk && SKITS[id].nodes[walk.node];
  if (!walk || !node?.end) return null;
  let s = state;
  for (const e of walk.spent) s = applyEffect(s, e);
  s = applyEffect(s, node.end.effect);
  const skits = skitsOf(s);
  s = { ...s, skits: { ...skits, done: [...skits.done, id], nextAt: s.day + SKIT_GAP } };
  return { state: s, tone: node.end.tone, effect: node.end.effect };
}

/**
 * Вопрос-ответ: ответ ведёт в реплику, из которой одна дорога — назад сюда (допрос: «Где вы были?» → ответ →
 * «Другой вопрос»). Такой вопрос второй раз не задают — после ответа кнопка серая и неактивна.
 */
export function askedOnce(id: SkitId, node: string, option: SkitOption): boolean {
  const next = SKITS[id].nodes[option.to]?.options;
  return Boolean(next && next.length === 1 && next[0].to === node);
}

/** Множитель гостей от сценок (мама Тёмы, подписчики Карины, курьеры Руслана…). */
export const skitGuests = (state: StoreState): number => {
  const boost = skitsOf(state).boost;
  return boost && state.day <= boost.until ? 1 + boost.pct : 1;
};

/** У каких портретов есть настроения (у остальных — одно лицо). */
const MOODY = (base: string): boolean => base.startsWith('skit_') || base === 'police' || base === 'father';

/** Портрет героя сценки с настроением. */
export function skitPortrait(id: SkitId, who: string, mood: SkitMood): string {
  const base = SKITS[id].cast[who] ?? SKITS[id].cast[SKITS[id].guest];
  const m = mood === 'angry' && base === 'police' ? null : mood;
  return `portrait_${base}${m && MOODY(base) ? `_${m}` : ''}`;
}
