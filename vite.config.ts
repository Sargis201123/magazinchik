import { defineConfig, type Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Флаги сборки Phaser из исходников (как DefinePlugin в его webpack-конфиге). */
const PHASER_FLAGS: Record<string, boolean> = {
  WEBGL_RENDERER: true,
  CANVAS_RENDERER: true,
  FEATURE_SOUND: true,
  WEBGL_DEBUG: false,
  EXPERIMENTAL: false,
  PLUGIN_3D: false,
  PLUGIN_CAMERA3D: false,
  PLUGIN_FBINSTANT: false,
};

const phaserFlags = (): Plugin => ({
  name: 'phaser-flags',
  transform(code, id) {
    if (!id.includes('/node_modules/phaser/src/')) return null;
    return code.replace(/typeof (WEBGL_RENDERER|CANVAS_RENDERER|FEATURE_SOUND|WEBGL_DEBUG|EXPERIMENTAL|PLUGIN_3D|PLUGIN_CAMERA3D|PLUGIN_FBINSTANT)\b/g, (_, flag: string) =>
      JSON.stringify(PHASER_FLAGS[flag]),
    );
  },
});

/** Папки public/, чьи файлы (и файлы во вложенных папках) получают отпечаток в адресе (src/platform/assets.ts). */
const VERSIONED_DIRS = ['assets', 'story', 'audio'];
const VERSIONS_ID = 'virtual:asset-versions';

/**
 * Отпечатки картинок и музыки: public/assets и public/audio кэшируются у игроков на год (public/_headers),
 * а имена файлов не меняются — перерисованная картинка до вернувшегося игрока не доходила. В сборке у каждого файла
 * считаем хэш содержимого, и адрес становится «assets/coin.png?v=1a2b3c4d»: файл изменился — сменился
 * и адрес. Таблица отпечатков — модуль virtual:asset-versions; в разработке она пустая (кэша там нет).
 */
const assetVersions = (build: boolean): Plugin => {
  let versions: Record<string, string> | null = null;
  const scan = (): Record<string, string> => {
    if (versions) return versions;
    const found: Record<string, string> = {};
    // Музыка лежит глубже (audio/music/suno/…) — обходим и вложенные папки.
    const walk = (dir: string): void => {
      const root = fileURLToPath(new URL(`./public/${dir}/`, import.meta.url));
      for (const name of readdirSync(root).sort()) {
        if (statSync(root + name).isDirectory()) walk(`${dir}/${name}`);
        else found[`${dir}/${name}`] = createHash('sha256').update(readFileSync(root + name)).digest('hex').slice(0, 8);
      }
    };
    for (const dir of VERSIONED_DIRS) walk(dir);
    versions = found;
    return versions;
  };
  return {
    name: 'asset-versions',
    // Пересборка в режиме --watch: картинки могли перерисовать — считаем заново.
    buildStart: () => {
      versions = null;
    },
    resolveId: (id) => (id === VERSIONS_ID ? `\0${VERSIONS_ID}` : null),
    load: (id) => (id === `\0${VERSIONS_ID}` ? `export default ${JSON.stringify(build ? scan() : {})};` : null),
    // Заставка в index.html (портрет бабушки) — тоже с отпечатком.
    transformIndexHtml: (html) =>
      build ? html.replace(/(["(])((?:assets|story)\/[\w.-]+)(?=[")])/g, (all, open: string, path: string) => (scan()[path] ? `${open}${path}?v=${scan()[path]}` : all)) : html,
  };
};

export default defineConfig(({ command }) => ({
  base: './',
  plugins: command === 'build' ? [phaserFlags(), assetVersions(true)] : [assetVersions(false)],
  resolve: {
    // В production — Phaser без физики и тайловых карт (src/vendor/phaser-lite.js).
    alias: command === 'build' ? [{ find: /^phaser$/, replacement: fileURLToPath(new URL('./src/vendor/phaser-lite.js', import.meta.url)) }] : [],
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: (id) => (id.includes('/node_modules/phaser/') || id.includes('/src/vendor/phaser-lite') ? 'phaser' : undefined),
      },
    },
  },
}));
