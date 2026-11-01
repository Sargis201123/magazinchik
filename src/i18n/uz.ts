// Узбекский (латиница: oʻ, gʻ) — заготовка. Пока словарь не полон, язык не показывается в выборе (SHIPPED в langs.ts),
// а недостающие строки берутся из английского. Как заполнить — docs/I18N.md.
import type { TextKey } from './ru';

export const uz: Partial<Record<TextKey, string>> = {};

/** Имена сотрудников (индекс хранится в сохранении). Пусто — берутся английские. */
export const uzNames: string[] = [];
