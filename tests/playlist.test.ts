import { describe, expect, it } from 'vitest';
import manifestJson from '../public/audio/music/manifest.json';
import {
  clashes,
  jingleNotes,
  LOOPS,
  loopKeyAt,
  musicFormat,
  nearestStingKey,
  NIGHT_GAP,
  pickTrack,
  Playlist,
  POOLS,
  RESUME_GAP,
  SILENCE,
  smoothSeam,
  STING_KEYS,
  stingPath,
  STINGS,
  TRACKS,
  winterMusic,
  type Cue,
  type MusicMood,
  type TrackId,
} from '../src/platform/playlist';
import { seeded } from '../src/platform/ambienceSynth';

// Музыка: таблица файлов совпадает с манифестом, выбор трека по настроению, тишина между треками,
// смена «не к месту», радио держит музыку, заставки в тональности музыки, формат файла.

const manifest = manifestJson as unknown as {
  stingerKeys: Record<string, Record<string, string>>;
  seamCrossfadeSamples: number;
  sampleRate: number;
  tracks: Record<string, { kind: string; files: { ogg: string; m4a: string }; duration: number; key: string; gainDb?: number; loopStart?: number; loopEnd?: number; duckDb?: number; keySections?: { start: number; end: number; key: string }[] }>;
};
/** Что лежит в public/audio (пути от public/). */
const FILES = new Set(Object.keys(import.meta.glob('../public/audio/**/*.{ogg,m4a}')).map((f) => f.replace('../public/', '')));
const onDisk = (path: string) => FILES.has(path);

describe('файлы музыки — как в манифесте', () => {
  it('основная музыка — треки Suno: файлы на месте в обоих форматах, длительность и тональность как в манифесте', () => {
    for (const [id, track] of Object.entries(TRACKS)) {
      const m = manifest.tracks[id];
      expect(m.kind).toBe('music');
      expect(m.files).toEqual({ ogg: `${track.path}.ogg`, m4a: `${track.path}.m4a` });
      expect(onDisk(m.files.ogg) && onDisk(m.files.m4a)).toBe(true);
      expect(track.duration).toBeCloseTo(m.duration, 1);
      expect(track.key).toBe(m.key);
      expect(track.gainDb).toBe(m.gainDb);
    }
    // Синтезированных пьес в игре больше нет — только петли радио и заставки.
    expect(Object.values(manifest.tracks).filter((t) => t.kind === 'music').length).toBe(Object.keys(TRACKS).length);
    for (const old of ['morning', 'day', 'evening', 'night', 'winter']) expect(onDisk(`audio/music/${old}.ogg`)).toBe(false);
  });

  it('петли радио: точки петли, тональность и смены тональности марша', () => {
    for (const [id, loop] of Object.entries(LOOPS)) {
      const m = manifest.tracks[`radio_${id}`];
      expect(m.kind).toBe('loop');
      expect(m.files.ogg).toBe(`${loop.path}.ogg`);
      expect(onDisk(m.files.ogg) && onDisk(m.files.m4a)).toBe(true);
      expect([loop.loopStart, loop.loopEnd]).toEqual([m.loopStart, m.loopEnd]);
      expect(loop.key).toBe(m.key);
      expect(loop.keySections ?? null).toEqual(m.keySections ?? null);
    }
  });

  it('заставки: длительность, приглушение музыки и все варианты по тональностям', () => {
    for (const [id, sting] of Object.entries(STINGS)) {
      const m = manifest.tracks[`sting_${id}`];
      expect(m.files.ogg).toBe(`${sting.path}.ogg`);
      expect(sting.duration).toBeCloseTo(m.duration, 2);
      expect(sting.duckDb).toBe(m.duckDb);
      const keyed = manifest.stingerKeys[`sting_${id}`];
      expect(Boolean(sting.keyed)).toBe(Boolean(keyed));
      for (const key of STING_KEYS) {
        const path = stingPath(id as keyof typeof STINGS, key);
        if (keyed) expect(path).toBe(`audio/music/${keyed[key]}`);
        expect(onDisk(`${path}.ogg`) && onDisk(`${path}.m4a`)).toBe(true);
      }
    }
  });
});

describe('заставки в тональности музыки', () => {
  it('есть вариант — он; нет — соседний по квинтовому кругу; без музыки и у заставок «в до» — до мажор', () => {
    expect(nearestStingKey('D')).toBe('D');
    expect(nearestStingKey('E')).toBe('A');
    expect(nearestStingKey('Ab')).toBe('Eb');
    expect(stingPath('coin', 'D')).toBe('audio/music/sting_coin_D');
    expect(stingPath('coin', 'C')).toBe('audio/music/sting_coin');
    expect(stingPath('coin', null)).toBe('audio/music/sting_coin');
    expect(stingPath('day_close', 'D')).toBe('audio/music/sting_day_close');
  });

  it('марш уходит в трио ми-бемоль мажора и возвращается — и по кругу', () => {
    const march = LOOPS.march;
    expect(loopKeyAt(march, 5)).toBe('Bb');
    expect(loopKeyAt(march, 30)).toBe('Eb');
    expect(loopKeyAt(march, 60)).toBe('Bb');
    expect(loopKeyAt(march, 64 + 30)).toBe('Eb');
    expect(loopKeyAt(LOOPS.hits, 30)).toBe('A');
  });

  it('позывные радио — мотив игры в тональности волны, не дальше −5…+6 полутонов', () => {
    const c = jingleNotes('C').map((n) => n.midi);
    expect(c).toEqual([72, 74, 81, 79, 76]);
    expect(jingleNotes('A').map((n) => n.midi)).toEqual(c.map((m) => m - 3));
    expect(jingleNotes('F').map((n) => n.midi)).toEqual(c.map((m) => m + 5));
    expect(jingleNotes('Gb').map((n) => n.midi)).toEqual(c.map((m) => m + 6));
  });
});

describe('формат файла', () => {
  const ANDROID = 'Mozilla/5.0 (Linux; Android 12; SM-A125F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 Telegram-Android/11.2.3';
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
  const MAC_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
  const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0';

  it('Android и ПК — Opus; iPhone, Mac и всё на движке Safari — AAC, даже если обещают Ogg', () => {
    expect(musicFormat(ANDROID, 'probably')).toBe('ogg');
    expect(musicFormat(FIREFOX, 'maybe')).toBe('ogg');
    expect(musicFormat(IPHONE, 'maybe')).toBe('m4a');
    expect(musicFormat(MAC_SAFARI, 'probably')).toBe('m4a');
    expect(musicFormat(ANDROID, '')).toBe('m4a');
  });
});

describe('что играть', () => {
  it('настроение выбирает свой трек; один и тот же дважды подряд не звучит', () => {
    const r = seeded(1);
    expect(pickTrack('morning', false, null, r)).toBe('morning');
    expect(pickTrack('morning', false, 'morning', r)).toBe('day');
    expect(pickTrack('evening', false, 'day', r)).toBe('evening');
    // Ночью замены нет: другой трек тут же сменился бы обратно на ночной.
    expect(pickTrack('night', false, 'night', r)).toBe('night');
    expect(pickTrack('night', true, 'night', r)).toBe('night');
    expect(pickTrack('title', false, 'theme', r)).toBe('theme');
    for (const mood of Object.keys(POOLS) as MusicMood[]) expect(POOLS[mood].every((id) => id in TRACKS)).toBe(true);
    // Ни одна замена не «не к месту» своему настроению.
    for (const mood of Object.keys(POOLS) as MusicMood[]) expect(POOLS[mood].some((id) => clashes(id, mood))).toBe(false);
  });

  it('зимой вальс звучит вместо дня или вечера примерно через раз, утром и ночью — нет', () => {
    const r = seeded(7);
    let winter = 0;
    for (let i = 0; i < 400; i++) if (pickTrack(i % 2 ? 'day' : 'evening', true, null, r) === 'winter') winter++;
    expect(winter / 400).toBeGreaterThan(0.4);
    expect(winter / 400).toBeLessThan(0.6);
    for (let i = 0; i < 50; i++) {
      expect(pickTrack('morning', true, null, r)).not.toBe('winter');
      expect(pickTrack('night', true, null, r)).not.toBe('winter');
    }
    // Только что играл вальс — следующий не он.
    for (let i = 0; i < 50; i++) expect(pickTrack('day', true, 'winter', r)).not.toBe('winter');
  });

  it('зимняя музыка: зимний месяц игры, новогодняя неделя или настоящие 20 декабря — 10 января', () => {
    const october = new Date(2026, 9, 23);
    expect(winterMusic('winter', 'newyear', october)).toBe(true);
    expect(winterMusic('summer', null, october)).toBe(false);
    expect(winterMusic('summer', null, new Date(2026, 11, 31))).toBe(true);
    expect(winterMusic('autumn', null, new Date(2027, 0, 8))).toBe(true);
    expect(winterMusic('autumn', null, new Date(2026, 11, 10))).toBe(false);
  });

  it('не к месту: в ночную смену — всё, кроме ночного; ночной — утром и днём (вечером ещё можно)', () => {
    expect(clashes('day', 'night')).toBe(true);
    expect(clashes('night', 'night')).toBe(false);
    expect(clashes('night', 'morning')).toBe(true);
    expect(clashes('night', 'evening')).toBe(false);
    // Утро, день и вечер друг другу не мешают: день короче трека, трек доигрывает до конца.
    for (const track of ['morning', 'day', 'evening', 'theme', 'winter'] as TrackId[])
      for (const mood of ['morning', 'day', 'evening'] as MusicMood[]) expect(clashes(track, mood)).toBe(false);
  });
});

describe('расписание: трек — тишина — трек', () => {
  it('первым — тема «Магазинчика»; трек целиком, потом 30–90 с тишины, потом следующий по настроению', () => {
    const p = new Playlist(seeded(3));
    expect(p.next(0, 'title', false)).toEqual({ track: 'theme', fade: false });
    p.started('theme', 0.5, TRACKS.theme.duration);
    // Утро и день сменились — тема доигрывает.
    for (let t = 1; t < 112; t += 5) expect(p.next(t, t < 40 ? 'morning' : 'day', false)).toBeNull();
    // Конец темы — тишина.
    expect(p.next(113, 'day', false)).toBeNull();
    expect(p.playing).toBeNull();
    const quiet = p.quietUntil - 112.5;
    expect(quiet).toBeGreaterThanOrEqual(SILENCE.min);
    expect(quiet).toBeLessThanOrEqual(SILENCE.max);
    expect(p.next(p.quietUntil - 0.1, 'day', false)).toBeNull();
    expect(p.next(p.quietUntil, 'evening', false)).toEqual({ track: 'evening', fade: false });
  });

  it('началась ночная смена — плавная смена на ночной; утром ночной уступает утреннему', () => {
    const p = new Playlist(seeded(4));
    p.started('day', 0, TRACKS.day.duration);
    expect(p.next(10, 'evening', false)).toBeNull();
    expect(p.next(20, 'night', false)).toEqual({ track: 'night', fade: true });
    p.started('night', 20, TRACKS.night.duration);
    // Итоги после ночной смены — ещё ночь; утро — смена.
    expect(p.next(70, 'night', false)).toBeNull();
    expect(p.next(90, 'morning', false)).toEqual({ track: 'morning', fade: true });
  });

  it('итоги ночи затянулись дольше трека и тишины — снова ночной, без вечернего и смены туда-обратно', () => {
    const p = new Playlist(seeded(9));
    p.started('night', 0, TRACKS.night.duration);
    const cues: { at: number; cue: Cue }[] = [];
    for (let t = 0; t < 1200; t += 0.25) {
      const cue = p.next(t, 'night', false);
      if (!cue) continue;
      cues.push({ at: t, cue });
      if (cue !== 'stop') p.started(cue.track, t + 1.5, TRACKS[cue.track].duration);
    }
    // За 20 минут ночной звучит ещё несколько раз — каждый после тишины, без плавных смен.
    expect(cues.length).toBeGreaterThanOrEqual(3);
    for (const { cue } of cues) expect(cue).toEqual({ track: 'night', fade: false });
    for (let i = 1; i < cues.length; i++) expect(cues[i].at - cues[i - 1].at).toBeGreaterThan(TRACKS.night.duration + SILENCE.min);
  });

  it('ночь пришла, пока молчали, — тишина короче (пара секунд), а не до минуты', () => {
    const p = new Playlist(seeded(5));
    p.started('day', 0, 100);
    expect(p.next(101, 'evening', false)).toBeNull();
    expect(p.quietUntil).toBeGreaterThan(130);
    expect(p.next(105, 'night', false)).toBeNull();
    expect(p.quietUntil).toBeCloseTo(105 + NIGHT_GAP, 5);
    expect(p.next(105 + NIGHT_GAP, 'night', false)).toEqual({ track: 'night', fade: false });
  });

  it('играет радио — своя музыка уходит и молчит; выключили — возвращается после паузы', () => {
    const p = new Playlist(seeded(6));
    p.started('theme', 0, TRACKS.theme.duration);
    p.next(1, 'morning', false);
    expect(p.next(5, 'morning', false, true)).toBe('stop');
    p.stopped(5, RESUME_GAP);
    // Радио играет пять минут: музыка молчит.
    for (let t = 6; t <= 306; t += 10) expect(p.next(t, 'day', false, true)).toBeNull();
    // Радио выключили на 306-й секунде — музыка через RESUME_GAP.
    expect(p.next(307, 'day', false)).toBeNull();
    expect(p.next(306 + RESUME_GAP, 'day', false)).toEqual({ track: 'day', fade: false });
  });

  it('долгая игра: два трека сразу не звучат, каждый — целиком или до смены «не к месту», тишины 30–90 с', () => {
    // Сутки игры: утро у закупки 30 с, день 90 с, итоги 15 с; каждый третий день — ночная смена 45 с.
    const r = seeded(11);
    const p = new Playlist(r);
    const moodAt = (t: number): MusicMood => {
      const cycle = 30 + 90 + 45 + 15;
      const day = Math.floor(t / cycle);
      const x = t % cycle;
      if (t < 20) return 'title';
      if (x < 30) return 'morning';
      if (x < 120) {
        const k = (x - 30) / 90;
        return k < 0.3 ? 'morning' : k < 0.72 ? 'day' : 'evening';
      }
      return day % 3 === 2 ? 'night' : 'evening';
    };
    const plays: { track: TrackId; from: number; to: number }[] = [];
    let current: { track: TrackId; from: number } | null = null;
    for (let t = 0; t < 4 * 3600; t += 0.25) {
      const cue = p.next(t, moodAt(t), false);
      if (current && !p.playing) {
        plays.push({ ...current, to: Math.min(t, current.from + TRACKS[current.track].duration) });
        current = null;
      }
      if (cue && cue !== 'stop') {
        if (current) plays.push({ ...current, to: t });
        // Загрузка файла — секунда-другая.
        const at = t + 1.5;
        p.started(cue.track, at, TRACKS[cue.track].duration);
        current = { track: cue.track, from: at };
      }
    }
    expect(plays[0].track).toBe('theme');
    const used = new Set(plays.map((x) => x.track));
    for (const id of ['theme', 'morning', 'day', 'evening', 'night'] as TrackId[]) expect(used.has(id)).toBe(true);
    for (let i = 1; i < plays.length; i++) {
      // Следующий не раньше конца предыдущего (смена «не к месту» — встык, плавно).
      expect(plays[i].from).toBeGreaterThanOrEqual(plays[i - 1].to - 0.001);
      const full = plays[i - 1].to - plays[i - 1].from >= TRACKS[plays[i - 1].track].duration - 0.01;
      if (full) expect(plays[i].from - plays[i - 1].to).toBeGreaterThanOrEqual(NIGHT_GAP - 0.01);
      expect(plays[i].track === plays[i - 1].track && full).toBe(false);
    }
    // Трек обрывается (плавно) только на границе ночной смены: она началась или кончилась.
    for (const x of plays) {
      if (x.to - x.from >= TRACKS[x.track].duration - 0.01) continue;
      expect(moodAt(x.to) === 'night' || x.track === 'night').toBe(true);
    }
    // В дни без ночной смены треки доигрывают до конца.
    const complete = plays.filter((x) => x.to - x.from >= TRACKS[x.track].duration - 0.01).length;
    expect(complete / plays.length).toBeGreaterThan(0.4);
  });

  it('«прыжок» во времени для отладки сдвигает и трек, и тишину', () => {
    const p = new Playlist(seeded(8));
    p.started('day', 10, 100);
    p.skip(95);
    expect(p.playing).toMatchObject({ from: -85, until: 15 });
    expect(p.next(16, 'day', false)).toBeNull();
    expect(p.playing).toBeNull();
  });
});

describe('стык петли', () => {
  it('последние 5 мс перед концом петли переходят в то, что лежит перед её началом', () => {
    const rate = 1000;
    const loop = { path: '', key: 'C' as const, loopStart: 0.5, loopEnd: 2 };
    const d = new Float32Array(2500).map((_, i) => (i >= 1990 && i < 2000 ? 1 : 0));
    smoothSeam([d], rate, loop);
    // k = 5 отсчётов: 1995…1999 плавно уходят к значениям 495…499 (нули).
    expect(Array.from(d.slice(1993, 2000))).toEqual([1, 1, 1, 0.8, 0.6, 0.4, 0.2].map((v) => Math.fround(v)));
    expect(manifest.seamCrossfadeSamples / manifest.sampleRate).toBeCloseTo(0.005, 6);
  });
});
