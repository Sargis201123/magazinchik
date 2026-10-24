// Листы атласа из сборки (vite.config.ts, плагин atlas; раскладка — scripts/atlas.ts).
declare module 'virtual:atlas' {
  const atlas: {
    /** Листы: имя текстуры и файлов (atlas0) и вес картинки в байтах — для полоски загрузки. */
    pages: { name: string; bytes: number }[];
    /** Картинки мира, не влезшие в лист: их игра грузит по одной. */
    loose: string[];
  };
  export default atlas;
}
