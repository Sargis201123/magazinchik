// Phaser без физики и тайловых карт (в игре их нет): та же сборка, что phaser/src/phaser.js,
// минус Physics и Tilemaps — бандл легче. Подключается только в production-сборке (vite.config.ts);
// в разработке — обычный phaser. Флаги вида «typeof WEBGL_RENDERER» подставляет плагин там же.
// Phaser 4: вместо FX — Filters (фильтры на любом объекте и камере), добавились TintModes; папки
// create/ больше нет. Пути phaser/src/… vite.config.ts направляет прямо в папку пакета: в Phaser 4
// пакет закрыт полем exports и такие импорты сам не пускает.
import 'phaser/src/polyfills/requestVideoFrame.js';
import CONST from 'phaser/src/const.js';
import Extend from 'phaser/src/utils/object/Extend.js';
import Actions from 'phaser/src/actions/index.js';
import Animations from 'phaser/src/animations/index.js';
import BlendModes from 'phaser/src/renderer/BlendModes.js';
import Cache from 'phaser/src/cache/index.js';
import Cameras from 'phaser/src/cameras/index.js';
import Core from 'phaser/src/core/index.js';
import Class from 'phaser/src/utils/Class.js';
import Curves from 'phaser/src/curves/index.js';
import Data from 'phaser/src/data/index.js';
import Display from 'phaser/src/display/index.js';
import DOM from 'phaser/src/dom/index.js';
import Events from 'phaser/src/events/index.js';
import Filters from 'phaser/src/filters/index.js';
import Game from 'phaser/src/core/Game.js';
import GameObjects from 'phaser/src/gameobjects/index.js';
import Geom from 'phaser/src/geom/index.js';
import Input from 'phaser/src/input/index.js';
import Loader from 'phaser/src/loader/index.js';
import PMath from 'phaser/src/math/index.js';
import Plugins from 'phaser/src/plugins/index.js';
import Renderer from 'phaser/src/renderer/index.js';
import Scale from 'phaser/src/scale/index.js';
import ScaleModes from 'phaser/src/renderer/ScaleModes.js';
import Scene from 'phaser/src/scene/Scene.js';
import Scenes from 'phaser/src/scene/index.js';
import Sound from 'phaser/src/sound/index.js';
import Structs from 'phaser/src/structs/index.js';
import Textures from 'phaser/src/textures/index.js';
import Time from 'phaser/src/time/index.js';
import TintModes from 'phaser/src/renderer/TintModes.js';
import Tweens from 'phaser/src/tweens/index.js';
import Utils from 'phaser/src/utils/index.js';

const Phaser = Extend(
  false,
  {
    Actions, Animations, BlendModes, Cache, Cameras, Core, Class, Curves, Data, Display, DOM, Events, Filters, Game,
    GameObjects, Geom, Input, Loader, Math: PMath, Plugins, Renderer, Scale, ScaleModes, Scene, Scenes, Sound, Structs,
    Textures, Time, TintModes, Tweens, Utils,
  },
  CONST,
);
globalThis.Phaser = Phaser;
export default Phaser;
