// Тонкая обёртка над Telegram WebApp API. Вне Telegram (обычный браузер)
// все вызовы безопасно ничего не делают — так игру удобно отлаживать на ПК.

interface TelegramWebApp {
  ready(): void;
  expand(): void;
  disableVerticalSwipes?(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  initData: string;
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

const webApp = (): TelegramWebApp | undefined => window.Telegram?.WebApp;

export const isInTelegram = (): boolean => Boolean(webApp()?.initData);

export function initTelegram(bgColor: string): void {
  const tg = webApp();
  if (!tg) return;
  tg.ready();
  tg.expand();
  tg.disableVerticalSwipes?.();
  tg.setHeaderColor?.(bgColor);
  tg.setBackgroundColor?.(bgColor);
}

export const telegramLanguage = (): string | undefined =>
  webApp()?.initDataUnsafe.user?.language_code;

export const haptic = {
  tap: () => webApp()?.HapticFeedback?.impactOccurred('light'),
  success: () => webApp()?.HapticFeedback?.notificationOccurred('success'),
  error: () => webApp()?.HapticFeedback?.notificationOccurred('error'),
};
