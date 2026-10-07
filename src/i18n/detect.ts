export type Lang = 'ru' | 'en';

// Русский показываем всем, у кого язык из «русскоязычной» группы, остальным — английский.
const RU_LIKE = ['ru', 'uk', 'be', 'kk', 'uz', 'ky', 'hy', 'az', 'tg'];

export function detectLang(...candidates: (string | null | undefined)[]): Lang {
  for (const c of candidates) {
    if (!c) continue;
    const code = c.toLowerCase().slice(0, 2);
    if (code === 'en' || code === 'ru') return code;
    if (RU_LIKE.includes(code)) return 'ru';
    return 'en';
  }
  return 'ru';
}
