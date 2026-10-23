// Адреса картинок из public/ с отпечатком содержимого. Файлы в assets/ кэшируются у игрока на год
// (public/_headers), поэтому в адрес добавляется хэш файла: картинку перерисовали — адрес сменился,
// и вернувшийся игрок сразу получает новую графику. Отпечатки считает сборка (vite.config.ts,
// assetVersions); в разработке таблица пустая и адреса остаются как есть.

import versions from 'virtual:asset-versions';

/**
 * Адрес файла из public/ с отпечатком: 'assets/coin.png' → 'assets/coin.png?v=1a2b3c4d'.
 * Уже помеченный или неизвестный адрес возвращается без изменений — звать можно сколько угодно раз.
 */
export function assetUrl(path: string): string {
  const version = versions[path];
  return version ? `${path}?v=${version}` : path;
}

/** Картинка из public/assets по имени без расширения: png('coin') → 'assets/coin.png?v=…'. */
export const png = (name: string): string => assetUrl(`assets/${name}.png`);
