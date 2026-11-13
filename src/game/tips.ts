// Карточки «Новое!»: при первом появлении механики утро объясняет её в двух словах.
// Каждую показываем один раз (seenTips в сохранении).

import { nextStoreLevel, onShelves, PRODUCT_IDS, warehouseOf, type StoreState } from './economy';
import { hasUpgrade } from './upgrades';
import { isFairDay } from './fair';
import { registerCount, RELIEF_ROLE } from './registers';
import { noThieves, quietDays } from './firstday';
import { pawnOpen } from './pawnshop';
import { echoesOf } from './echoes';
import { hasLicense } from './license';

export type TipId = 'broke' | 'ownerTill' | 'alone' | 'weekly' | 'fair' | 'loyalty' | 'delivery' | 'register2' | 'oven' | 'coffee' | 'nightShift' | 'pawn' | 'case' | 'rhythm' | 'echo' | 'license' | 'thief' | 'dreams';

/** Касса пуста и товара нет: без закупки не будет и выручки — подсказать про кредит. */
export const isBroke = (s: StoreState): boolean =>
  s.money < 100 && !s.loan && PRODUCT_IDS.every((id) => warehouseOf(s, id) + onShelves(s, id) === 0);

/**
 * Есть ли кто-то в зале, кроме хозяина: кассир, грузчик, уборщица или менеджер. Пекарь, бариста и повар
 * работают в пристройках, сторож ловит воров — касса, полки и склад от них остаются на хозяине.
 */
export const hasFloorStaff = (s: StoreState): boolean =>
  s.staff.some((m) => m.role.startsWith('cashier') || m.role === 'loader' || m.role === 'cleaner' || m.role === 'manager');

/**
 * Расширяться дальше третьего помещения без персонала — ловушка: касса, полки и склад на одном хозяине,
 * гости уходят, а аренда растёт. В симуляторе (12 прогонов × 150 дней) одиночка на универмаге к 150-му
 * дню копит ~13 тыс. при прибыли ~110 в день, а оставшись в третьем помещении — ~97 тыс. и ~650 в день.
 * Друзья, пришедшие на подмогу на день (help.ts), — не персонал: их в state.staff нет.
 */
export const soloExpandRisk = (s: StoreState): boolean => !hasFloorStaff(s) && s.level >= 2 && Boolean(nextStoreLevel(s));

const WHEN: [TipId, (s: StoreState) => boolean][] = [
  ['broke', isBroke],
  // Касса — хозяина, пробивать можно и касанием улицы: со второго утра (в новом начале об этом
  // уже сказала бабушка в первый день — там карточка отмечена прочитанной). Старым игрокам — в
  // первое же утро после обновления: так они узнают, куда встал их кассир.
  ['ownerTill', (s) => s.day >= 2],
  // Без персонала магазин выше второго помещения не тянет (в симуляторе: рейтинг 2,8, прибыль ~0).
  // Раньше 20-го дня карточку показывает вкладка «Развитие» — у кнопки расширения (soloExpandRisk).
  ['alone', (s) => s.level >= 2 && s.day >= 20 && !hasFloorStaff(s)],
  // Воришка по повадкам (13.11, thiefTells.ts): новичку — утром первого дня, когда приходят воры (после тихих
  // дней); старым игрокам — в первое утро после обновления: красной подсветки больше нет, ловят по приметам.
  ['thief', (s) => s.day >= 2 && !noThieves(s)],
  ['weekly', (s) => Boolean(s.weekly)],
  ['fair', (s) => isFairDay(s.day)],
  ['loyalty', (s) => hasUpgrade(s, 'loyalty')],
  ['delivery', (s) => hasUpgrade(s, 'delivery')],
  ['register2', (s) => registerCount(s) >= 2],
  ['oven', (s) => hasUpgrade(s, 'oven')],
  ['coffee', (s) => hasUpgrade(s, 'coffee')],
  ['nightShift', (s) => hasUpgrade(s, 'nightShift')],
  // Ломбард в подсобке (pawnshop.ts): в первое утро «Минимаркета» — вместе с первым гостем с вещью.
  ['pawn', pawnOpen],
  // Первое дело недели (cases.ts): как приходят улики и когда обвинять.
  ['case', (s) => Boolean(s.cases?.open)],
  // Касса в ритме (tillRhythm.ts, 13.11): лента включается только после этой карточки — никто не ждёт у кассы
  // из-за правила, о котором ему не сказали. Новичку — после тихих дней (кассу он уже знает); со сменщиком
  // хозяин за кассу не встаёт — карточка подождёт, пока касса снова не станет его.
  ['rhythm', (s) => s.day >= 2 && !quietDays(s) && !s.staff.some((m) => m.role === RELIEF_ROLE)],
  // Первая сценка кончилась и посадила эхо (echoes.ts): утром — что решения ещё аукнутся.
  ['echo', (s) => echoesOf(s).list.length > 0],
  // Лицензия на пиво и сигареты (license.ts): наутро после покупки — где товар и чего делать нельзя.
  ['license', hasLicense],
  // Первое вложение в мечту соседа (dreams.ts): сразу после «Вложиться» — когда ждать новостей и где список.
  ['dreams', (s) => Boolean(s.dreams?.inv?.length)],
];

export const TIP_ICONS: Record<TipId, string> = {
  broke: '🏦',
  ownerTill: '👆',
  alone: '🧑‍🤝‍🧑',
  weekly: '🗓',
  fair: '🎪',
  loyalty: '💳',
  delivery: '🚲',
  register2: '🧾',
  oven: '🥖',
  coffee: '☕',
  nightShift: '🌙',
  pawn: '🏷',
  case: '🕵',
  rhythm: '🎵',
  echo: '🔁',
  license: '🔞',
  thief: '🕵️',
  dreams: '🤝',
};

/** Первая ещё не показанная подсказка, которая сейчас к месту. */
export function pendingTip(state: StoreState): TipId | null {
  const seen = new Set(state.seenTips ?? []);
  return WHEN.find(([id, when]) => !seen.has(id) && when(state))?.[0] ?? null;
}

export const seeTip = (state: StoreState, id: TipId): StoreState => ({ ...state, seenTips: [...(state.seenTips ?? []), id] });
