// Карточки «Новое!»: при первом появлении механики утро объясняет её в двух словах.
// Каждую показываем один раз (seenTips в сохранении).

import { nextStoreLevel, onShelves, PRODUCT_IDS, warehouseOf, type StoreState } from './economy';
import { hasUpgrade } from './upgrades';
import { isFairDay } from './fair';
import { registerCount, RELIEF_ROLE } from './registers';
import { noThieves, quietDays } from './firstday';
import { pawnOpen } from './pawnshop';
import { hasLottery } from './lottery';
import { echoesOf } from './echoes';
import { crisisToday } from './crisis';
import { hasLicense } from './license';
import { vanOpen } from './van';
import { greyOffer } from './grey';
import { rentalOpen } from './rental';
import { floorAvailable, hasFloor } from './floors';
import { residents, RES_START } from './residents';
import { estateOpen } from './estate';
import { GENT_SEEN, prestigeOf } from './gentrify';

export type TipId = 'broke' | 'ownerTill' | 'alone' | 'weekly' | 'fair' | 'loyalty' | 'delivery' | 'register2' | 'oven' | 'coffee' | 'nightShift' | 'pawn' | 'case' | 'rhythm' | 'echo' | 'license' | 'thief' | 'crisis' | 'lottery' | 'dreams' | 'appr' | 'rental' | 'racket' | 'grey' | 'van' | 'residents' | 'plots' | 'basement' | 'clothes' | 'gentrify' | 'estate' | 'foodcourt';

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
  // Первая беда района (crisis.ts): беда идёт считанные дни — объяснить сразу, что район запомнит.
  ['crisis', (s) => Boolean(crisisToday(s))],
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
  // Касса в ритме (tillRhythm.ts, 13.11): лента включается только после этой карточки — никто не ждёт у кассы
  // из-за правила, о котором ему не сказали. Новичку — после тихих дней (кассу он уже знает); со сменщиком
  // хозяин за кассу не встаёт — карточка подождёт, пока касса снова не станет его.
  // 14.11, аудит: сразу за воришкой — при одной карточке в утро ломбард и фургон отложили бы её на неделю.
  ['rhythm', (s) => s.day >= 2 && !quietDays(s) && !s.staff.some((m) => m.role === RELIEF_ROLE)],
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
  // Первая сценка кончилась и посадила эхо (echoes.ts): утром — что решения ещё аукнутся.
  ['echo', (s) => echoesOf(s).list.length > 0],
  // Лицензия на пиво и сигареты (license.ts): наутро после покупки — где товар и чего делать нельзя.
  ['license', hasLicense],
  // Прокат у входа (rental.ts, 13.11): как только стойку можно поставить — где она и что решает залог.
  ['rental', (s) => rentalOpen(s) || Boolean(s.rental)],
  ['lottery', hasLottery],
  // Первое вложение в мечту соседа (dreams.ts): сразу после «Вложиться» — когда ждать новостей и где список.
  ['dreams', (s) => Boolean(s.dreams?.inv?.length)],
  // Ученик (apprentice.ts): как только взяли — в двух словах, чем его место отличается и от чего зависит доверие.
  ['appr', (s) => Boolean(s.appr)],
  // «Крыша» (racket.ts): сразу после ответа — чего теперь ждать и когда путь можно будет сменить.
  ['racket', (s) => Boolean(s.racket?.mode && !s.racket.end)],
  // Серая схема (grey.ts): в утро первого предложения Жоры — чем такие сделки кончаются.
  ['grey', (s) => Boolean(greyOffer(s))],
  // Выездная торговля (van.ts, 13.11): с минимаркета в «Уголках» продаётся фургон — сказать, пока его нет.
  ['van', (s) => vanOpen(s) && !s.van],
  // Жители района (residents.ts, 13.11): после первого переезда — откуда берутся и уходят семьи (и гости с ними).
  ['residents', (s) => Boolean(s.residents?.move) || residents(s) !== RES_START],
  // Район подстраивается (districtPlots.ts, 13.11): как только участок застроили по нашим продажам — что это значит.
  ['plots', (s) => Boolean(s.district?.plots?.some((p) => p.sold))],
  // Подвал (floors.ts, basement.ts, 13.11): как только его можно открыть — что внизу и чем платишь за автоматы.
  ['basement', (s) => floorAvailable(s, 'basement') || hasFloor(s, 'basement')],
  // Второй этаж — одежда (clothes.ts, 13.11): как только его можно открыть — что наверху, сезоны и распродажа.
  ['clothes', (s) => floorAvailable(s, 'second') || hasFloor(s, 'second')],
  // Район дорожает (gentrify.ts, 13.11): как только престиж стало видно — откуда он и что дорожает.
  ['gentrify', (s) => prestigeOf(s) >= GENT_SEEN],
  // Скупать улицу (estate.ts, 13.11): в первое утро «Супермаркета» — что дома за магазином продаются и где их купить.
  ['estate', estateOpen],
  // Фудкорт (floors.ts, foodcourt.ts, 13.11): третий этаж можно открыть — что там и чем он помогает залу.
  ['foodcourt', (s) => floorAvailable(s, 'third') || hasFloor(s, 'third')],
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
  rental: '🛷',
  crisis: '🤝',
  lottery: '🎟',
  dreams: '🌱',
  appr: '🧢',
  racket: '🕶',
  grey: '🦊',
  van: '🚐',
  residents: '🏘',
  plots: '🏗',
  basement: '🪜',
  clothes: '👗',
  gentrify: '💎',
  estate: '🏠',
  foodcourt: '🍕',
};

/**
 * 14.11, аудит: срочные — без очереди и сверх нормы. Касса пуста, беда района и Жора с предложением идут
 * считанные дни (серое — одно утро), завтра карточка будет уже не к месту.
 */
const URGENT: ReadonlySet<TipId> = new Set<TipId>(['broke', 'crisis', 'grey']);

/**
 * Первая ещё не показанная подсказка, которая сейчас к месту. 14.11, аудит: не больше одной «Новое!» за утро —
 * в утро «Минимаркета» их шло 4–5 подряд (ломбард, прокат, фургон, подвал), у вернувшегося игрока — 7.
 * tipDay ставит только кнопка «Понятно» утром (ui/morning.ts): seeTip зовут и молча (newcomer.ts, сцены).
 */
export function pendingTip(state: StoreState): TipId | null {
  const seen = new Set(state.seenTips ?? []);
  const fits = ([id, when]: (typeof WHEN)[number]) => !seen.has(id) && when(state);
  const urgent = WHEN.find((w) => URGENT.has(w[0]) && fits(w));
  if (urgent) return urgent[0];
  return state.tipDay === state.day ? null : (WHEN.find(fits)?.[0] ?? null);
}

export const seeTip = (state: StoreState, id: TipId): StoreState => ({ ...state, seenTips: [...(state.seenTips ?? []), id] });

/** Карточки до 13.11: у кого видены только они — игрок со старым сохранением. */
const OLD_TIPS: ReadonlySet<string> = new Set<string>(['broke', 'ownerTill', 'alone', 'weekly', 'fair', 'loyalty', 'delivery', 'register2', 'oven', 'coffee', 'nightShift']);
/** Карточки «механика открылась» (а не «с тобой случилось»): их вернувшемуся игроку заменяет «Что нового». */
const OPEN_TIPS: ReadonlySet<TipId> = new Set<TipId>(['pawn', 'rental', 'van', 'basement', 'clothes', 'gentrify', 'estate', 'foodcourt']);

/**
 * При загрузке (save.ts). 14.11, аудит: старое сохранение после обновления 13.11 получало 7 карточек подряд.
 * Уже открытые механики отмечаем прочитанными — о них одной строкой говорит «Что нового» (news.mechs).
 * Воришку и ритм кассы не трогаем: они меняют знакомое (ритм и включается карточкой).
 */
export function catchUpTips(state: StoreState): StoreState {
  const seen = state.seenTips ?? [];
  if (state.day <= 20 || seen.some((id) => !OLD_TIPS.has(id))) return state;
  const open = WHEN.filter(([id, when]) => OPEN_TIPS.has(id) && when(state)).map(([id]) => id);
  return open.length ? { ...state, seenTips: [...seen, ...open] } : state;
}
