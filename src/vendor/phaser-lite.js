// Phaser без физики и тайловых карт (в игре их нет): та же сборка, что phaser/src/phaser.js,
// минус Physics и Tilemaps — бандл легче. Подключается только в production-сборке (vite.config.ts);
// в разработке — обычный phaser. Флаги вида «typeof WEBGL_RENDERER» подставляет плагин там же.
// Ещё легче (docs/PERFORMANCE.md): из игровых объектов — только те, что игра создаёт (без видео, групп,
// мешей, шейдеров, растровых шрифтов, верёвок…), загрузчик знает лишь картинки, атласы и JSON,
// ввод — без клавиатуры и геймпада, звукового модуля Phaser нет вовсе (FEATURE_SOUND: звук свой,
// platform/mixer.ts). Новый вид объекта (this.add.<что-то>) — допишите его в GameObjects ниже.
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
import Create from 'phaser/src/create/index.js';
import Curves from 'phaser/src/curves/index.js';
import Data from 'phaser/src/data/index.js';
import Display from 'phaser/src/display/index.js';
import DOM from 'phaser/src/dom/index.js';
import Events from 'phaser/src/events/index.js';
import FX from 'phaser/src/fx/index.js';
import Game from 'phaser/src/core/Game.js';
import Geom from 'phaser/src/geom/index.js';
import PMath from 'phaser/src/math/index.js';
import Plugins from 'phaser/src/plugins/index.js';
import Renderer from 'phaser/src/renderer/index.js';
import Scale from 'phaser/src/scale/index.js';
import ScaleModes from 'phaser/src/renderer/ScaleModes.js';
import Scene from 'phaser/src/scene/Scene.js';
import Scenes from 'phaser/src/scene/index.js';
import Structs from 'phaser/src/structs/index.js';
import Textures from 'phaser/src/textures/index.js';
import Time from 'phaser/src/time/index.js';
import Tweens from 'phaser/src/tweens/index.js';
import Utils from 'phaser/src/utils/index.js';
import GameObjects from './phaser-objects.js';
import Input from './phaser-input.js';
import Loader from './phaser-loader.js';

const Phaser = Extend(
  false,
  {
    Actions, Animations, BlendModes, Cache, Cameras, Core, Class, Create, Curves, Data, Display, DOM, Events, FX, Game,
    GameObjects, Geom, Input, Loader, Math: PMath, Plugins, Renderer, Scale, ScaleModes, Scene, Scenes, Structs,
    Textures, Time, Tweens, Utils,
  },
  CONST,
);
globalThis.Phaser = Phaser;
export default Phaser;
