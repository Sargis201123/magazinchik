// Что видит игрок в утреннем меню закупки и продаж и сколько там решений: npm run decisions [прогонов] [restock|auto]
// Прогоны симулятора со всеми механиками; каждое утро смотрим состояние и считаем блоки (карточки) и
// решения (кнопки выбора) закупки и продаж, плюс какие системы игрок уже встретил к 7/30/90-му дню.
// Считается грубо, по правилам показа в ui/morning.ts, — для сравнения «до» и «после» упрощения.
import { simulate, type Feature } from '../src/game/simulate';
import type { StoreState } from '../src/game/economy';
import { autoActive, autoAvailable } from '../src/game/autoorder';
import { orderBoard } from '../src/game/orders';

const runs = Number(process.argv[2] ?? 8);
/** restock — жмёт «Закупить нужное» сам; auto — включает «Закупать сам», как только можно. */
const buyMode = (process.argv[3] ?? 'restock') as 'restock' | 'auto';
const CHECKS = [7, 30, 90];
const ALL: Feature[] = ['candy', 'coffee', 'oven', 'night', 'cat', 'cart', 'loyalty', 'gear', 'departments', 'skills', 'radio', 'brand', 'cafe', 'kitchen', 'rush', 'delivery', 'ads', 'kiosks'];

/** Система закупки или продаж: показана ли сегодня, сколько блоков и решений (кнопок выбора) она даёт утром. */
interface Sys {
  name: string;
  /** null — сегодня не видна. */
  see: (s: StoreState) => { blocks: number; decisions: number } | null;
}

// После упрощения 02.11 (до него было 13 систем к 30-му дню и ~19 решений утром — docs/BALANCE.md
// «Закупка и продажи проще»): торг, ручные строки, акция дня, кнопка уценки, электронные ценники,
// «выгодная партия», договоры и срочный подвоз у игрока убраны; ручные строки — под «Подробнее»
// (свёрнуто, не считаем); заказы — одной доской.
const SYSTEMS: Sys[] = [
  { name: '«Закупить нужное»', see: (s) => (autoActive(s) ? null : { blocks: 1, decisions: 1 }) },
  { name: '«Закупать сам»', see: (s) => (autoAvailable(s) ? { blocks: 1, decisions: 1 } : null) },
  {
    name: 'доска «Заказы»',
    see: (s) => {
      const rows = orderBoard(s);
      if (!rows.length) return null;
      const decisions = rows.reduce((n, r) => n + (r.kind === 'client' && !r.accepted ? 2 : r.kind === 'cafeOffer' || r.kind === 'neighbour' ? 2 : r.kind === 'bread' && !r.owned ? 1 : 0), 0);
      return { blocks: 1, decisions };
    },
  },
];

const met = CHECKS.map(() => new Set<string>());
const sums = CHECKS.map(() => ({ blocks: 0, decisions: 0, mornings: 0 }));
for (let seed = 1; seed <= runs; seed++) {
  simulate({
    days: CHECKS[CHECKS.length - 1],
    seed,
    buyMode,
    hireStaff: true,
    features: Object.fromEntries(ALL.map((f) => [f, true])),
    onMorning: (s) => {
      CHECKS.forEach((limit, i) => {
        if (s.day > limit) return;
        const from = i ? CHECKS[i - 1] : 0;
        let blocks = 0;
        let decisions = 0;
        for (const sys of SYSTEMS) {
          const seen = sys.see(s);
          if (!seen) continue;
          met[i].add(sys.name);
          blocks += seen.blocks;
          decisions += seen.decisions;
        }
        // Утро «в среднем» — по дням отрезка (с прошлой отметки до этой).
        if (s.day > from) {
          sums[i].blocks += blocks;
          sums[i].decisions += decisions;
          sums[i].mornings++;
        }
      });
    },
  });
}
console.log(`прогонов: ${runs}, все механики симулятора, закупка: ${buyMode}\n`);
console.log('к дню  систем встретил  блоков утром  решений утром');
CHECKS.forEach((d, i) =>
  console.log(
    [String(d).padStart(5), String(met[i].size).padStart(16), (sums[i].blocks / sums[i].mornings).toFixed(1).padStart(13), (sums[i].decisions / sums[i].mornings).toFixed(1).padStart(14)].join(' '),
  ),
);
console.log(`\nсистемы к ${CHECKS[CHECKS.length - 1]}-му дню: ${[...met[met.length - 1]].join(', ')}`);
