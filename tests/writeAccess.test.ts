import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Разрешение боту писать (src/platform/social.ts askWriteAccessOnce): спрашиваем один раз за всю игру, ответ
// игрока отдаём тому, кто спрашивал (событие write_access). Новичка — уже в итогах первого дня (nightShift.ts).
// Telegram и словарь — понарошку: модуль игры иначе тянет окно браузера.

const tg = vi.hoisted(() => ({ requestWriteAccess: vi.fn((answer?: (granted: boolean) => void) => answer?.(true)) }));
vi.mock('../src/platform/telegram', () => ({
  canShareMessage: () => false,
  openTelegramLink: () => false,
  requestWriteAccess: tg.requestWriteAccess,
  shareMessage: async () => false,
  startParam: () => '',
  telegramInitData: () => '',
  telegramUserId: () => undefined,
}));
vi.mock('../src/i18n', () => ({ getLang: () => 'ru' }));

const { askWriteAccessOnce } = await import('../src/platform/social');

let local: Record<string, string>;
beforeEach(() => {
  local = {};
  tg.requestWriteAccess.mockClear();
  Object.assign(globalThis, { localStorage: { getItem: (k: string) => local[k] ?? null, setItem: (k: string, v: string) => (local[k] = v), removeItem: (k: string) => delete local[k] } });
});
afterEach(() => delete (globalThis as Record<string, unknown>).localStorage);

describe('разрешение боту писать', () => {
  it('спрашивает один раз и отдаёт ответ игрока', () => {
    const answers: boolean[] = [];
    askWriteAccessOnce((granted) => answers.push(granted));
    askWriteAccessOnce((granted) => answers.push(granted));
    expect(tg.requestWriteAccess).toHaveBeenCalledTimes(1);
    expect(answers).toEqual([true]);
  });

  it('уже спрашивали (утром прежней версии игры) — второй раз не спрашивает', () => {
    local['magazinchik.writeAccess'] = '1';
    askWriteAccessOnce(() => undefined);
    expect(tg.requestWriteAccess).not.toHaveBeenCalled();
  });

  it('нет хранилища — не спрашивает (иначе спрашивал бы при каждом запуске)', () => {
    Object.assign(globalThis, {
      localStorage: {
        getItem: () => {
          throw new Error('blocked');
        },
      },
    });
    askWriteAccessOnce(() => undefined);
    expect(tg.requestWriteAccess).not.toHaveBeenCalled();
  });
});
