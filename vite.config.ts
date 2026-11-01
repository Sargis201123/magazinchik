import { defineConfig, type Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { atlasKeys, buildAtlas, type Atlas } from './scripts/atlas';

/** Флаги сборки Phaser из исходников (как DefinePlugin в его webpack-конфиге). */
const PHASER_FLAGS: Record<string, boolean> = {
  WEBGL_RENDERER: true,
  CANVAS_RENDERER: true,
  // Звук у игры свой (platform/mixer.ts), Phaser создаёт его без звука (audio.noAudio) — модуль не нужен.
  FEATURE_SOUND: false,
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

const hash = (data: Buffer | string): string => createHash('sha256').update(data).digest('hex').slice(0, 8);

const ASSETS_DIR = fileURLToPath(new URL('./public/assets/', import.meta.url));

/**
 * Атлас картинок мира (scripts/atlas.ts): собирается из public/assets при первой надобности и
 * заново, если картинки перерисовали (buildStart в сборке, слежение за файлами в разработке).
 * Список берётся из src/scenes/textures.ts — модуля без импортов: конфиг не тянет игровой код,
 * и правка экономики не перезапускает сервер разработки.
 */
let packed: Atlas | null = null;
const atlas = (): Atlas => (packed ??= buildAtlas(ASSETS_DIR, atlasKeys(ASSETS_DIR)));

/** Папки public/, чьи файлы (и файлы во вложенных папках) получают отпечаток в адресе (src/platform/assets.ts). */
const VERSIONED_DIRS = ['assets', 'story', 'audio'];
const VERSIONS_ID = 'virtual:asset-versions';

/**
 * Отпечатки картинок и музыки: public/assets и public/audio кэшируются у игроков на год (public/_headers),
 * а имена файлов не меняются — перерисованная картинка до вернувшегося игрока не доходила. В сборке у каждого файла
 * считаем хэш содержимого, и адрес становится «assets/coin.png?v=1a2b3c4d»: файл изменился — сменился
 * и адрес. Листы атласа (их в public/ нет — их пишет сборка) получают отпечаток так же.
 * Таблица отпечатков — модуль virtual:asset-versions; в разработке она пустая (кэша там нет).
 */
let versions: Record<string, string> | null = null;
const scan = (): Record<string, string> => {
  if (versions) return versions;
  const found: Record<string, string> = {};
  // Музыка лежит глубже (audio/music/suno/…) — обходим и вложенные папки.
  const walk = (dir: string): void => {
    const root = fileURLToPath(new URL(`./public/${dir}/`, import.meta.url));
    for (const name of readdirSync(root).sort()) {
      if (statSync(root + name).isDirectory()) walk(`${dir}/${name}`);
      else found[`${dir}/${name}`] = hash(readFileSync(root + name));
    }
  };
  for (const dir of VERSIONED_DIRS) walk(dir);
  for (const page of atlas().pages) {
    found[`assets/${page.name}.png`] = hash(page.png);
    found[`assets/${page.name}.json`] = hash(page.json);
  }
  versions = found;
  return versions;
};
const versioned = (path: string): string => (scan()[path] ? `${path}?v=${scan()[path]}` : path);

const assetVersions = (build: boolean): Plugin => {
  return {
    name: 'asset-versions',
    // Пересборка в режиме --watch: картинки могли перерисовать — считаем заново.
    buildStart: () => {
      versions = null;
      packed = null;
    },
    resolveId: (id) => (id === VERSIONS_ID ? `\0${VERSIONS_ID}` : null),
    load: (id) => (id === `\0${VERSIONS_ID}` ? `export default ${JSON.stringify(build ? scan() : {})};` : null),
    // Заставка в index.html (портрет бабушки) — тоже с отпечатком. Маленькая картинка (до 4 КБ) —
    // прямо в страницу (data:): заставка рисуется сразу, не дожидаясь отдельного запроса, который
    // на медленной связи стоит в очереди за кодом игры и атласом.
    transformIndexHtml: (html) =>
      build
        ? html.replace(/(["(])((?:assets|story)\/[\w.-]+)(?=[")])/g, (all, open: string, path: string) => {
            if (!scan()[path]) return all;
            const file = fileURLToPath(new URL(`./public/${path}`, import.meta.url));
            if (path.endsWith('.png') && statSync(file).size <= 4096) return `${open}data:image/png;base64,${readFileSync(file).toString('base64')}`;
            return `${open}${versioned(path)}`;
          })
        : html,
  };
};

/**
 * Подсказки браузеру (docs/PERFORMANCE.md): без них лист атласа, значки и шрифт начинали качаться,
 * только когда скачан и запущен весь код игры, — на медленной связи сеть полсекунды и больше
 * простаивала. Теперь они идут вместе с кодом. Адреса — ровно те, что потом попросят BootScene
 * (Phaser грузит картинки через XHR — отсюда as="fetch" и crossorigin) и CSS шрифта.
 * Шрифт — латиница и кириллица Nunito: их ждёт BootScene (FONT_SAMPLE). Раньше кириллицу браузер
 * просил сам, когда на холсте появлялась русская надпись, — и надписи зала (КУХНЯ, вывески) так и
 * оставались системным шрифтом. Кириллица — +21 КБ, но игроки в основном русскоязычные.
 */
const preloadHints = (): Plugin => ({
  name: 'preload-hints',
  transformIndexHtml: {
    order: 'post',
    handler: (html, ctx) => {
      // Стили сборки — это только @font-face шрифта (полтора килобайта): отдельный файл держал
      // первую отрисовку заставки до своего прихода, а прямо в странице не держит.
      for (const [file, out] of Object.entries(ctx.bundle ?? {})) {
        if (out.type !== 'asset' || !file.endsWith('.css')) continue;
        const link = new RegExp(`<link rel="stylesheet"[^>]*href="\\./${file.replace(/[.]/g, '\\.')}"[^>]*>`);
        const css = String(out.source).replace(/url\(\.\//g, 'url(assets/');
        if (link.test(html)) html = html.replace(link, () => `<style>${css}</style>`);
      }
      const fonts = Object.keys(ctx.bundle ?? {}).filter((file) => /\/nunito-(latin|cyrillic)-wght-normal-[\w-]+\.woff2$/.test(file));
      const sheets = [...atlas().pages.map((p) => p.name), 'ico_atlas'].flatMap((name) => [`assets/${name}.json`, `assets/${name}.png`]);
      const tags = [
        // Картинки листов — пониже кода: код нужен раньше (пока он запускается, лист докачивается).
        ...sheets.map((path) => ({
          tag: 'link',
          attrs: { rel: 'preload', href: versioned(path), as: 'fetch', crossorigin: '', ...(path.endsWith('.png') ? { fetchpriority: 'low' } : {}) },
          injectTo: 'head' as const,
        })),
        ...fonts.map((file) => ({ tag: 'link', attrs: { rel: 'preload', href: file, as: 'font', type: 'font/woff2', crossorigin: '' }, injectTo: 'head' as const })),
      ];
      return { html, tags };
    },
  },
});

const ATLAS_ID = 'virtual:atlas';

/**
 * Листы атласа в игре: в сборке — файлы dist/assets/atlas0.png и atlas0.json, в разработке их
 * отдаёт сам сервер (и собирает заново, когда art/*.py перерисовали картинки). Какие листы есть
 * и что в них не влезло, игра узнаёт из модуля virtual:atlas (BootScene).
 */
const atlasPlugin = (build: boolean): Plugin => ({
  name: 'atlas',
  resolveId: (id) => (id === ATLAS_ID ? `\0${ATLAS_ID}` : null),
  load: (id) => {
    if (id !== `\0${ATLAS_ID}`) return null;
    const { pages, loose } = atlas();
    return `export default ${JSON.stringify({ pages: pages.map((p) => ({ name: p.name, bytes: p.png.length })), loose })};`;
  },
  generateBundle() {
    if (!build) return;
    for (const page of atlas().pages) {
      this.emitFile({ type: 'asset', fileName: `assets/${page.name}.png`, source: page.png });
      this.emitFile({ type: 'asset', fileName: `assets/${page.name}.json`, source: page.json });
    }
  },
  configureServer(server) {
    server.watcher.on('all', (_event, file) => {
      if (!file.startsWith(ASSETS_DIR) || !file.endsWith('.png')) return;
      packed = null;
      const mod = server.moduleGraph.getModuleById(`\0${ATLAS_ID}`);
      if (mod) server.moduleGraph.invalidateModule(mod);
    });
    server.middlewares.use((req, res, next) => {
      const m = /^\/assets\/(atlas\d+)\.(png|json)(?:\?|$)/.exec(req.url ?? '');
      const page = m && atlas().pages.find((p) => p.name === m[1]);
      if (!m || !page) return next();
      res.setHeader('Content-Type', m[2] === 'png' ? 'image/png' : 'application/json');
      res.setHeader('Cache-Control', 'no-cache');
      res.end(m[2] === 'png' ? page.png : page.json);
    });
  },
});

export default defineConfig(({ command }) => ({
  base: './',
  plugins: command === 'build' ? [phaserFlags(), assetVersions(true), atlasPlugin(true), preloadHints()] : [assetVersions(false), atlasPlugin(false)],
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
