// Какую игру игрок выбрал на титуле в прошлый раз: «Магазинчик» или вторую — «Лавку «Своё»» (src/lavka).
// Прогресса у лавки пока нет: это играбельный день, каждый раз с утра.

/** Последний выбор на титульном экране: 'store' или 'farm' (вторая игра). */
const CHOICE_KEY = 'magazinchik.game';

export type GameChoice = 'store' | 'farm';
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
