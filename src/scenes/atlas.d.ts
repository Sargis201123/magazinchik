// Листы атласа из сборки (vite.config.ts, плагин atlas; раскладка — scripts/atlas.ts).
declare module 'virtual:atlas' {
  const atlas: {
    /** Листы: имя текстуры и файлов (atlas0) и вес картинки в байтах — для полоски загрузки; lazy — лист эффектов fx0…, его докачивает магазин. */
    pages: { name: string; bytes: number; lazy: boolean }[];
    /** Картинки мира, не влезшие в лист: их игра грузит по одной. */
    loose: string[];
  };
  export default atlas;
}
