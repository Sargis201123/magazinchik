// Казахский — заготовка. Пока словарь не полон, язык не показывается в выборе (SHIPPED в langs.ts),
// а недостающие строки берутся из английского. Как заполнить — docs/I18N.md.
import type { TextKey } from './ru';

export const kk: Partial<Record<TextKey, string>> = {};

/** Имена сотрудников (индекс хранится в сохранении). Пусто — берутся английские. */
export const kkNames: string[] = [];
