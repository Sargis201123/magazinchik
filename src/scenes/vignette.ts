// Виньетка как в Phaser 3. У встроенного фильтра Vignette в Phaser 4 другая формула: затемнение —
// синус расстояния от середины, а в Phaser 3 был его куб. С теми же числами (радиус 0,95, сила 0,1)
// днём края кадра темнели на 15–25% вместо прежнего едва заметного 1%, а вечером (сила 0,5) зал
// уходил в сумрак. Свой маленький фильтр с прежним шейдером — и картинка та же, что была.

import Phaser from 'phaser';

/** Имя узла отрисовки (render node) Phaser 4 для этого фильтра. */
const NODE = 'FilterSoftVignette';

/** Шейдер виньетки Phaser 3 (FXVignette), только в именах и шапке Phaser 4. */
const FRAG = [
  '#pragma phaserTemplate(shaderName)',
  'precision mediump float;',
  'uniform sampler2D uMainSampler;',
  'uniform float uRadius;',
  'uniform float uStrength;',
  'uniform vec2 uPosition;',
  'varying vec2 outTexCoord;',
  'void main ()',
  '{',
  '    vec4 col = vec4(1.0);',
  // В Phaser 4 ось Y текстур снизу вверх — середину переворачиваем, как встроенный фильтр.
  '    float d = length(outTexCoord - vec2(uPosition.x, 1.0 - uPosition.y));',
  '    if (d <= uRadius)',
  '    {',
  '        float g = sin(d / uRadius * 3.14 * uStrength);',
  '        col = vec4(g * g * g);',
  '    }',
  '    gl_FragColor = texture2D(uMainSampler, outTexCoord) * (1.0 - col);',
  '}',
].join('\n');

/** Настройки виньетки — их сцена меняет к вечеру (radius, strength), как у прежней. */
export class SoftVignette extends Phaser.Filters.Controller {
  /** Середина виньетки, доли кадра. */
  x = 0.5;
  y = 0.5;
  constructor(
    camera: Phaser.Cameras.Scene2D.Camera,
    /** Радиус (доля кадра): к нему картинка темнеет, за ним — чёрная. Углы кадра (0,71) у нас всегда внутри: 0,83…0,95. */
    public radius: number,
    /** Насколько круто темнеет к радиусу. */
    public strength: number,
  ) {
    super(camera, NODE);
  }
}

/** Узел отрисовки: прогоняет кадр камеры через шейдер выше. */
class SoftVignetteNode extends Phaser.Renderer.WebGL.RenderNodes.BaseFilterShader {
  constructor(manager: Phaser.Renderer.WebGL.RenderNodes.RenderNodeManager) {
    super(NODE, manager, undefined, FRAG);
  }

  setupUniforms(controller: SoftVignette): void {
    const program = this.programManager;
    program.setUniform('uRadius', controller.radius);
    program.setUniform('uStrength', controller.strength);
    program.setUniform('uPosition', [controller.x, controller.y]);
  }
}

/** Виньетка поверх всего кадра камеры (внешний фильтр). Только WebGL: на холсте Canvas фильтров нет. */
export function addSoftVignette(camera: Phaser.Cameras.Scene2D.Camera, radius: number, strength: number): SoftVignette | undefined {
  const renderer = camera.scene.renderer;
  if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return undefined;
  if (!renderer.renderNodes.hasNode(NODE)) renderer.renderNodes.addNodeConstructor(NODE, SoftVignetteNode);
  return camera.filters.external.add(new SoftVignette(camera, radius, strength)) as SoftVignette;
}
