import { describe, expect, it } from 'vitest';
import manifestJson from '../public/audio/amb/manifest.json';
import {
  AMB,
  birdGap,
  crowGap,
  fireworksOn,
  glassAt,
  GLASS,
  murmurGains,
  rainFile,
  realNewYear,
  tramGap,
  wantedFiles,
  type AmbId,
  type AmbScene,
} from '../src/platform/ambienceLayers';

// Атмосфера из файлов: таблица совпадает с манифестом, файлы есть и лёгкие, качается только нужное
// по погоде и сезону, гомон растёт с числом покупателей, стекло витрины и «открытая дверь».

const manifest = manifestJson as unknown as {
  files: Record<string, { kind: string; path: string; loopStart?: number; loopEnd?: number; segments?: { id: string; start: number; dur: number }[]; bytes: { ogg: number; m4a: number } }>;
};
// Файлы, что лежат в public/audio/amb (vite находит их сам, без node:fs).
const FILES = new Set(Object.keys(import.meta.glob('../public/audio/amb/*.{ogg,m4a}')).map((f) => f.replace('../public/', '')));

const scene = (patch: Partial<AmbScene> = {}): AmbScene => ({
  weather: 'clear',
  season: 'summer',
  lateAutumn: false,
  evening: 0,
  morning: 0,
  customers: 0,
  newYear: false,
  night: false,
  lite: false,
  ...patch,
});

describe('файлы атмосферы', () => {
  it('таблица AMB совпадает с manifest.json (петли и куски нарезки)', () => {
    expect(Object.keys(AMB).sort()).toEqual(Object.keys(manifest.files).sort());
    for (const [id, file] of Object.entries(AMB)) {
      const m = manifest.files[id];
      expect(m.path).toBe(file.path);
      expect(m.kind).toBe(file.kind);
      if (file.kind === 'loop') {
        expect(file.loopStart).toBeCloseTo(m.loopStart!, 3);
        expect(file.loopEnd).toBeCloseTo(m.loopEnd!, 3);
        continue;
      }
      const ours = Object.values(file.groups).flat().sort((a, b) => a[0] - b[0]);
      const theirs = m.segments!.map((s) => [s.start, s.dur]);
      expect(ours.length).toBe(theirs.length);
      ours.forEach(([start, dur], i) => {
        expect(start).toBeCloseTo(theirs[i][0], 3);
        expect(dur).toBeCloseTo(theirs[i][1], 3);
      });
    }
  });

  it('у каждого файла есть Opus и AAC, всё вместе — не больше 3 МБ на сервере', () => {
    let total = 0;
    for (const [id, file] of Object.entries(AMB)) {
      for (const ext of ['ogg', 'm4a'] as const) {
        expect(FILES.has(`${file.path}.${ext}`), `${file.path}.${ext}`).toBe(true);
        total += manifest.files[id].bytes[ext];
      }
    }
    expect(total).toBeLessThan(3e6);
  });

  it('петли — не короче 20 с: повтор дождя и гомона не угадывается', () => {
    for (const file of Object.values(AMB)) if (file.kind === 'loop') expect(file.loopEnd - file.loopStart).toBeGreaterThan(20);
  });
});

describe('что качать сейчас', () => {
  const has = (s: AmbScene, id: AmbId) => wantedFiles(s).includes(id);

  it('без покупателей и в сухую погоду — только мелкие звуки улицы, птицы летом и вороны поздней осенью', () => {
    expect(wantedFiles(scene({ evening: 0.6 }))).toEqual(['street']);
    expect(wantedFiles(scene())).toEqual(['street', 'birds']);
    expect(wantedFiles(scene({ season: 'autumn' }))).toEqual(['street']);
    expect(wantedFiles(scene({ season: 'autumn', lateAutumn: true }))).toEqual(['street', 'crows']);
  });

  it('дождь — только в свою погоду: дождь или ливень, не оба; на слабом телефоне — без записи', () => {
    expect(has(scene({ weather: 'rain' }), 'rain')).toBe(true);
    expect(has(scene({ weather: 'rain' }), 'downpour')).toBe(false);
    expect(has(scene({ weather: 'storm' }), 'downpour')).toBe(true);
    expect(has(scene({ weather: 'storm' }), 'rain')).toBe(false);
    expect(rainFile(scene({ weather: 'storm', lite: true }))).toBeNull();
    expect(has(scene({ weather: 'snow' }), 'rain')).toBe(false);
  });

  it('гомон — когда в зале есть покупатели', () => {
    expect(has(scene(), 'murmur')).toBe(false);
    expect(has(scene({ customers: 1 }), 'murmur')).toBe(true);
  });

  it('птицы — весной и летом, утром чаще; в дождь, снег, вечером и зимой молчат', () => {
    expect(birdGap(scene({ morning: 1 }))![1]).toBeLessThan(birdGap(scene({ morning: 0 }))![0] + 1);
    expect(birdGap(scene({ season: 'spring' }))).not.toBeNull();
    expect(birdGap(scene({ weather: 'rain' }))).toBeNull();
    expect(birdGap(scene({ evening: 0.7 }))).toBeNull();
    expect(birdGap(scene({ season: 'winter' }))).toBeNull();
    expect(has(scene({ season: 'winter' }), 'birds')).toBe(false);
  });

  it('вороны — зимой и в снег часто, поздней осенью реже, в начале осени, летом и в темноте — нет', () => {
    const winter = crowGap(scene({ season: 'winter' }))!;
    const autumn = crowGap(scene({ season: 'autumn', lateAutumn: true }))!;
    expect(winter[1]).toBeLessThan(autumn[0] + 1);
    expect(crowGap(scene({ weather: 'snow', season: 'autumn' }))).toEqual(winter);
    expect(crowGap(scene())).toBeNull();
    // Начало осени (со школы до урожая): ворон нет — файл не качается и не играет.
    expect(crowGap(scene({ season: 'autumn' }))).toBeNull();
    expect(has(scene({ season: 'autumn', weather: 'leaves' }), 'crows')).toBe(false);
    expect(crowGap(scene({ season: 'autumn', lateAutumn: true, weather: 'rain' }))).toBeNull();
    expect(crowGap(scene({ season: 'winter', night: true }))).toBeNull();
    expect(has(scene({ season: 'winter', weather: 'snow' }), 'crows')).toBe(true);
  });

  it('салют — только на Новый год и только как стемнеет (или в ночную смену)', () => {
    expect(fireworksOn(scene({ newYear: true, evening: 0.1 }))).toBe(false);
    expect(fireworksOn(scene({ newYear: true, evening: 0.5 }))).toBe(true);
    expect(fireworksOn(scene({ newYear: true, night: true }))).toBe(true);
    expect(fireworksOn(scene({ evening: 1 }))).toBe(false);
    expect(has(scene({ newYear: true, evening: 0.6, season: 'winter' }), 'fireworks')).toBe(true);
  });

  it('трамвай — раз в одну-три минуты, ночью и на слабом телефоне реже', () => {
    const day = tramGap(scene())!;
    expect(day[0]).toBeGreaterThanOrEqual(60);
    expect(tramGap(scene({ night: true }))![0]).toBeGreaterThan(day[0]);
    expect(tramGap(scene({ lite: true }))![0]).toBeGreaterThan(day[0]);
  });

  it('настоящий Новый год — 31 декабря и 1 января', () => {
    expect(realNewYear(new Date(2026, 11, 31, 22))).toBe(true);
    expect(realNewYear(new Date(2027, 0, 1, 3))).toBe(true);
    expect(realNewYear(new Date(2026, 11, 30))).toBe(false);
    expect(realNewYear(new Date(2027, 0, 2))).toBe(false);
  });
});

describe('гомон покупателей', () => {
  it('пусто — тишина; растёт с числом людей и не выше полной громкости', () => {
    expect(murmurGains(0, false)).toEqual([0, 0, 0]);
    let prev = -1;
    for (let n = 0; n <= 20; n++) {
      const g = murmurGains(n, false);
      const sum = g.reduce((a, b) => a + b, 0);
      expect(sum).toBeGreaterThanOrEqual(prev);
      expect(Math.max(...g)).toBeLessThanOrEqual(1);
      prev = sum;
    }
  });

  it('один-два человека — один тихий слой; второй и третий — только когда людно', () => {
    expect(murmurGains(2, false)[1]).toBe(0);
    expect(murmurGains(2, false)[0]).toBeLessThan(1);
    expect(murmurGains(8, false)[1]).toBeGreaterThan(0);
    expect(murmurGains(12, false)[2]).toBeGreaterThan(0);
  });

  it('на слабом телефоне — один слой', () => {
    for (const n of [1, 5, 15]) expect(murmurGains(n, true).slice(1)).toEqual([0, 0]);
    expect(murmurGains(15, true)[0]).toBeGreaterThan(murmurGains(3, true)[0] - 1e-9);
  });
});

describe('стекло витрины и дверь', () => {
  it('закрыто — верх глуше; открыто — стекла нет, улица чуть громче', () => {
    expect(glassAt(0)).toEqual({ shelf: GLASS.shelf, cut: GLASS.cut, gain: 1 });
    const open = glassAt(1);
    expect(open.shelf).toBeCloseTo(0, 6);
    expect(open.cut).toBeCloseTo(GLASS.open, 3);
    expect(open.gain).toBeCloseTo(GLASS.lift, 6);
  });

  it('по мере открытия — плавно и монотонно, за пределами 0…1 не выходит', () => {
    let prev = glassAt(0);
    for (let k = 0.1; k <= 1.0001; k += 0.1) {
      const g = glassAt(k);
      expect(g.cut).toBeGreaterThan(prev.cut);
      expect(g.shelf).toBeGreaterThan(prev.shelf);
      expect(g.gain).toBeGreaterThanOrEqual(prev.gain);
      prev = g;
    }
    expect(glassAt(-1)).toEqual(glassAt(0));
    expect(glassAt(2)).toEqual(glassAt(1));
  });
});
