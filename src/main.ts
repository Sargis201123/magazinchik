import Phaser from 'phaser';
// Свой шрифт с кириллицей (лежит в сборке): текст одинаково ровный на iPhone, Android и компьютере.
import '@fontsource-variable/nunito';
import { BootScene } from './scenes/BootScene';
import { ASPECT, CANVAS_H, CANVAS_W, StoreScene } from './scenes/StoreScene';

import { initTelegram } from './platform/telegram';
import { installErrorReporting } from './platform/errors';
import { loadLang } from './i18n';
import { startSync } from './game/save';
import { installFrameCap } from './platform/frameCap';
import { installClickSounds } from './ui/audio';

const BG = '#1d1a26';
// Панели интерфейса — по ширине холста (на компьютере он уже окна).
document.documentElement.style.setProperty('--game-w', `min(100vw, ${(100 / ASPECT).toFixed(2)}dvh)`);

installErrorReporting();
initTelegram(BG);
// Сохранение сверяется с облаком Telegram сразу, пока грузятся словарь и картинки (BootScene ждёт итог).
void startSync();

// Словарь языка — до запуска: сцены строят надписи сразу.
void loadLang().catch(() => undefined).then(start);

function start(): void {
  // Не больше 60 кадров на быстрых экранах и 30 — под окнами во весь экран (platform/frameCap.ts).
  installFrameCap();
  // Кнопки и вкладки меню щёлкают деревом и бумагой (ui/audio.ts).
  installClickSounds();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
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
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: CANVAS_W,
      height: CANVAS_H,
    },
    scene: [BootScene, StoreScene],
  });
  // Отладка: ?debug открывает доступ к игре из консоли браузера.
  if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { game });
}
