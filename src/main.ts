import Phaser from 'phaser';
// Свой шрифт с кириллицей (лежит в сборке): текст одинаково ровный на iPhone, Android и компьютере.
import '@fontsource-variable/nunito';
import { BootScene } from './scenes/BootScene';
import { StoreScene } from './scenes/StoreScene';

import { initTelegram } from './platform/telegram';
import { installErrorReporting } from './platform/errors';
import { loadLang } from './i18n';
import { startSync } from './game/save';
import { installFrameCap } from './platform/frameCap';
import { installPixelRounding, measureCanvas, watchScreen } from './platform/screen';
import { installClickSounds } from './ui/audio';

const BG = '#1d1a26';

installErrorReporting();
initTelegram(BG);
// Сохранение сверяется с облаком Telegram сразу, пока грузятся словарь и картинки (BootScene ждёт итог).
void startSync();

// Словарь языка — до запуска: сцены строят надписи сразу.
void loadLang().catch(() => undefined).then(start);

/**
 * WebGL или холст Canvas. Phaser 4 рисует через WebGL 1, но обязательно с двумя расширениями
 * (ANGLE_instanced_arrays, OES_vertex_array_object): без них он не запускается вовсе — падает при
 * создании игры. Они есть почти везде; на редком старом Android, где их нет, — Canvas, как без WebGL
 * (медленнее и без подсветок, зато игра идёт).
 */
function rendererType(): number {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return Phaser.CANVAS;
    const exts = gl.getSupportedExtensions() ?? [];
    const ok = exts.includes('ANGLE_instanced_arrays') && exts.includes('OES_vertex_array_object');
    // Пробный контекст сразу отдаём: их у страницы не больше 16, а у телефона — видеопамять.
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return ok ? Phaser.WEBGL : Phaser.CANVAS;
  } catch {
    return Phaser.CANVAS;
  }
}

function start(): void {
  // Не больше 60 кадров на быстрых экранах и 30 — под окнами во весь экран (platform/frameCap.ts).
  installFrameCap();
  // Кнопки и вкладки меню щёлкают деревом и бумагой (ui/audio.ts).
  installClickSounds();
  // Холст ровно по пикселям экрана (platform/screen.ts): браузер его не растягивает, Phaser — тоже.
  // Вершины округляются к пикселям холста, как в Phaser 3 (там же).
  installPixelRounding();
  const fit = measureCanvas();
  const game = new Phaser.Game({
    type: rendererType(),
    parent: 'game',
    backgroundColor: BG,
    pixelArt: true,
    roundPixels: true,
    // Phaser на Android качает по 6 файлов разом. Картинки мира теперь — один лист атласа, но не
    // влезшие в него грузятся по одной; сервер отдаёт по HTTP/2 — можно смело 32 параллельно.
    loader: { maxParallelDownloads: 32 },
    // Звуки и музыка — свои (platform/mixer.ts); звуковой модуль Phaser не нужен, а он создавал
    // второй, лишний аудиоконтекст.
    audio: { noAudio: true },
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.NO_CENTER,
      width: fit.width,
      height: fit.height,
    },
    scene: [BootScene, StoreScene],
  });
  // Размер на странице, отступы и новые размеры, когда окно меняется (полный экран Telegram, поворот).
  watchScreen(game);
  // Отладка: ?debug открывает доступ к игре из консоли браузера.
  if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { game });
}
