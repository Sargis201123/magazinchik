// Сохранение «Бабушкиной фермы» — своё, под отдельным ключом: сохранение «Магазинчика» (game/save.ts)
// ферма не читает и не трогает. Пока только в памяти телефона; облако Telegram — после прототипа.
// Здесь же — какую игру игрок выбрал на титуле в прошлый раз.

import { normalizeFarm, type FarmState } from './farm';

const KEY = 'magazinchik.farm';
const VERSION = 1;
/** Последний выбор на титульном экране: 'store' или 'farm'. */
const CHOICE_KEY = 'magazinchik.game';

export type GameChoice = 'store' | 'farm';

export function loadFarm(): FarmState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const file = JSON.parse(raw) as { version?: number; state?: unknown };
    if (file.version !== VERSION) return null;
    return normalizeFarm(file.state);
  } catch {
    return null;
  }
}

export function saveFarm(state: FarmState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: VERSION, state, savedAt: Date.now() }));
  } catch {
    // Хранилища нет (приватный режим) — ферма живёт до закрытия.
  }
}

/** Какую игру выбрать на титуле: что выбирал в прошлый раз; не выбирал — «Магазинчик». */
export function lastChoice(): GameChoice {
  try {
    return localStorage.getItem(CHOICE_KEY) === 'farm' ? 'farm' : 'store';
  } catch {
    return 'store';
  }
}

export function saveChoice(choice: GameChoice): void {
  try {
    localStorage.setItem(CHOICE_KEY, choice);
  } catch {
    // ничего
  }
}
