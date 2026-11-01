import { describe, expect, it } from 'vitest';

// В сборке игра идёт на облегчённом Phaser (src/vendor/phaser-lite.js): только те игровые объекты
// и типы файлов, что она создаёт. В разработке — полный Phaser, так что новый this.add.<что-то>
// работал бы у автора и падал у игроков. Проверка: всё, что код зовёт, в облегчённом есть.

const raw = (files: Record<string, unknown>): Record<string, string> => files as Record<string, string>;
const sources = raw(import.meta.glob(['../src/**/*.ts', '!../src/vendor/**'], { query: '?raw', import: 'default', eager: true }));
const vendors = raw(import.meta.glob('../src/vendor/*.js', { query: '?raw', import: 'default', eager: true }));
const phaser = raw(import.meta.glob('/node_modules/phaser/src/gameobjects/**/*{Factory,Creator}.js', { query: '?raw', import: 'default', eager: true }));
const code = Object.values(sources).join('\n');
const vendor = (name: string): string => vendors[`../src/vendor/${name}`] ?? '';
const used = (re: RegExp): string[] => [...new Set([...code.matchAll(re)].map((m) => m[1]))].sort();
/** Какие методы add/make регистрируют подключённые фабрики (GameObjectFactory.register('circle', …)). */
const registered = (kind: 'Factory' | 'Creator'): Set<string> => {
  const files = [...vendor('phaser-objects.js').matchAll(new RegExp(`from 'phaser/(src/[\\w/]+${kind}\\.js)'`, 'g'))].map((m) => m[1]);
  const names = files.flatMap((file) => [...(phaser[`/node_modules/phaser/${file}`] ?? '').matchAll(/\.register\('(\w+)'/g)].map((m) => m[1]));
  return new Set(names);
};

describe('облегчённый Phaser', () => {
  it('знает все виды объектов, что игра создаёт через add и make', () => {
    const factories = registered('Factory');
    const creators = registered('Creator');
    expect(factories.size).toBeGreaterThan(10);
    expect(used(/\badd\.(\w+)\(/g).length).toBeGreaterThan(5);
    // scene.add.existing — не фабрика объекта; tweens.add и прочие add(...) регулярка не ловит.
    for (const method of used(/\badd\.(\w+)\(/g)) if (method !== 'existing') expect(factories.has(method), `this.add.${method}`).toBe(true);
    for (const method of used(/\bmake\.(\w+)\(/g)) expect(creators.has(method), `this.make.${method}`).toBe(true);
  });

  it('загрузчик умеет все типы файлов, что игра грузит', () => {
    const loader = vendor('phaser-loader.js');
    const types: Record<string, string> = { image: 'ImageFile', atlas: 'AtlasJSONFile', json: 'JSONFile' };
    for (const method of used(/\bload\.(image|atlas|json|audio|spritesheet|bitmapFont|multiatlas|svg|text|video|html|xml|binary|glsl|plugin|script|pack|aseprite|unityAtlas|atlasXML|css|animation)\(/g)) {
      expect(types[method], `this.load.${method}`).toBeDefined();
      expect(loader).toContain(types[method]);
    }
  });

  it('звука и клавиатуры Phaser игра не трогает (их в сборке нет)', () => {
    expect(code).not.toMatch(/\b(?:this|scene)\.sound\./);
    expect(code).not.toMatch(/\binput\.(?:keyboard|gamepad)\b/);
  });
});
