// Хроники района: истории постоянных после финала. Когда магазин стал «Лучшим магазином района»,
// район не замирает: Ахмед открывает кафе и просит возить ему хлеб, Пётр Ильич и Ольга Николаевна
// расписываются, сын Светы просится на летнюю подработку, Зинаида Павловна уезжает к дочке, в район
// переезжает новая семья, возвращается Эдуард. Каждая история — 2–4 шага с промежутком в 3–5 дней,
// в шаге — одно или два решения с добрыми последствиями (немного денег, рейтинга, доверия, гостей),
// без наказаний. Какая история следующая и через сколько дней шаг — от зерна магазина: перезагрузка
// ничего не перекатывает. Давние игроки, прошедшие пять глав, видят хроники и до финала — реже.
// Как это выглядит в мире — scenes/arcsFx.ts, карточка утра и строка «Вести района» — ui/arcs.ts.

import { CHAPTERS } from './story';
import { hire, onShelves, onShift, roleOpen, staffLimit, staffOf, wageFor, warehouseOf, PRODUCTS, type ProductId, type StaffMember, type StaffRole, type StoreState } from './economy';
import { MAX_LOYALTY, met, regularById, REGULARS, regularState, type RegularId } from './regulars';
import { LIFE } from './life';
import { rng } from './random';
import { take, taleToday } from './tales';

/** Кто в истории: постоянный покупатель или житель района, которого нет среди постоянных. */
export type ArcWho = RegularId | 'zina' | 'family' | 'eduard' | 'valya' | 'zoya' | 'liza';

/** Что видно в мире в день шага: гость у кассы, нарядные покупатели, свадебная машина, грузовик с вещами, дети, бегуны. */
export type ArcShow = 'visit' | 'festive' | 'car' | 'truck' | 'kids' | 'runners';

export interface ArcEffect {
  money?: number;
  rating?: number;
  /** Доверие постоянных: кому и на сколько ('all' — всем знакомым). */
  loyalty?: [RegularId | 'all', number][];
  /** Больше гостей: на сколько и сколько дней (считая сегодня). */
  boost?: [number, number];
  /** Отдать товар в подарок (сколько есть, но не больше). */
  take?: [ProductId, number];
  /** Продать к празднику: товар, штук, цена × множитель за штуку. */
  sell?: [ProductId, number, number];
  /** Договор: возить товар раз в неделю (ARC_DEAL). */
  deal?: boolean;
  /** Взять сына Светы на лето (ARC_HELPER). */
  hire?: boolean;
  /** Лето кончилось: помощник уходит учиться. */
  leave?: boolean;
}

export interface ArcChoice {
  effect: ArcEffect;
  require?: { money?: number; product?: [ProductId, number]; slot?: boolean };
  /** Следующий шаг (по умолчанию — следующий по порядку); -1 — история кончилась. */
  next?: number;
}

export interface ArcBeat {
  /** Чей это шаг (по умолчанию — герой истории). */
  who?: ArcWho;
  show?: ArcShow[];
  /** Что гость держит в руках, когда заходит (wardrobe.ts PROPS). */
  prop?: string;
  /** Один вариант — просто кнопка «дальше» со своим текстом. */
  choices: ArcChoice[];
  /** Последний шаг истории (дальше по порядку не идти). */
  last?: boolean;
  /** Через сколько дней после предыдущего шага: [от, до]; по умолчанию ARC_STEP. */
  gap?: [number, number];
}

export interface Arc {
  icon: string;
  who: ArcWho;
  /** Может ли история начаться сейчас (кто-то должен уже жить в районе). */
  when?: (s: StoreState) => boolean;
  beats: ArcBeat[];
}

export type ArcId =
  | 'cafe'
  | 'wedding'
  | 'summer'
  | 'farewell'
  | 'newcomers'
  | 'eduard'
  | 'jubilee'
  | 'school'
  | 'run'
  | 'books'
  | 'birthday'
  | 'blogger'
  | 'yard'
  | 'harvest';

/** Шаг через 3–5 дней; между историями — тоже 3–5 (до финала, у давних игроков, — 7–10). */
export const ARC_STEP: [number, number] = [3, 5];
export const ARC_EARLY_STEP: [number, number] = [7, 10];
/** До финала хроники идут у тех, кто прошёл пять глав и играет хотя бы столько дней. */
export const ARC_EARLY_DAY = 120;
/** Договор с кафе Ахмеда: хлеб раз в неделю, столько поставок, цена × множитель. */
export const ARC_DEAL = { who: 'akhmed' as RegularId, pid: 'bread' as ProductId, qty: 15, mult: 1.4, every: 7, times: 6 };
/** Сын Светы на лето: опытный (2★), старательный, зарплата — половина обычной; с ним заходят его друзья. */
export const ARC_HELPER = { name: 6, wage: 0.5, guests: 1.03, roles: ['loader', 'cleaner'] as StaffRole[] };

const ok = (effect: ArcEffect = {}, next?: number): ArcChoice => ({ effect, next });
const happened = (s: StoreState, id: string): boolean => s.day >= (LIFE.find((e) => e.id === id)?.day ?? 0);

export const ARCS: Record<ArcId, Arc> = {
  // Ахмед открывает кафе и просит возить хлеб; открытие; кафе прижилось.
  cafe: {
    icon: '🥙',
    who: 'akhmed',
    when: (s) => met(s, regularById('akhmed')),
    beats: [
      { show: ['visit'], prop: 'stringbag', choices: [{ effect: { deal: true, loyalty: [['akhmed', 1]] } }, ok({ loyalty: [['akhmed', 1]] })] },
      {
        show: ['visit'],
        prop: 'balloon',
        choices: [{ effect: { money: -120, rating: 0.05, loyalty: [['akhmed', 1]] }, require: { money: 120 } }, ok({ loyalty: [['akhmed', 1]] })],
      },
      { choices: [ok({ boost: [0.06, 7] })], last: true },
    ],
  },
  // Пётр Ильич и Ольга Николаевна расписываются: угощение к столу, свадьба, открытка с моря.
  wedding: {
    icon: '💐',
    who: 'petr',
    when: (s) => happened(s, 'petr_olga'),
    beats: [
      {
        show: ['visit'],
        prop: 'bouquet',
        choices: [
          { effect: { sell: ['bread', 20, 1.8], rating: 0.05 }, require: { product: ['bread', 20] } },
          { effect: { money: -150, loyalty: [['petr', 2], ['olga', 2]] }, require: { money: 150 } },
          ok({ loyalty: [['petr', 1], ['olga', 1]] }),
        ],
      },
      { show: ['festive', 'car', 'visit'], prop: 'bouquet', choices: [ok({ rating: 0.05, boost: [0.1, 1] })], gap: [3, 4] },
      { who: 'olga', choices: [ok({ rating: 0.03, loyalty: [['petr', 1], ['olga', 1]] })], last: true, gap: [5, 7] },
    ],
  },
  // Сын Светы просится на летнюю подработку: работает, лето кончилось. Или — заходит рассказать про лагерь.
  summer: {
    icon: '🎒',
    who: 'sveta',
    when: (s) => met(s, regularById('sveta')),
    beats: [
      {
        show: ['visit'],
        choices: [
          { effect: { hire: true, loyalty: [['sveta', 1]] }, require: { slot: true } },
          { effect: { loyalty: [['sveta', 2]] }, next: 3 },
        ],
      },
      {
        choices: [{ effect: { money: -100, rating: 0.03, loyalty: [['sveta', 1]] }, require: { money: 100 } }, ok({ loyalty: [['sveta', 1]] })],
        gap: [6, 8],
      },
      { show: ['visit'], prop: 'palette', choices: [ok({ leave: true, rating: 0.05, loyalty: [['sveta', 1]] })], last: true, gap: [9, 12] },
      { show: ['kids'], choices: [ok({ loyalty: [['sveta', 1]] })], last: true },
    ],
  },
  // Зинаида Павловна уезжает к дочке: проводы, день отъезда, письмо с нового места.
  farewell: {
    icon: '🧳',
    who: 'zina',
    beats: [
      { show: ['visit'], prop: 'books', choices: [{ effect: { money: -200, rating: 0.08 }, require: { money: 200 } }, ok({ rating: 0.03 })] },
      { show: ['truck', 'visit'], prop: 'cane', choices: [ok({ rating: 0.02 })], gap: [2, 3] },
      { choices: [ok({ rating: 0.03, money: 50 })], last: true, gap: [6, 8] },
    ],
  },
  // В район переезжает семья: корзинка новосёлам, день рождения дочки, стали своими.
  newcomers: {
    icon: '🏠',
    who: 'family',
    beats: [
      { show: ['truck'], choices: [{ effect: { money: -120, boost: [0.05, 7] }, require: { money: 120 } }, ok({ rating: 0.01 })] },
      {
        show: ['visit'],
        prop: 'balloon',
        choices: [{ effect: { sell: ['milk', 10, 1.8], rating: 0.03 }, require: { product: ['milk', 10] } }, { effect: { money: -60, rating: 0.03 }, require: { money: 60 } }, ok()],
      },
      { show: ['visit'], prop: 'basket', choices: [ok({ boost: [0.04, 10] })], last: true },
    ],
  },
  // Эдуард вернулся — без «МегаМарта», с газетным киоском: совет, чай, присылает покупателей.
  eduard: {
    icon: '🕴️',
    who: 'eduard',
    beats: [
      { show: ['visit'], prop: 'briefcase', choices: [ok({ rating: 0.05 }), ok()] },
      { show: ['visit'], prop: 'newspaper', choices: [ok({ rating: 0.03 })] },
      { choices: [ok({ boost: [0.08, 5] })], last: true },
    ],
  },
  // Постоянные готовят магазину праздник: Валентина проговорилась, праздник.
  jubilee: {
    icon: '🎂',
    who: 'valya',
    beats: [
      { show: ['visit'], choices: [ok()] },
      {
        show: ['festive', 'visit'],
        prop: 'balloon',
        gap: [2, 3],
        choices: [{ effect: { money: -150, rating: 0.1 }, require: { money: 150 } }, ok({ loyalty: [['all', 1]] })],
        last: true,
      },
    ],
  },
  // Костя теперь учитель: экскурсия его класса, открытка от детей.
  school: {
    icon: '🔔',
    who: 'kostya',
    when: (s) => happened(s, 'kostya_diploma'),
    beats: [
      { show: ['visit'], prop: 'books', choices: [ok({ rating: 0.06, boost: [0.05, 3] }), ok({ take: ['apples', 10], loyalty: [['kostya', 2]] })] },
      { show: ['kids'], choices: [ok({ rating: 0.03 })], last: true },
    ],
  },
  // Света устраивает забег района: вода для бегунов, день забега.
  run: {
    icon: '🏃',
    who: 'sveta',
    when: (s) => met(s, regularById('sveta')),
    beats: [
      { show: ['visit'], prop: 'flag', choices: [{ effect: { money: -200, rating: 0.06 }, require: { money: 200 } }, ok({ loyalty: [['sveta', 1]] })] },
      { show: ['runners'], choices: [ok({ boost: [0.1, 1] })], last: true, gap: [2, 4] },
    ],
  },
  // Студентка Зоя просит поставить полку обмена книгами.
  books: {
    icon: '📚',
    who: 'zoya',
    beats: [
      { show: ['visit'], prop: 'books', choices: [ok({ boost: [0.05, 10], rating: 0.03 }), ok()] },
      { choices: [ok({ rating: 0.03 })], last: true },
    ],
  },
  // Пётр Ильичу — восемьдесят: Ольга Николаевна тайком заказывает торт.
  birthday: {
    icon: '🎈',
    who: 'olga',
    when: (s) => happened(s, 'petr_olga'),
    beats: [
      {
        show: ['visit'],
        prop: 'basket',
        choices: [{ effect: { money: -150, loyalty: [['petr', 2], ['olga', 1]] }, require: { money: 150 } }, ok({ loyalty: [['petr', 1]] })],
      },
      { who: 'petr', show: ['visit'], prop: 'balloon', choices: [ok({ rating: 0.03 })], last: true, gap: [2, 3] },
    ],
  },
  // Блогер Лиза снимает районные магазины: съёмка, видео разошлось.
  blogger: {
    icon: '📸',
    who: 'liza',
    beats: [
      { show: ['visit'], prop: 'camera', choices: [ok({ rating: 0.08, boost: [0.1, 3] }), ok({ rating: 0.02 })] },
      { choices: [ok({ boost: [0.06, 5] })], last: true },
    ],
  },
  // Соседи собирают на детскую площадку: скинуться или помочь руками; открытие.
  yard: {
    icon: '🌳',
    who: 'akhmed',
    when: (s) => met(s, regularById('akhmed')),
    beats: [
      { show: ['visit'], choices: [{ effect: { money: -300, rating: 0.05, boost: [0.05, 14] }, require: { money: 300 } }, ok({ loyalty: [['akhmed', 1]] })] },
      { show: ['kids', 'festive'], choices: [ok({ rating: 0.03 })], last: true },
    ],
  },
  // У Ольги Николаевны уродились яблоки: варенье у входа.
  harvest: {
    icon: '🍎',
    who: 'olga',
    when: (s) => met(s, regularById('olga')),
    beats: [
      {
        show: ['visit'],
        prop: 'basket',
        choices: [ok({ boost: [0.08, 3] }), { effect: { money: -100, loyalty: [['olga', 2]] }, require: { money: 100 } }],
      },
      { choices: [ok({ rating: 0.02 })], last: true },
    ],
  },
};
export const ARC_IDS = Object.keys(ARCS) as ArcId[];

export interface ArcDeal {
  who: RegularId;
  pid: ProductId;
  qty: number;
  pay: number;
  /** День следующей поставки и сколько поставок осталось. */
  next: number;
  left: number;
}

export interface ArcsState {
  /** Идущая история: какой шаг и с какого дня он ждёт игрока. */
  cur?: { id: ArcId; beat: number; due: number };
  done: ArcId[];
  /** Раньше этого дня новая история не начнётся. */
  nextAt?: number;
  /** Прибавка гостей от историй. */
  boost?: { pct: number; until: number };
  /** Договор с кафе Ахмеда. */
  deal?: ArcDeal;
  /** Сын Светы на летней подработке: на какой должности. */
  helper?: { role: StaffRole };
  /** Последний пройденный шаг и в какой день — его видно в мире весь этот день. */
  scene?: { id: ArcId; beat: number; day: number };
}

export const arcsOf = (state: StoreState): ArcsState => state.arcs ?? { done: [] };

/** Финал пройден: магазин стал «Лучшим магазином района» (contest.ts). */
export const afterFinale = (state: StoreState): boolean => (state.contest?.wins ?? 0) >= 1;

/** Хроники идут: после финала — или у давнего игрока, прошедшего пять глав. */
export const arcsOpen = (state: StoreState): boolean =>
  afterFinale(state) || (state.story.chapter >= CHAPTERS.length && state.day >= ARC_EARLY_DAY);

/** Число из зерна магазина: одно и то же для одной и той же истории и шага. */
function roll(state: StoreState, salt: number): number {
  return rng(((state.seed ?? 1) ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0)();
}
const hashId = (id: string): number => [...id].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
const within = ([from, to]: [number, number], r: number): number => from + Math.floor(r * (to - from + 1));

/** Через сколько дней следующий шаг этой истории. */
export function stepGap(state: StoreState, id: ArcId, beat: number): number {
  const range = ARCS[id].beats[beat]?.gap ?? (afterFinale(state) ? ARC_STEP : ARC_EARLY_STEP);
  return within(range, roll(state, hashId(id) + beat * 7919));
}

/** Передышка между историями. */
export function restGap(state: StoreState): number {
  return within(afterFinale(state) ? ARC_STEP : ARC_EARLY_STEP, roll(state, 104729 + arcsOf(state).done.length * 131));
}

/** Какая история начнётся следующей (или null — все рассказаны или никого нет). */
export function nextArc(state: StoreState): ArcId | null {
  const done = arcsOf(state).done;
  const options = ARC_IDS.filter((id) => !done.includes(id) && (ARCS[id].when?.(state) ?? true));
  if (!options.length) return null;
  return options[Math.floor(roll(state, 7777 + done.length * 31) * options.length)];
}

/** Шаг, который ждёт ответа сегодня (или null). */
export function arcToday(state: StoreState): { id: ArcId; beat: number } | null {
  const cur = arcsOf(state).cur;
  return cur && state.day >= cur.due ? { id: cur.id, beat: cur.beat } : null;
}

/** Утро: если истории нет и передышка кончилась — начинается следующая. История покупателя (tales.ts) — первой. */
export function arcsMorning(state: StoreState): StoreState {
  if (!arcsOpen(state)) return state;
  const arcs = arcsOf(state);
  if (arcs.cur) return state;
  // Первый раз — день передышки после финала (церемония, кубок).
  if (arcs.nextAt === undefined) return { ...state, arcs: { ...arcs, nextAt: state.day + 1 } };
  if (state.day < arcs.nextAt || taleToday(state)) return state;
  const id = nextArc(state);
  if (!id) return state;
  return { ...state, arcs: { ...arcs, cur: { id, beat: 0, due: state.day } } };
}

/** Должность для сына Светы: свободная должность грузчика или уборщика (и есть место в штате). */
export function helperRole(state: StoreState): StaffRole | null {
  if (state.staff.length >= staffLimit(state)) return null;
  return ARC_HELPER.roles.find((r) => roleOpen(state, r) && !staffOf(state, r)) ?? null;
}

const stockOf = (state: StoreState, id: ProductId): number => warehouseOf(state, id) + onShelves(state, id);

/** Можно ли сейчас выбрать этот вариант. */
export function canChooseArc(state: StoreState, choice: ArcChoice): boolean {
  const need = choice.require;
  if (!need) return true;
  if (need.money !== undefined && state.money < need.money) return false;
  if (need.product && stockOf(state, need.product[0]) < need.product[1]) return false;
  if (need.slot && !helperRole(state)) return false;
  return true;
}

/** Цена поставки кафе: хлеб × множитель. */
export const dealPay = (): number => Math.round(PRODUCTS[ARC_DEAL.pid].basePrice * ARC_DEAL.qty * ARC_DEAL.mult);

/** Последствия выбора. */
function apply(state: StoreState, e: ArcEffect): StoreState {
  let s = state;
  if (e.take) s = take(s, e.take[0], Math.min(e.take[1], stockOf(s, e.take[0])));
  if (e.sell) {
    s = take(s, e.sell[0], e.sell[1]);
    s = { ...s, money: s.money + Math.round(PRODUCTS[e.sell[0]].basePrice * e.sell[1] * e.sell[2]) };
  }
  if (e.money) s = { ...s, money: s.money + e.money };
  if (e.rating) s = { ...s, rating: Math.round(Math.min(5, Math.max(0, s.rating + e.rating)) * 100) / 100 };
  if (e.loyalty) {
    const regulars = { ...s.regulars };
    for (const [who, n] of e.loyalty) {
      const ids = who === 'all' ? REGULARS.filter((r) => met(s, r)).map((r) => r.id) : [who];
      for (const id of ids) {
        const cur = regularState(s, id);
        regulars[id] = { ...cur, loyalty: Math.min(MAX_LOYALTY, cur.loyalty + n) };
      }
    }
    s = { ...s, regulars };
  }
  let arcs = arcsOf(s);
  if (e.boost) {
    const [pct, days] = e.boost;
    const still = arcs.boost && arcs.boost.until >= s.day ? arcs.boost : undefined;
    arcs = { ...arcs, boost: still && still.pct > pct ? still : { pct, until: s.day + days - 1 } };
  }
  if (e.deal) {
    arcs = { ...arcs, deal: { who: ARC_DEAL.who, pid: ARC_DEAL.pid, qty: ARC_DEAL.qty, pay: dealPay(), next: s.day + 1, left: ARC_DEAL.times } };
  }
  if (e.hire) {
    const role = helperRole(s);
    if (role) {
      const wage = Math.round((wageFor(role, 2, 'hardworker') * ARC_HELPER.wage) / 10) * 10;
      const member: StaffMember = { role, name: ARC_HELPER.name, skill: 2, trait: 'hardworker', wage, months: 0, summer: true };
      const hired = hire(s, member);
      if (hired) {
        s = hired;
        arcs = { ...arcs, helper: { role } };
      }
    }
  }
  if (e.leave && arcs.helper) {
    const role = arcs.helper.role;
    s = { ...s, staff: s.staff.filter((m) => !(m.role === role && m.summer)) };
    arcs = { ...arcs, helper: undefined };
  }
  return { ...s, arcs };
}

/** Ответ игрока на шаг: последствия и следующий шаг (или конец истории). null — выбрать нельзя. */
export function answerArc(state: StoreState, index: number): StoreState | null {
  const today = arcToday(state);
  if (!today) return null;
  const beat = ARCS[today.id].beats[today.beat];
  const choice = beat?.choices[index];
  if (!choice || !canChooseArc(state, choice)) return null;
  const s = apply(state, choice.effect);
  const arcs = arcsOf(s);
  const scene = { id: today.id, beat: today.beat, day: s.day };
  const next = choice.next ?? (beat.last ? -1 : today.beat + 1);
  if (next < 0 || next >= ARCS[today.id].beats.length) {
    const ended: StoreState = { ...s, arcs: { ...arcs, cur: undefined, done: [...arcs.done, today.id], scene } };
    return { ...ended, arcs: { ...ended.arcs!, nextAt: s.day + restGap(ended) } };
  }
  return { ...s, arcs: { ...arcs, cur: { id: today.id, beat: next, due: s.day + stepGap(s, today.id, next) }, scene } };
}

/** Что видно в мире сегодня: шаг, пройденный этим утром (гость, нарядные покупатели, машина…). */
export function arcSceneToday(state: StoreState): { id: ArcId; beat: number; who: ArcWho; show: ArcShow[]; prop?: string } | null {
  const scene = arcsOf(state).scene;
  if (!scene || scene.day !== state.day) return null;
  const beat = ARCS[scene.id]?.beats[scene.beat];
  if (!beat?.show?.length) return null;
  return { id: scene.id, beat: scene.beat, who: beat.who ?? ARCS[scene.id].who, show: beat.show, prop: beat.prop };
}

export interface DealDelivery {
  delivered: boolean;
  pay: number;
  /** Это была последняя поставка по договору. */
  ended: boolean;
}

/** Открылись: в день поставки кафе Ахмеда забирает хлеб. Нет хлеба — без обид, через неделю. */
export function arcDeliver(state: StoreState): { state: StoreState; result: DealDelivery | null } {
  const arcs = arcsOf(state);
  const deal = arcs.deal;
  if (!deal || state.day < deal.next) return { state, result: null };
  const delivered = stockOf(state, deal.pid) >= deal.qty;
  let s = state;
  if (delivered) s = { ...take(s, deal.pid, deal.qty), money: s.money + deal.pay };
  // Неделя прошла в любом случае: договор на ARC_DEAL.times недель, недовезённое не копится.
  const left = deal.left - 1;
  const ended = left <= 0;
  const after = ended ? undefined : { ...deal, left, next: state.day + ARC_DEAL.every };
  return { state: { ...s, arcs: { ...arcsOf(s), deal: after } }, result: { delivered, pay: delivered ? deal.pay : 0, ended } };
}

/** Множитель гостей от хроник: прибавка от истории и друзья сына Светы, пока он работает. */
export function arcGuests(state: StoreState): number {
  const arcs = state.arcs;
  if (!arcs) return 1;
  const boost = arcs.boost && state.day <= arcs.boost.until ? 1 + arcs.boost.pct : 1;
  const helper = arcs.helper && onShift(state, arcs.helper.role) && staffOf(state, arcs.helper.role)?.summer ? ARC_HELPER.guests : 1;
  return boost * helper;
}

/** Для «Завтра:» итогов дня: завтра — новый шаг истории. s — уже утро следующего дня. */
export function arcTeaser(s: StoreState): { id: ArcId; icon: string } | null {
  const today = arcToday(s);
  return today ? { id: today.id, icon: ARCS[today.id].icon } : null;
}

/** Все ключи текста одной истории (для проверки, что тексты есть в обоих языках). */
export function arcKeys(id: ArcId): string[] {
  const keys = [`arc.${id}.name`, `arc.${id}.news`];
  ARCS[id].beats.forEach((b, i) => {
    keys.push(`arc.${id}.${i}.text`);
    b.choices.forEach((_, c) => keys.push(`arc.${id}.${i}.${c}`));
    if (b.show?.includes('visit')) keys.push(`arc.${id}.${i}.line`);
  });
  return keys;
}
