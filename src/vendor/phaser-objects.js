// Игровые объекты Phaser, которые игра создаёт (phaser/src/gameobjects/index.js без лишнего).
// Фабрика this.add.* и this.make.* узнаёт объект, когда подключён его *Factory / *Creator.
import Events from 'phaser/src/gameobjects/events/index.js';
import DisplayList from 'phaser/src/gameobjects/DisplayList.js';
import GameObjectCreator from 'phaser/src/gameobjects/GameObjectCreator.js';
import GameObjectFactory from 'phaser/src/gameobjects/GameObjectFactory.js';
import UpdateList from 'phaser/src/gameobjects/UpdateList.js';
import Components from 'phaser/src/gameobjects/components/index.js';
import GetCalcMatrix from 'phaser/src/gameobjects/GetCalcMatrix.js';
import BuildGameObject from 'phaser/src/gameobjects/BuildGameObject.js';
import BuildGameObjectAnimation from 'phaser/src/gameobjects/BuildGameObjectAnimation.js';
import GameObject from 'phaser/src/gameobjects/GameObject.js';
import Container from 'phaser/src/gameobjects/container/Container.js';
import Graphics from 'phaser/src/gameobjects/graphics/Graphics.js';
import Image from 'phaser/src/gameobjects/image/Image.js';
import Particles from 'phaser/src/gameobjects/particles/index.js';
import RenderTexture from 'phaser/src/gameobjects/rendertexture/RenderTexture.js';
import Sprite from 'phaser/src/gameobjects/sprite/Sprite.js';
import Text from 'phaser/src/gameobjects/text/Text.js';
import GetTextSize from 'phaser/src/gameobjects/text/GetTextSize.js';
import MeasureText from 'phaser/src/gameobjects/text/MeasureText.js';
import TextStyle from 'phaser/src/gameobjects/text/TextStyle.js';
import TileSprite from 'phaser/src/gameobjects/tilesprite/TileSprite.js';
import Zone from 'phaser/src/gameobjects/zone/Zone.js';
import Shape from 'phaser/src/gameobjects/shape/Shape.js';
import Arc from 'phaser/src/gameobjects/shape/arc/Arc.js';
import Ellipse from 'phaser/src/gameobjects/shape/ellipse/Ellipse.js';
import Line from 'phaser/src/gameobjects/shape/line/Line.js';
import Rectangle from 'phaser/src/gameobjects/shape/rectangle/Rectangle.js';
import Triangle from 'phaser/src/gameobjects/shape/triangle/Triangle.js';
import NineSlice from 'phaser/src/gameobjects/nineslice/NineSlice.js';
import ContainerFactory from 'phaser/src/gameobjects/container/ContainerFactory.js';
import GraphicsFactory from 'phaser/src/gameobjects/graphics/GraphicsFactory.js';
import ImageFactory from 'phaser/src/gameobjects/image/ImageFactory.js';
import ParticlesFactory from 'phaser/src/gameobjects/particles/ParticleEmitterFactory.js';
import RenderTextureFactory from 'phaser/src/gameobjects/rendertexture/RenderTextureFactory.js';
import SpriteFactory from 'phaser/src/gameobjects/sprite/SpriteFactory.js';
import TextFactory from 'phaser/src/gameobjects/text/TextFactory.js';
import TileSpriteFactory from 'phaser/src/gameobjects/tilesprite/TileSpriteFactory.js';
import ZoneFactory from 'phaser/src/gameobjects/zone/ZoneFactory.js';
import ArcFactory from 'phaser/src/gameobjects/shape/arc/ArcFactory.js';
import EllipseFactory from 'phaser/src/gameobjects/shape/ellipse/EllipseFactory.js';
import LineFactory from 'phaser/src/gameobjects/shape/line/LineFactory.js';
import RectangleFactory from 'phaser/src/gameobjects/shape/rectangle/RectangleFactory.js';
import TriangleFactory from 'phaser/src/gameobjects/shape/triangle/TriangleFactory.js';
import NineSliceFactory from 'phaser/src/gameobjects/nineslice/NineSliceFactory.js';
import GraphicsCreator from 'phaser/src/gameobjects/graphics/GraphicsCreator.js';
import ImageCreator from 'phaser/src/gameobjects/image/ImageCreator.js';

export default {
  Events, DisplayList, GameObjectCreator, GameObjectFactory, UpdateList, Components, GetCalcMatrix, BuildGameObject,
  BuildGameObjectAnimation, GameObject, Container, Graphics, Image, Particles, RenderTexture, Sprite, Text, GetTextSize,
  MeasureText, TextStyle, TileSprite, Zone, Shape, Arc, Ellipse, Line, Rectangle, Triangle, NineSlice,
  Factories: {
    Container: ContainerFactory, Graphics: GraphicsFactory, Image: ImageFactory, Particles: ParticlesFactory,
    RenderTexture: RenderTextureFactory, Sprite: SpriteFactory, Text: TextFactory, TileSprite: TileSpriteFactory, Zone: ZoneFactory,
    Arc: ArcFactory, Ellipse: EllipseFactory, Line: LineFactory, Rectangle: RectangleFactory, Triangle: TriangleFactory, NineSlice: NineSliceFactory,
  },
  Creators: { Graphics: GraphicsCreator, Image: ImageCreator },
};
