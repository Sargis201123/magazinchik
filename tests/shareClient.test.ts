import { beforeEach, describe, expect, it, vi } from 'vitest';

// Кнопка «Пригласить» в игре (src/platform/social.ts): двойное касание и повтор сразу после
// закрытого окна не открывают вдобавок к карточке старое окно «Поделиться ссылкой».
// Telegram и словарь — понарошку: модуль игры иначе тянет окно браузера.

const tg = vi.hoisted(() => ({
  shareMessage: vi.fn(async (_id: string) => true),
  openTelegramLink: vi.fn((_url: string) => true),
}));
vi.mock('../src/platform/telegram', () => ({
  canShareMessage: () => true,
  openTelegramLink: tg.openTelegramLink,
  requestWriteAccess: () => undefined,
  shareMessage: tg.shareMessage,
  startParam: () => '',
  telegramInitData: () => 'init',
  telegramUserId: () => 1,
}));
vi.mock('../src/i18n', () => ({ getLang: () => 'ru' }));

const { inviteFriends, socialPing } = await import('../src/platform/social');

/** Ответ сервера на /api/share: можно придержать, как медленную сеть на телефоне. */
let shareAnswer: () => Promise<Response>;
let shareCalls = 0;
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(async () => {
  tg.shareMessage.mockClear();
  tg.openTelegramLink.mockClear();
  shareCalls = 0;
  vi.stubGlobal('fetch', async (path: string) => {
    if (path === '/api/social-ping') return reply({ enabled: true, bot: 'magazinchik_bot' });
    shareCalls++;
    return shareAnswer();
  });
  await socialPing('ru');
});

describe('«Пригласить» в игре: одно окно на касание', () => {
  it('второе касание, пока сервер готовит карточку, пропускается', async () => {
    let answer!: (res: Response) => void;
    shareAnswer = () => new Promise((resolve) => (answer = resolve));
    const first = inviteFriends('текст');
    expect(await inviteFriends('текст')).toBe('cancelled');
    answer(reply({ id: 'prep1' }));
    expect(await first).toBe('sent');
    expect(shareCalls).toBe(1);
    expect(tg.shareMessage).toHaveBeenCalledTimes(1);
    expect(tg.openTelegramLink).not.toHaveBeenCalled();
    // Окно закрылось — снова можно.
    shareAnswer = async () => reply({ id: 'prep2' });
    expect(await inviteFriends('текст')).toBe('sent');
  });

  it('делился только что (сервер: too_often) — касание не в счёт, без окна со ссылкой', async () => {
    shareAnswer = async () => reply({ error: 'too_often' });
    expect(await inviteFriends('текст')).toBe('cancelled');
    expect(tg.shareMessage).not.toHaveBeenCalled();
    expect(tg.openTelegramLink).not.toHaveBeenCalled();
  });

  it('сервер не смог подготовить карточку — поделимся по-старому, ссылкой', async () => {
    shareAnswer = async () => reply({ error: 'not_prepared' });
    expect(await inviteFriends('текст')).toBe('link');
    shareAnswer = async () => reply({ error: 'oops' }, 500);
    expect(await inviteFriends('текст')).toBe('link');
    expect(tg.openTelegramLink).toHaveBeenCalledTimes(2);
    expect(String(tg.openTelegramLink.mock.calls[0][0])).toContain('startapp%3Dref_1');
  });
});
