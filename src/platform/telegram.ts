// Тонкая обёртка над Telegram WebApp API. Вне Telegram (обычный браузер)
// все вызовы безопасно ничего не делают — так игру удобно отлаживать на ПК.

type Callback<T> = (error: string | null, result?: T) => void;

/** Облачное хранилище Telegram: у каждого игрока своё, до 1024 ключей по 4096 символов. */
export interface CloudStorage {
  setItem(key: string, value: string, callback?: Callback<boolean>): void;
  getItem(key: string, callback: Callback<string>): void;
  getItems(keys: string[], callback: Callback<Record<string, string>>): void;
  removeItems(keys: string[], callback?: Callback<boolean>): void;
}

interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface TelegramWebApp {
  ready(): void;
  version?: string;
  platform?: string;
  isVersionAtLeast?(version: string): boolean;
  CloudStorage?: CloudStorage;
  isFullscreen?: boolean;
  requestFullscreen?(): void;
  exitFullscreen?(): void;
  safeAreaInset?: Insets;
  contentSafeAreaInset?: Insets;
  addToHomeScreen?(): void;
  checkHomeScreenStatus?(callback: (status: 'unsupported' | 'unknown' | 'added' | 'missed') => void): void;
  onEvent?(event: string, handler: () => void): void;
  expand(): void;
  disableVerticalSwipes?(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  initData: string;
  /** Окно оплаты счёта (Telegram Stars): статус приходит в колбэк. */
  openInvoice?(url: string, callback?: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void): void;
  initDataUnsafe: { user?: { id: number; first_name?: string; language_code?: string } };
  HapticFeedback?: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

const webApp = (): TelegramWebApp | undefined => (typeof window === 'undefined' ? undefined : window.Telegram?.WebApp);

export const isInTelegram = (): boolean => Boolean(webApp()?.initData);

const at = (version: string): boolean => Boolean(webApp()?.isVersionAtLeast?.(version));

/** Подписанные Telegram данные запуска: по ним сервер узнаёт игрока (подделать нельзя). */
export const telegramInitData = (): string => webApp()?.initData ?? '';

export type InvoiceStatus = 'paid' | 'cancelled' | 'failed' | 'pending';

/** Открыть счёт на оплату звёздами; вне Telegram (или в старом клиенте) — null. */
export function openInvoice(url: string): Promise<InvoiceStatus> | null {
  const app = webApp();
  if (!app?.openInvoice || !at('6.1')) return null;
  return new Promise((resolve) => app.openInvoice!(url, (status) => resolve(status)));
}

/** Игрок Telegram (id) — чтобы не подхватить чужое сохранение на общем телефоне. */
export const telegramUserId = (): number | undefined => webApp()?.initDataUnsafe.user?.id;

/** Облако Telegram (Bot API 6.9+), вне Telegram — нет. */
export const cloudStorage = (): CloudStorage | undefined => (isInTelegram() && at('6.9') ? webApp()?.CloudStorage : undefined);

// ---------- Полный экран ----------

const FULLSCREEN_KEY = 'magazinchik.fullscreen';
const mobile = (): boolean => ['ios', 'android', 'android_x'].includes(webApp()?.platform ?? '');

/** Полный экран доступен: Telegram 8.0+ на телефоне. */
export const canFullscreen = (): boolean => isInTelegram() && at('8.0') && mobile() && Boolean(webApp()?.requestFullscreen);
export const isFullscreen = (): boolean => Boolean(webApp()?.isFullscreen);

/** Игрок хочет полный экран (по умолчанию — да). */
function wantsFullscreen(): boolean {
  try {
    return localStorage.getItem(FULLSCREEN_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setFullscreen(on: boolean): void {
  try {
    localStorage.setItem(FULLSCREEN_KEY, on ? '1' : '0');
  } catch {
    // Без хранилища настройка живёт до перезапуска.
  }
  const tg = webApp();
  if (!canFullscreen() || !tg) return;
  if (on && !tg.isFullscreen) tg.requestFullscreen?.();
  if (!on && tg.isFullscreen) tg.exitFullscreen?.();
}

/**
 * Отступы сверху и снизу: в полном экране поверх игры — кнопки Telegram и вырез экрана.
 * Пишем их в CSS-переменные --safe-top и --safe-bottom (их используют панели интерфейса).
 */
function applyInsets(): void {
  const tg = webApp();
  const root = document.documentElement.style;
  // Не в полном экране игра и так ниже шапки Telegram — хватает системного отступа.
  if (!tg?.isFullscreen) {
    root.setProperty('--safe-top', 'env(safe-area-inset-top)');
    root.setProperty('--safe-bottom', 'env(safe-area-inset-bottom)');
    return;
  }
  const top = (tg?.safeAreaInset?.top ?? 0) + (tg?.contentSafeAreaInset?.top ?? 0);
  const bottom = (tg?.safeAreaInset?.bottom ?? 0) + (tg?.contentSafeAreaInset?.bottom ?? 0);
  root.setProperty('--safe-top', top ? `${top}px` : 'env(safe-area-inset-top)');
  root.setProperty('--safe-bottom', bottom ? `${bottom}px` : 'env(safe-area-inset-bottom)');
}

// ---------- Ярлык на главном экране ----------

/** Можно предложить ярлык на главный экран: поддерживается и ещё не добавлен. */
export function homeScreenStatus(): Promise<boolean> {
  const tg = webApp();
  if (!isInTelegram() || !at('8.0') || !tg?.checkHomeScreenStatus || !tg.addToHomeScreen) return Promise.resolve(false);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), 1500);
    tg.checkHomeScreenStatus!((status) => {
      clearTimeout(timer);
      resolve(status === 'missed' || status === 'unknown');
    });
  });
}

export const addToHomeScreen = (): void => webApp()?.addToHomeScreen?.();

export function initTelegram(bgColor: string): void {
  const tg = webApp();
  applyInsets();
  if (!tg) return;
  tg.ready();
  tg.expand();
  tg.disableVerticalSwipes?.();
  tg.setHeaderColor?.(bgColor);
  tg.setBackgroundColor?.(bgColor);
  tg.onEvent?.('safeAreaChanged', applyInsets);
  tg.onEvent?.('contentSafeAreaChanged', applyInsets);
  tg.onEvent?.('fullscreenChanged', applyInsets);
  if (canFullscreen() && wantsFullscreen()) tg.requestFullscreen?.();
}

export const telegramLanguage = (): string | undefined =>
  webApp()?.initDataUnsafe.user?.language_code;

export const haptic = {
  tap: () => webApp()?.HapticFeedback?.impactOccurred('light'),
  success: () => webApp()?.HapticFeedback?.notificationOccurred('success'),
  error: () => webApp()?.HapticFeedback?.notificationOccurred('error'),
};
