import { newGame, type StoreState } from './economy';

// Пока сохраняем локально. На этапе 6 добавим облачные сохранения в Supabase.
const KEY = 'magazinchik.save';
const VERSION = 3;

interface SaveFile {
  version: number;
  state: StoreState;
}

export function loadGame(): StoreState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const save = JSON.parse(raw) as SaveFile;
    if (save.version !== VERSION) return null;
    return { ...newGame(), ...save.state };
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
