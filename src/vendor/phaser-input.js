// Ввод Phaser без клавиатуры и геймпада (phaser/src/input/index.js): игра — только касания и мышь.
import CONST from 'phaser/src/input/const.js';
import Extend from 'phaser/src/utils/object/Extend.js';
import CreatePixelPerfectHandler from 'phaser/src/input/CreatePixelPerfectHandler.js';
import CreateInteractiveObject from 'phaser/src/input/CreateInteractiveObject.js';
import Events from 'phaser/src/input/events/index.js';
import InputManager from 'phaser/src/input/InputManager.js';
import InputPlugin from 'phaser/src/input/InputPlugin.js';
import InputPluginCache from 'phaser/src/input/InputPluginCache.js';
import Mouse from 'phaser/src/input/mouse/index.js';
import Pointer from 'phaser/src/input/Pointer.js';
import Touch from 'phaser/src/input/touch/index.js';

export default Extend(
  false,
  { CreatePixelPerfectHandler, CreateInteractiveObject, Events, InputManager, InputPlugin, InputPluginCache, Mouse, Pointer, Touch },
  CONST,
);
