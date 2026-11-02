// Сколько систем встречает новичок к 7/30/90-му дню и сколько из них — решения в утреннем меню:
// npm run sim:systems. Таблица — с какого дня система может впервые попасться новичку нового начала
// (onboarding 'play'), дни берутся из констант игры. Убранное 02.11 («спокойный персонал») лежит в REMOVED
// с прежними днями — чтобы печатать «было / стало» одной командой (docs/BALANCE.md, «Спокойный персонал»).
import { MOMENTS_FROM_DAY } from '../src/game/moments';
import { QUESTS_FROM_DAY } from '../src/game/endless';
import { ORDER_FROM_DAY } from '../src/game/returns';
import { WEEKLY_FROM_DAY } from '../src/game/weekly';
import { LIVE_FROM_DAY } from '../src/game/minievents';
import { SPECIAL_FROM_DAY } from '../src/game/special';
import { DEAL_FROM_DAY, SNITCH_FROM_DAY } from '../src/game/events';
import { CAFE_FROM_DAY } from '../src/game/cafe';
import { CAT_FROM_DAY } from '../src/game/cat';
import { FAIR_FROM_DAY } from '../src/game/fair';
import { DOG_FROM_DAY } from '../src/game/watch';
import { TRICK_FROM_DAY } from '../src/game/tricks';
import { STAFF_EVENT_FROM } from '../src/game/staffEvents';
import { WAR_FROM_DAY } from '../src/game/war';
import { BEST_EVERY } from '../src/game/career';
import { GIANT_FROM_DAY } from '../src/game/giant';

/** Первый помощник — на 5-й день (бабушка советует грузчика, tut.week.staff); от него считаются системы персонала. */
const HIRE = 5;

interface System {
  name: string;
  from: number;
  /** Просит решения в утреннем меню (карточка с выбором), а не просто идёт фоном. */
  decision?: boolean;
}

const KEPT: System[] = [
  { name: 'касса и улица', from: 1 },
  { name: 'полки и раскладка', from: 1 },
  { name: 'закупка («Закупить нужное»)', from: 2, decision: true },
  { name: 'активные моменты дня', from: MOMENTS_FROM_DAY },
  { name: 'задания дня', from: QUESTS_FROM_DAY },
  { name: 'заказ соседа «отложи»', from: ORDER_FROM_DAY },
  { name: 'вкладка «Зал»', from: 3 },
  { name: 'утро: заказ к вечеру', from: 4, decision: true },
  { name: 'утро: проверка СЭС', from: 4 },
  { name: 'испытания месяца', from: WEEKLY_FROM_DAY },
  { name: 'вкладка «Персонал», найм', from: 4, decision: true },
  { name: 'вкладка «Развитие»', from: 5, decision: true },
  { name: 'уровень хозяина', from: 2 },
  { name: 'вкладка «Уголки»', from: 6 },
  { name: 'мини-события зала', from: LIVE_FROM_DAY },
  { name: 'особые гости', from: SPECIAL_FROM_DAY },
  { name: 'утро: выгодная партия', from: DEAL_FROM_DAY, decision: true },
  { name: 'договор с кафе', from: CAFE_FROM_DAY, decision: true },
  { name: 'кот', from: CAT_FROM_DAY, decision: true },
  { name: 'ярмарка', from: FAIR_FROM_DAY },
  { name: 'Бобик из приюта', from: DOG_FROM_DAY },
  { name: 'обучение персонала (курсы → старший → администратор)', from: HIRE, decision: true },
  { name: 'проделки конкурента', from: TRICK_FROM_DAY, decision: true },
  { name: 'истории персонала', from: STAFF_EVENT_FROM, decision: true },
  { name: 'война цен с Эдуардом', from: WAR_FROM_DAY, decision: true },
  { name: 'донос Эдуарда', from: SNITCH_FROM_DAY },
  { name: '«сотрудник месяца»', from: HIRE + BEST_EVERY, decision: true },
  { name: '«Гигант»', from: GIANT_FROM_DAY },
];

/** Убрано 02.11 — с какого дня встречалось раньше (прежние константы). */
const REMOVED: System[] = [
  { name: 'навыки хозяина: выбор очков', from: 2, decision: true },
  { name: 'поломка холодильника', from: 4, decision: true },
  { name: 'болезнь сотрудника', from: HIRE },
  { name: 'отпроситься / выходной', from: 6, decision: true },
  { name: 'усталость и выходные', from: HIRE + 6, decision: true },
  { name: 'ночные кражи', from: 12 },
  { name: 'ночной сторож', from: 12, decision: true },
  { name: 'неожиданный счёт', from: 12, decision: true },
  { name: 'просьба о прибавке, обида, уход', from: HIRE + 14, decision: true },
  { name: 'переманивание', from: 15, decision: true },
  { name: 'утреннее предложение повысить', from: HIRE + 30, decision: true },
];

/** Что было до 02.11 у отодвинутых открытий. */
const BEFORE_FROM: Record<string, number> = {
  'мини-события зала': 4,
  'особые гости': 5,
  'утро: выгодная партия': 6,
  'договор с кафе': 6,
  кот: 7,
  'обучение персонала (курсы → старший → администратор)': HIRE,
};

const before = [...KEPT.map((s) => ({ ...s, from: BEFORE_FROM[s.name] ?? s.from })), ...REMOVED];
const after = KEPT;
const met = (list: System[], day: number) => list.filter((s) => s.from <= day);
console.log('день | систем было → стало | из них решений утром было → стало');
for (const day of [7, 30, 90]) {
  const b = met(before, day);
  const a = met(after, day);
  console.log(`${String(day).padStart(4)} | ${b.length} → ${a.length} | ${b.filter((s) => s.decision).length} → ${a.filter((s) => s.decision).length}`);
}
console.log('\nК 7-му дню больше не встречаются:', met(before, 7).filter((s) => !met(after, 7).some((x) => x.name === s.name)).map((s) => s.name).join(', '));
