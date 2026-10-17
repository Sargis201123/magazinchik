// Ошибки у игроков: тихо отправляем на сервер (/api/client-error), там они попадают в логи
// Cloudflare (Observability). Так видно, что сломалось у живых людей, а не только у нас.
// Не больше нескольких за запуск и без повторов — чтобы не засыпать логи.

const MAX_REPORTS = 5;
const sent = new Set<string>();
let context: () => Record<string, unknown> = () => ({});

/** Что приложить к отчёту (день, уровень) — задаёт сцена магазина. */
export function setErrorContext(fn: () => Record<string, unknown>): void {
  context = fn;
}

export function reportError(error: unknown, where = 'window'): void {
  const err = error instanceof Error ? error : new Error(String(error));
  const key = `${where}:${err.message}`;
  console.error(where, err);
  if (sent.has(key) || sent.size >= MAX_REPORTS || location.hostname === 'localhost') return;
  sent.add(key);
  let extra: Record<string, unknown> = {};
  try {
    extra = context();
  } catch {
    // контекст — по возможности
  }
  const body = JSON.stringify({ where, message: err.message.slice(0, 300), stack: (err.stack ?? '').slice(0, 1500), ...extra });
  try {
    void fetch('/api/client-error', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch {
    // офлайн — не страшно
  }
}

/** Ловим всё, что не поймано: исключения и отклонённые обещания. */
export function installErrorReporting(): void {
  window.addEventListener('error', (e) => reportError(e.error ?? e.message, 'window'));
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason, 'promise'));
}
