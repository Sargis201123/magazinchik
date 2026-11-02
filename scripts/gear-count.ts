// Что из оборудования видит игрок (02.11, упрощение оборудования): npm run -s gear:count
// Состояние — медианный прогон модели A с оборудованием к 7/30/90-му дню (16 сидов). Считаем:
// строки в блоке «Оборудование», линейки, которые игрок выбирает сам (есть платная модель впереди),
// кнопки «Поставить», доступные прямо сейчас, и сколько монет на оборудование ещё можно потратить.
import { simulate } from '../src/game/simulate';
import { GEAR, GEAR_IDS, gearAvailable, gearTier } from '../src/game/gear';
import { UPGRADE_IDS } from '../src/game/upgrades';
import { SKILL_IDS } from '../src/game/owner';
import * as gear from '../src/game/gear';

const runs = 16;
// Ручные линейки — новое понятие (после упрощения); до него ручными были все.
const manual = (id: (typeof GEAR_IDS)[number]) => !(GEAR[id] as { auto?: unknown }).auto;
const rows = 'gearRows' in gear ? (gear as unknown as { gearRows: () => number }).gearRows() : GEAR_IDS.length;
console.log(`строк в блоке «Оборудование»: ${rows}; линеек всего: ${GEAR_IDS.length}, моделей: ${GEAR_IDS.reduce((s, id) => s + GEAR[id].models.length - 1, 0)}; улучшений в списке: ${UPGRADE_IDS.length}; навыков хозяина: ${SKILL_IDS.length}`);
for (const day of [7, 30, 90]) {
  const finals = Array.from({ length: runs }, (_, i) => simulate({ days: day, seed: i + 1, features: { gear: true } }).final);
  const stat = finals.map((s) => {
    const choice = GEAR_IDS.filter((id) => manual(id) && GEAR[id].models.slice(gearTier(s, id) + 1).some((m) => m.price > 0)).length;
    const now = GEAR_IDS.filter((id) => manual(id) && gearAvailable(s, id)).length;
    const left = GEAR_IDS.filter(manual).reduce((sum, id) => sum + GEAR[id].models.slice(gearTier(s, id) + 1).reduce((a, m) => a + m.price, 0), 0);
    return { level: s.level, choice, now, left };
  });
  const med = (f: (x: (typeof stat)[number]) => number) => [...stat.map(f)].sort((a, b) => a - b)[runs >> 1];
  console.log(`день ${day}: помещение ур.${med((x) => x.level) + 1} · линеек на выбор ${med((x) => x.choice)} · «Поставить» доступно сейчас ${med((x) => x.now)} · ещё можно потратить ${med((x) => x.left)} 💰`);
}
