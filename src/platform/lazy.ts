// Части игры, которые нужны не сразу (утреннее меню — у новичка его в первый день нет вовсе), лежат
// в сборке отдельными файлами (import()) — первый файл игры меньше, титул на медленной связи раньше.
// Подкачиваются заранее, пока игрок смотрит на титул (prefetch), так что к нажатию обычно уже готовы.
// Связь оборвалась — пробуем ещё несколько раз; совсем никак — перезапускаем игру (сохранение на месте).

import { t } from '../i18n';
import { toast } from '../ui/dom';
import { reportError } from './errors';

/** Паузы между повторами, мс: файл не дошёл — ждём и просим снова. */
const RETRY_MS = [1000, 2000, 4000, 8000];

/** Загрузки в пути — проверке (scripts/e2e.ts) нужно дождаться их, не двигая часы игры. */
const pending = new Set<Promise<unknown>>();

export interface Lazy<T> {
  /** Уже загружено — сразу модуль, нет — null. */
  get(): T | null;
  /** Загрузить (один раз; повторный вызов ждёт ту же загрузку). */
  load(): Promise<T>;
}

export function lazy<T>(name: string, importer: () => Promise<T>): Lazy<T> {
  let mod: T | null = null;
  let loading: Promise<T> | null = null;
  const attempt = async (): Promise<T> => {
    for (let i = 0; ; i++) {
      try {
        return await importer();
      } catch (error) {
        if (i >= RETRY_MS.length) throw error;
        await new Promise((done) => setTimeout(done, RETRY_MS[i]));
      }
    }
  };
  return {
    get: () => mod,
    load: () => {
      if (loading) return loading;
      const job = attempt().then(
        (m) => (mod = m),
        (error: unknown) => {
          // Следующий load() попробует заново.
          loading = null;
          reportError(error, `lazy:${name}`);
          throw error;
        },
      );
      loading = job;
      pending.add(job);
      void job.catch(() => undefined).finally(() => pending.delete(job));
      return job;
    },
  };
}

/** Позвать сразу, если модуль уже здесь (поведение как без разбивки), иначе — как только придёт. */
export function withLazy<T>(part: Lazy<T>, use: (mod: T) => void): void {
  const ready = part.get();
  if (ready) use(ready);
  else
    void part.load().then(use, () => {
      // Файл игры так и не пришёл: без него дальше не пройти — перезапуск с титула (Chromium помнит
      // неудачный import() до перезагрузки страницы, повторять его бесполезно). Не чаще раза в минуту:
      // без связи страница не должна перезапускаться по кругу.
      toast('assets/ico_phone.png', t('lazy.offTitle'), t('lazy.offText'));
      if (Date.now() - lastReload() < RELOAD_GAP_MS) return;
      try {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      } catch {
        // Хранилище недоступно — перезапуск всё равно нужен.
      }
      // Надпись встаёт в очередь за другими (достижения) — даём ей показаться.
      setTimeout(() => location.reload(), 5000);
    });
}

const RELOAD_KEY = 'magazinchik.lazyReload';
const RELOAD_GAP_MS = 60_000;
const lastReload = (): number => {
  try {
    return Number(sessionStorage.getItem(RELOAD_KEY)) || 0;
  } catch {
    return 0;
  }
};

/** Подкачать заранее, без ожидания и без шума об ошибке (при настоящей надобности load() повторит). */
export function prefetch(part: Lazy<unknown>): void {
  void part.load().catch(() => undefined);
}

/** Все начатые подгрузки закончились (для проверки, ?debug). */
export const lazyIdle = (): Promise<void> => Promise.all([...pending].map((p) => p.catch(() => undefined))).then(() => undefined);
