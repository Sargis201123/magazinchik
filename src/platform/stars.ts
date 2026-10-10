// Покупки за Telegram Stars. Счёт выставляет наш сервер (api/stars-invoice), оплату подтверждает
// вебхук бота (api/telegram), а список купленного берётся из платежей бота (api/stars-owned) —
// так покупки возвращаются на любом телефоне и после «Начать заново».

import { openInvoice, telegramInitData } from './telegram';

export type BuyResult = 'paid' | 'cancelled' | 'failed' | 'unavailable';

const TIMEOUT_MS = 10000;

async function post<T>(path: string, body: unknown): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Оплата звёздами доступна: игра открыта в Telegram. */
export const starsAvailable = (): boolean => Boolean(telegramInitData());

/** Купить вещь: счёт → окно оплаты Telegram → результат. */
export async function buyWithStars(item: string): Promise<BuyResult> {
  const initData = telegramInitData();
  if (!initData) return 'unavailable';
  const invoice = await post<{ link?: string }>('/api/stars-invoice', { initData, item });
  if (!invoice?.link) return 'unavailable';
  const status = await openInvoice(invoice.link);
  if (status === null) return 'unavailable';
  return status === 'paid' ? 'paid' : status === 'cancelled' ? 'cancelled' : 'failed';
}

/** Что игрок уже купил (по данным Telegram); null — сервер недоступен или игра не в Telegram. */
export async function restorePurchases(): Promise<string[] | null> {
  const initData = telegramInitData();
  if (!initData) return null;
  const res = await post<{ items?: string[] }>('/api/stars-owned', { initData });
  return res?.items ?? null;
}
