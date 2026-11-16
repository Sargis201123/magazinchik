// Режим тестировщика (api/_lib/tester.ts): при запуске один раз спросить сервер, «свой» ли игрок.
// Ответ держим в памяти — раздел «🧪 Тестер» в «Развитии» смотрит сюда (ui/tester.ts).

import { telegramInitData } from './telegram';
import { post } from './social';

let verified = false;

/** Без Telegram: при разработке (npm run dev) и на localhost с ?debug раздел виден всегда — проверять кнопки. */
const devTester = (): boolean =>
  import.meta.env.DEV || (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has('debug'));

/** Показывать ли раздел тестировщика. */
export const testerMode = (): boolean => verified || devTester();

/** Спросить сервер (номер в TESTER_IDS и подпись Telegram настоящая). Нет Telegram или сети — false. */
export async function fetchTester(): Promise<boolean> {
  const initData = telegramInitData();
  if (!initData) return false;
  const res = await post<{ tester?: boolean }>('/api/tester', { initData });
  verified = res?.tester === true;
  return verified;
}
