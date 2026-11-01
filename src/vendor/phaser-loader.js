// Загрузчик Phaser с теми типами файлов, что грузит игра: картинки, атласы, JSON (phaser/src/loader/index.js
// без звука, видео, шрифтов, тайловых карт…). Тип регистрирует this.load.<тип>, когда его файл подключён.
import CONST from 'phaser/src/loader/const.js';
import Extend from 'phaser/src/utils/object/Extend.js';
import Events from 'phaser/src/loader/events/index.js';
import File from 'phaser/src/loader/File.js';
import FileTypesManager from 'phaser/src/loader/FileTypesManager.js';
import GetURL from 'phaser/src/loader/GetURL.js';
import LoaderPlugin from 'phaser/src/loader/LoaderPlugin.js';
import MergeXHRSettings from 'phaser/src/loader/MergeXHRSettings.js';
import MultiFile from 'phaser/src/loader/MultiFile.js';
import XHRLoader from 'phaser/src/loader/XHRLoader.js';
import XHRSettings from 'phaser/src/loader/XHRSettings.js';
import AtlasJSONFile from 'phaser/src/loader/filetypes/AtlasJSONFile.js';
import ImageFile from 'phaser/src/loader/filetypes/ImageFile.js';
import JSONFile from 'phaser/src/loader/filetypes/JSONFile.js';

export default Extend(
  false,
  {
    Events, FileTypes: { AtlasJSONFile, ImageFile, JSONFile }, File, FileTypesManager, GetURL, LoaderPlugin, MergeXHRSettings,
    MultiFile, XHRLoader, XHRSettings,
  },
  CONST,
);
