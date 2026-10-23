// Качество графики — три уровня:
// • лёгкий — холст не плотнее 720 точек по ширине (вдвое меньше пикселей на экранах с плотностью 3),
//   без виньетки, тёплого тона, облаков и пылинок: для слабых телефонов;
// • обычный — всё, кроме виньетки: на один проход по всему экрану меньше;
// • высокий — всё.
// Уровень выбирается при запуске по телефону: Telegram на Android сам пишет в user agent его класс
// (LOW / AVERAGE / HIGH), иначе смотрим на память устройства. Игрок может выбрать в профиле
// «Обычную» или «Лёгкую» — тогда так и будет. Если игра заметно тормозит, уровень понижается
// на несколько дней (а не навсегда, как раньше) — потом снова по телефону. Ровные 30 кадров
// (энергосбережение iPhone, экран на 30 Гц) — это потолок системы, а не слабый телефон.
// Холст меняется со следующего запуска.

export type Quality = 'lite' | 'normal' | 'high';
const RANK: Record<Quality, number> = { lite: 0, normal: 1, high: 2 };

/** Выбор игрока в профиле: 'lite' — лёгкая, 'full' — обычная или лучше (нет записи — по телефону). */
const CHOICE_KEY = 'magazinchik.gfx';
/** Временное понижение после тормозов: { tier, until }. */
const AUTO_KEY = 'magazinchik.gfxAuto';
/** Флаг лёгкой графики до уровней: его ставил и игрок, и автоматика (навсегда). */
const LEGACY_KEY = 'magazinchik.lite';

/** На сколько дней понижаем графику, если игра тормозила. */
export const QUALITY_HOLD_DAYS = 3;
/** Ниже скольких кадров в секунду (медиана за полминуты дня) включаем лёгкую графику. */
export const LITE_FPS = 40;
/** Ниже скольких — с высокой на обычную. */
export const NORMAL_FPS = 50;

const DAY_MS = 86_400_000;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Без хранилища выбор действует до перезапуска.
  }
}

/**
 * Класс телефона, который Telegram для Android дописывает в user agent:
 * «Telegram-Android/11.2.3 (Samsung SM-A125F; Android 12; SDK 31; LOW)».
 */
export function telegramClass(ua: string): 'LOW' | 'AVERAGE' | 'HIGH' | null {
  const inside = /Telegram-Android\/[\d.]+\s*\(([^)]*)\)/i.exec(ua)?.[1];
  const last = inside?.split(';').pop()?.trim().toUpperCase();
  return last === 'LOW' || last === 'AVERAGE' || last === 'HIGH' ? last : null;
}

/** Уровень по самому телефону: класс от Telegram, иначе память (navigator.deviceMemory, ГБ). */
export function deviceQuality(ua: string, memoryGb?: number): Quality {
  const cls = telegramClass(ua);
  if (cls) return cls === 'LOW' ? 'lite' : cls === 'AVERAGE' ? 'normal' : 'high';
  // Память браузер округляет вниз до степени двойки: телефон на 3 ГБ скажет «2».
  if (memoryGb !== undefined && memoryGb > 0) return memoryGb <= 2 ? 'lite' : memoryGb <= 4 ? 'normal' : 'high';
  // iPhone и компьютер память не сообщают — им по силам всё.
  return 'high';
}

/**
 * Итоговый уровень: выбор игрока важнее всего, иначе — телефон, но не выше временного понижения.
 * Чистая функция — для проверки; в игре её зовёт quality().
 */
export function resolveQuality(device: Quality, choice: 'lite' | 'full' | null, auto: Quality | null): Quality {
  if (choice === 'lite') return 'lite';
  if (choice === 'full') return device === 'lite' ? 'normal' : device;
  return auto && RANK[auto] < RANK[device] ? auto : device;
}

/** Выбор игрока; старый флаг «лёгкая» превращается во временное понижение (его чаще ставила автоматика). */
function choice(): 'lite' | 'full' | null {
  if (read(LEGACY_KEY) === '1') {
    write(LEGACY_KEY, null);
    if (!read(AUTO_KEY)) lowerQuality('lite');
  }
  const value = read(CHOICE_KEY);
  return value === 'lite' || value === 'full' ? value : null;
}

/** Временное понижение, если ещё не истекло. */
function autoQuality(now: number): Quality | null {
  try {
    const saved = JSON.parse(read(AUTO_KEY) ?? 'null') as { tier?: Quality; until?: number } | null;
    if (!saved?.tier || !(saved.tier in RANK) || !saved.until || saved.until < now) return null;
    return saved.tier;
  } catch {
    return null;
  }
}

let current: Quality | null = null;

/** Уровень графики сейчас (считается раз и пересчитывается после выбора в профиле или понижения). */
export function quality(): Quality {
  if (!current) {
    const nav = typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { deviceMemory?: number });
    current = resolveQuality(deviceQuality(nav?.userAgent ?? '', nav?.deviceMemory), choice(), autoQuality(Date.now()));
  }
  return current;
}

/** Лёгкая графика сейчас (выбрана, по телефону или временно). */
export function liteMode(): boolean {
  return quality() === 'lite';
}

/** Выбор в профиле: «Лёгкая» или «Обычная». Ручной выбор отменяет временное понижение. */
export function setLiteMode(on: boolean): void {
  write(CHOICE_KEY, on ? 'lite' : 'full');
  write(AUTO_KEY, null);
  current = null;
}

/** Игрок сам выбрал графику — автоматика её не трогает. */
export function qualityChosen(): boolean {
  return choice() !== null;
}

/** Игра тормозила: понизить уровень на QUALITY_HOLD_DAYS дней. */
export function lowerQuality(tier: Quality, now = Date.now()): void {
  write(AUTO_KEY, JSON.stringify({ tier, until: now + QUALITY_HOLD_DAYS * DAY_MS }));
  current = null;
}

/** Медиана и «просадка» (10-й процентиль) по посекундным замерам FPS. */
export function fpsSummary(samples: number[]): { median: number; low: number } | null {
  if (samples.length < 10) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  return { median: sorted[Math.floor(sorted.length / 2)], low: sorted[Math.floor(sorted.length * 0.1)] };
}

/**
 * На какой уровень сойти по замерам FPS (null — оставить как есть). Ровные ~30 кадров без провалов —
 * потолок системы (энергосбережение iPhone, экран 30 Гц): картинка от понижения быстрее не станет.
 */
export function fpsVerdict(samples: number[], tier: Quality): Quality | null {
  const summary = fpsSummary(samples);
  if (!summary) return null;
  if (summary.median <= 33 && summary.low >= summary.median - 3) return null;
  if (tier !== 'lite' && summary.median < LITE_FPS) return 'lite';
  if (tier === 'high' && summary.median < NORMAL_FPS) return 'normal';
  return null;
}
