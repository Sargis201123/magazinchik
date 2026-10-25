// «Заглянуть к конкуренту» (game/rival.ts): панель проделок внизу экрана в чужом магазине и утреннее
// окно «к тебе заходили» — ответить визитом или поблагодарить.

import { t } from '../i18n';
import { PRANKS, type PrankKind, type RivalNews } from '../game/rival';
import { button, el, openModal, pixelize } from './dom';

export interface RivalBar {
  /** Сколько проделок осталось (0 — кнопки гаснут). */
  setLeft(n: number): void;
  /** Ждём сервер — кнопки не нажимаются. */
  setBusy(busy: boolean): void;
  remove(): void;
}

/** Панель в чужом магазине: кто хозяин, три проделки, «Домой». */
export function rivalBar(title: string, left: number, onPrank: (kind: PrankKind) => void, onHome: () => void): RivalBar {
  const bar = el('div', 'ui-arrange');
  const count = el('div', 'ui-muted');
  const row = el('div', 'ui-arrange-row');
  const buttons = PRANKS.map((kind) => button(t(`rival.${kind}`), () => onPrank(kind), 'ui-btn'));
  row.append(...buttons);
  let n = left;
  let busy = false;
  const sync = () => {
    count.textContent = n > 0 ? t('rival.left', { n }) : t('rival.err.limit');
    for (const b of buttons) b.disabled = busy || n <= 0;
  };
  bar.append(el('div', 'ui-arrange-hint', title), count, row, button(`🏠 ${t('visitShop.home')}`, onHome, 'ui-btn secondary ui-arrange-queue'));
  sync();
  document.body.append(bar);
  pixelize(bar);
  return {
    setLeft: (next) => {
      n = next;
      sync();
    },
    setBusy: (next) => {
      busy = next;
      sync();
    },
    remove: () => bar.remove(),
  };
}

/**
 * Утром: кто к нам заходил и что натворил, что помогло (охранник, камеры, уборщица), подсказка, если
 * защиты нет. Ответить визитом (только утром; onVisit — null, если магазин уже открыт) или
 * поблагодарить — тому, кто заходил первым.
 */
export function showRivalNews(news: RivalNews, onVisit: ((key: string, name: string) => void) | null, onThank: (key: string) => Promise<'ok' | 'already' | 'offline'>): void {
  const { card, close } = openModal();
  card.append(el('h2', '', t('rival.news.title')));
  if (news.visitors.length) card.append(el('p', '', t('rival.news.who', { names: news.visitors.map((v) => v.name).join(', ') })));
  if (news.spill + news.trash) card.append(el('p', '', t('rival.news.mess', { spill: news.spill, trash: news.trash })));
  if (news.lost) card.append(el('p', '', t('rival.news.lost', { n: news.lost })));
  for (const p of news.helped) card.append(el('div', 'ui-note', t(`rival.news.${p}`)));
  if (news.hint) card.append(el('div', 'ui-muted', t('rival.news.hint')));
  const first = news.visitors[0];
  if (first) {
    const thank = button(t('rival.news.thank'), () => {
      thank.disabled = true;
      void onThank(first.key).then((res) => {
        thank.textContent = res === 'ok' ? t('rival.news.thanked', { name: first.name }) : res === 'already' ? t('rival.news.already') : t('rival.err.offline');
      });
    }, 'ui-btn secondary');
    if (onVisit) {
      card.append(
        button(t('rival.news.back', { name: first.name }), () => {
          close();
          onVisit(first.key, first.name);
        }, 'ui-btn'),
      );
    }
    card.append(thank);
  }
  card.append(button(t('rival.news.ok'), close, 'ui-btn secondary'));
}
