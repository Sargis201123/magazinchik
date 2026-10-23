// Таблица отпечатков картинок из сборки (vite.config.ts, assetVersions): путь в public/ → хэш содержимого.
declare module 'virtual:asset-versions' {
  const versions: Record<string, string>;
  export default versions;
}
