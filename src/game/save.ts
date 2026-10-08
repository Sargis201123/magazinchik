import { newGame, type StoreState } from './economy';

// Пока сохраняем локально. На этапе 6 добавим облачные сохранения в Supabase.
const KEY = 'magazinchik.save';
const VERSION = 10;
/** Старые сохранения с этой версии и новее подходят: недостающие поля берутся из новой игры. */
const MIN_COMPATIBLE = 9;

interface SaveFile {
  version: number;
  state: StoreState;
}

export function loadGame(): StoreState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const save = JSON.parse(raw) as SaveFile;
    if (save.version < MIN_COMPATIBLE || save.version > VERSION) return null;
    // Новые товары появляются в старых сохранениях со своей ценой по умолчанию.
    const fresh = newGame();
    return { ...fresh, ...save.state, prices: { ...fresh.prices, ...save.state.prices } };
  } catch {
    return null;
  }
}

export function saveGame(state: StoreState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: VERSION, state } satisfies SaveFile));
  } catch {
    // Хранилище недоступно (приватный режим) — играем без сохранения.
  }
}
