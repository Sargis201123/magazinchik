// Звуковой «пульт»: один аудиоконтекст на всю игру и каналы — музыка, улица, зал, звуки мира,
// кнопки и голоса. Всё сходится в общую громкость → мягкий компрессор → ограничитель: вместе
// звуки не «хрипят», а тихие (касса, монетки) не тонут. Зал и звуки мира звучат с лёгким отзвуком
// комнаты; музыка притихает под диалогами; пока открыто меню, мир слышен глухо, «как из-за двери».
// Когда игра свёрнута (вкладка скрыта, Telegram свернули) или звук выключен — контекст спит.

import { roomImpulse, seeded } from './ambienceSynth';
import { parseVolumes, silenceMask, sliderGain, VoiceLimiter, worldPan, type VolumeKey, type Volumes, type VoiceRule } from './mix';
import { liteMode } from './quality';

/**
 * Каналы. Улица — дождь, ветер, птицы, гром (без отзвука зала); зал — гул, шаги, колокольчик;
 * мир — звуки предметов в магазине (касса, полка, кот); кнопки — отклик интерфейса; голоса — диалоги.
 */
export type Bus = 'music' | 'street' | 'hall' | 'world' | 'ui' | 'voice';

/** Какой ползунок управляет каналом. */
const CHANNEL: Record<Bus, Exclude<VolumeKey, 'master'>> = {
  music: 'music',
  street: 'ambience',
  hall: 'ambience',
  world: 'effects',
  ui: 'effects',
  voice: 'voices',
};

/**
 * Уровни каналов (ползунок на максимуме). Подобраны замером в OfflineAudioContext при ползунках
 * по умолчанию (80%): музыка — около −24 дБ RMS (было −39), дождь на ~9 дБ тише музыки, ливень
 * с ветром — на ~6 (был громче музыки), касса и монетки — пик около −11…−16 дБ (было −44…−54).
 * Компрессор WebAudio сам подтягивает тихое (~+7 дБ), поэтому числа — из замера, а не из арифметики.
 */
const LEVEL: Record<Bus, number> = {
  music: 10,
  street: 2.6,
  hall: 5.2,
  world: 6,
  ui: 5.2,
  voice: 4.9,
};

/** Сколько каждого канала уходит в отзвук комнаты: улица — нисколько (она за стеклом). */
const SEND = { indoor: 0.22, ui: 0.1, voice: 0.12, music: 0.08 };

/** Меню открыто: мир — глухо и тише, музыка — чуть мягче. */
const MENU = { muffle: 750, dip: 0.55, music: 3200 };
const OPEN_AIR = 18000;
const MUSIC_TONE = 7000;
/** Под диалогом музыка тише на ~7 дБ, под фанфарами и новостями — на ~6. */
const DIALOG_DUCK = 0.45;
const STINGER_DUCK = 0.5;

const VOLUMES_KEY = 'magazinchik.volumes';
const MUTE_KEY = 'magazinchik.mute';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Без хранилища настройка живёт до перезапуска.
  }
}

// Старые выключатели (до пульта) — только чтобы перенести выбор игрока.
let volumes: Volumes = parseVolumes(read(VOLUMES_KEY), read('magazinchik.muted'), read('magazinchik.music'));
let muted = read(MUTE_KEY) === '1';

interface Graph {
  input: Record<Bus, GainNode>;
  master: GainNode;
  musicDuck: GainNode;
  musicTone: BiquadFilterNode;
  muffle: BiquadFilterNode;
  dip: GainNode;
  indoorSend: GainNode;
}

let ctx: AudioContext | null = null;
let graph: Graph | null = null;
const limiter = new VoiceLimiter(liteMode() ? 6 : 12);

/** Плавно к значению: без щелчков, прежние планы параметра отменяются. */
function glide(param: AudioParam, value: number, at: number, tau: number): void {
  param.cancelScheduledValues(at);
  param.setTargetAtTime(value, at, tau);
}

function build(ac: AudioContext): Graph {
  const gain = (value = 1): GainNode => {
    const g = ac.createGain();
    g.gain.value = value;
    return g;
  };
  const filter = (type: BiquadFilterType, freq: number, q = 0.707): BiquadFilterNode => {
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  };
  // Общая громкость → срез «подвала» (динамик телефона его не играет, а запас громкости он съедает) →
  // мягкий компрессор, склеивающий микс → ограничитель на самом верху.
  const master = gain(0);
  const lowCut = filter('highpass', 70);
  const glue = ac.createDynamicsCompressor();
  glue.threshold.value = -20;
  glue.knee.value = 10;
  glue.ratio.value = 2.5;
  glue.attack.value = 0.01;
  glue.release.value = 0.25;
  const limit = ac.createDynamicsCompressor();
  limit.threshold.value = -3;
  limit.knee.value = 0;
  limit.ratio.value = 20;
  limit.attack.value = 0.002;
  limit.release.value = 0.12;
  master.connect(lowCut).connect(glue).connect(limit).connect(ac.destination);

  // Отзвук комнаты: короткий хвост без гула внизу и без звона вверху.
  const reverb = ac.createConvolver();
  reverb.normalize = false;
  const ir = roomImpulse(ac.sampleRate, liteMode() ? 0.45 : 0.9, seeded(77));
  const irBuffer = ac.createBuffer(2, ir.left.length, ac.sampleRate);
  irBuffer.copyToChannel(ir.left as Float32Array<ArrayBuffer>, 0);
  irBuffer.copyToChannel(ir.right as Float32Array<ArrayBuffer>, 1);
  reverb.buffer = irBuffer;
  reverb.connect(filter('highpass', 220)).connect(filter('lowpass', 5000)).connect(master);

  const input = {} as Record<Bus, GainNode>;
  for (const bus of Object.keys(CHANNEL) as Bus[]) input[bus] = gain(0);

  // Мир: улица и зал (с отзвуком) → «дверь» (глушится, пока открыто меню) → общая громкость.
  const muffle = filter('lowpass', OPEN_AIR);
  const dip = gain(1);
  muffle.connect(dip).connect(master);
  input.street.connect(muffle);
  const indoor = gain(1);
  input.hall.connect(indoor);
  input.world.connect(indoor);
  indoor.connect(muffle);
  const indoorSend = gain(SEND.indoor);
  indoor.connect(indoorSend).connect(reverb);

  // Кнопки и голоса — мимо «двери»: меню и диалоги звучат ясно.
  input.ui.connect(master);
  input.ui.connect(gain(SEND.ui)).connect(reverb);
  input.voice.connect(master);
  input.voice.connect(gain(SEND.voice)).connect(reverb);

  // Музыка: притихает под диалогами, мягчеет под меню.
  const musicDuck = gain(1);
  const musicTone = filter('lowpass', MUSIC_TONE, 0.5);
  input.music.connect(musicDuck).connect(musicTone).connect(master);
  musicTone.connect(gain(SEND.music)).connect(reverb);

  return { input, master, musicDuck, musicTone, muffle, dip, indoorSend };
}

/** Громкости с ползунков — в усилители каналов. */
function applyVolumes(): void {
  if (!ctx || !graph) return;
  const now = ctx.currentTime;
  glide(graph.master.gain, muted ? 0 : sliderGain(volumes.master), now, 0.05);
  for (const bus of Object.keys(CHANNEL) as Bus[]) glide(graph.input[bus].gain, LEVEL[bus] * sliderGain(volumes[CHANNEL[bus]]), now, 0.05);
}

// ---------- Меню, диалоги, фанфары ----------

let menuOpen = false;
/** До этого момента (performance.now) меню не глушит мир: двигают ползунок громкости. */
let clearUntil = 0;
let dialogOpen = false;
let stingerUntil = 0;

function applyDuck(fast: boolean): void {
  if (!ctx || !graph) return;
  const now = ctx.currentTime;
  const p = graph.musicDuck.gain;
  const base = dialogOpen ? DIALOG_DUCK : 1;
  p.cancelScheduledValues(now);
  if (stingerUntil > now) {
    p.setTargetAtTime(Math.min(base, STINGER_DUCK), now, 0.03);
    p.setTargetAtTime(base, stingerUntil, 0.35);
  } else p.setTargetAtTime(base, now, fast ? 0.08 : 0.35);
}

function applyMenu(): void {
  if (!ctx || !graph) return;
  const now = ctx.currentTime;
  glide(graph.muffle.frequency, menuOpen ? MENU.muffle : OPEN_AIR, now, menuOpen ? 0.08 : 0.25);
  glide(graph.dip.gain, menuOpen ? MENU.dip : 1, now, 0.15);
  glide(graph.indoorSend.gain, menuOpen ? SEND.indoor * 0.15 : SEND.indoor, now, 0.15);
  glide(graph.musicTone.frequency, menuOpen ? MENU.music : MUSIC_TONE, now, 0.25);
}

/**
 * Что сейчас на экране: окно (утро, итоги, магазин друга…) и диалог с портретом. Опрашиваем DOM
 * четыре раза в секунду, а не ловим каждое открытие: окна закрываются разными путями.
 */
function watchScreen(): void {
  const menu = performance.now() >= clearUntil && document.querySelector('.ui-modal:not(.closing)') !== null;
  const dialog = document.querySelector('.ui-dialog') !== null;
  if (menu !== menuOpen) {
    menuOpen = menu;
    applyMenu();
  }
  if (dialog !== dialogOpen) {
    dialogOpen = dialog;
    applyDuck(dialog);
  }
}

// ---------- Сон и пробуждение ----------

let pageHidden = typeof document !== 'undefined' && document.hidden;
let appHidden = false;

/** Звук должен идти: игра на экране, не выключена, общая громкость не на нуле и слышен хоть один канал. */
const wanted = (): boolean =>
  !pageHidden && !appHidden && !muted && volumes.master > 0 && (volumes.music > 0 || volumes.ambience > 0 || volumes.effects > 0 || volumes.voices > 0);

let napTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Игра скрыта или звук выключен — контекст засыпает (не тратит батарею), иначе — просыпается.
 * Свернули — спит сразу; выключили кнопкой — сначала звук плавно гаснет, потом сон (без щелчка).
 */
function sync(): void {
  if (!ctx || ctx.state === 'closed') return;
  clearTimeout(napTimer);
  if (wanted()) {
    if (ctx.state !== 'running') void ctx.resume().catch(() => {});
    return;
  }
  const ac = ctx;
  const nap = () => {
    if (!wanted() && ac.state === 'running') void ac.suspend().catch(() => {});
  };
  if (pageHidden || appHidden) nap();
  else napTimer = setTimeout(nap, 300);
}

/** Общий аудиоконтекст (создаётся по первому касанию). null — звук выключен или его нет. */
export function audioContext(): AudioContext | null {
  if (!wanted()) return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    graph = build(ctx);
    applyVolumes();
    setInterval(watchScreen, 250);
  }
  if (ctx.state !== 'running' && ctx.state !== 'closed') void ctx.resume().catch(() => {});
  return ctx;
}

/** Контекст, если он уже создан касанием и играет; сам не создаёт (для фоновых звуков в каждом кадре). */
export function existingAudioContext(): AudioContext | null {
  return ctx && ctx.state === 'running' ? ctx : null;
}

/**
 * Браузер включает звук только внутри касания. В Telegram (особенно на iPhone) не каждое событие
 * считается касанием, а после сворачивания или звонка звук снова засыпает, — поэтому будим его
 * на любом касании, пока не заиграет.
 */
function unlock(): void {
  if (!wanted() || ctx?.state === 'running') return;
  const ac = audioContext();
  if (!ac) return;
  // iOS: беззвучный отсчёт, сыгранный прямо в касании, окончательно открывает звук.
  try {
    const src = ac.createBufferSource();
    src.buffer = ac.createBuffer(1, 1, 22050);
    src.connect(ac.destination);
    src.start(0);
  } catch {
    // не страшно — попробуем на следующем касании
  }
}

if (typeof window !== 'undefined') {
  for (const type of ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'click', 'keydown'])
    window.addEventListener(type, unlock, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    pageHidden = document.hidden;
    sync();
  });
  // Telegram 8.0+: мини-приложение свернули в шапку или развернули обратно (страница при этом «видна»).
  const tg = window.Telegram?.WebApp;
  tg?.onEvent?.('deactivated', () => {
    appHidden = true;
    sync();
  });
  tg?.onEvent?.('activated', () => {
    appHidden = false;
    sync();
  });
}

// ---------- Куда звучит звук ----------

/** Видимая часть мира (камера сцены): по ней звук мира уходит влево или вправо. */
let view: (() => { left: number; width: number }) | null = null;
export function setListener(next: (() => { left: number; width: number }) | null): void {
  view = next;
}

/** Сторона и громкость звука из точки мира x (без x — посередине). */
export function placeAt(x?: number): { pan: number; gain: number; onScreen: boolean } {
  if (x === undefined || !view) return { pan: 0, gain: 1, onScreen: true };
  const v = view();
  return worldPan(x, v.left, v.width);
}

/** Вход канала; со стороной — через панораму. Куда подключать голос звука. */
export function busInput(ac: AudioContext, bus: Bus, pan = 0, gain = 1): AudioNode {
  if (!graph || graph.input[bus].context !== ac) return ac.destination;
  let out: AudioNode = graph.input[bus];
  if (gain !== 1) {
    const g = ac.createGain();
    g.gain.value = gain;
    g.connect(out);
    out = g;
  }
  if (pan !== 0) {
    const p = ac.createStereoPanner();
    p.pan.value = pan;
    p.connect(out);
    out = p;
  }
  return out;
}

/** Не «пулемёт»: сыграть ли частый звук сейчас (правило — в mix.ts). */
export const allowVoice = (key: string, rule: VoiceRule, dur: number): boolean => limiter.allow(key, rule, performance.now() / 1000, dur);

/** Фанфары и новости: музыка на время притихает. */
export function duckMusic(seconds: number): void {
  if (!ctx) return;
  stingerUntil = Math.max(stingerUntil, ctx.currentTime + seconds);
  applyDuck(true);
}

// ---------- Настройки ----------

export const mixer = {
  volumes: (): Volumes => ({ ...volumes }),
  /** Ползунок сдвинули: сразу слышно и запоминается. */
  setVolume(key: VolumeKey, value: number): void {
    volumes = { ...volumes, [key]: Math.min(1, Math.max(0, value)) };
    write(VOLUMES_KEY, JSON.stringify(volumes));
    applyVolumes();
    sync();
  },
  /**
   * Подбирают громкость (ползунки живут в профиле, а он — окно): пару секунд мир звучит без «двери»
   * меню, иначе пример колокольчика и дождь за окном были бы почти не слышны.
   */
  listen(): void {
    clearUntil = performance.now() + 2000;
    if (graph) watchScreen();
  },
  /** Быстрое «без звука» — одной кнопкой, ползунки остаются как были. */
  isMuted: (): boolean => muted,
  setMuted(next: boolean): void {
    muted = next;
    write(MUTE_KEY, next ? '1' : '0');
    applyVolumes();
    sync();
    // Включили касанием — тут же будим звук (iOS разрешает это только внутри касания).
    if (!next) unlock();
  },
  /** Слышен ли канал: без звука или ползунок на нуле — звуки для него можно не собирать. */
  audible: (bus: Bus): boolean => !muted && volumes.master > 0 && volumes[CHANNEL[bus]] > 0,
  /** Что выключено — для аналитики (mix.ts, silenceMask). */
  silenceMask: (): number => silenceMask(volumes, muted),
};

// Отладка: ?debug открывает пульт из консоли браузера (контекст, каналы, меню и диалог).
if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug'))
  Object.assign(window, { mixerDebug: () => ({ ctx, graph, volumes, muted, menuOpen, dialogOpen, level: LEVEL }) });
