// Рейтинг магазинов (api/_lib/stats.ts): свои — друзья по приглашениям, и весь Telegram.
// Место считается по выручке за всё время; рядом — уровень магазина, звёзды и день. У чужих
// магазинов — «Заглянуть к конкуренту» (game/rival.ts).

import { t } from '../i18n';
import { STORE_LEVELS } from '../game/economy';
import { fetchLeaderboard, type BoardRow } from '../platform/analytics';
import { RIVAL_ACTIONS } from '../game/rival';
import { button, el, openModal } from './dom';
import { leagueTab } from './league';

/** Зайти к конкуренту: ключ из рейтинга (выдаёт сервер) и имя хозяина. */
type OnRival = (key: string, name: string) => void;

function table(rows: BoardRow[], start = 1, onRival?: OnRival): HTMLElement {
  const list = el('div', 'ui-board');
  rows.forEach((r, i) => {
    // Золотая табличка — поддержал автора звёздами (game/support.ts).
    const row = el('div', `ui-board-row${r.me ? ' me' : ''}${r.gold ? ' gold' : ''}`);
    if (r.gold) row.title = t('support.gold');
    const place = start + i;
    const medal = ['🥇', '🥈', '🥉'][place - 1] ?? `${place}.`;
    const who = el('div', 'ui-board-who');
    const name = r.me ? t('board.you', { name: r.name }) : r.name;
    who.append(el('b', '', r.gold ? `🏅 ${name}` : name), el('span', 'ui-item-sub', `${t(STORE_LEVELS[Math.min(r.level, STORE_LEVELS.length - 1)].nameKey)} · ★${r.rating.toFixed(1)} · ${t('hud.day', { n: r.day })}`));
    row.append(el('span', 'ui-board-place', medal), who, el('b', 'ui-board-sum', `${r.revenue.toLocaleString('ru-RU')} 💰`));
    const key = r.key;
    // Узкая строка: только значок, подпись — в пояснении над таблицей и во всплывающей подсказке.
    if (onRival && key && !r.me) {
      const go = button('🥷', () => onRival(key, r.name), 'ui-chip');
      go.title = go.ariaLabel = t('rival.go');
      row.append(go);
    }
    list.append(row);
  });
  return list;
}

/** Рейтинг; tab: 'league' — сразу вкладка «Турнир района» (level — для наград по месту). */
export function showLeaderboard(onRival?: OnRival, opts: { tab?: 'board' | 'league'; level?: number } = {}): void {
  const { card, close } = openModal();
  const go: OnRival | undefined = onRival && ((key, name) => {
    close();
    onRival(key, name);
  });
  // Две вкладки: общий рейтинг и турнир района (ui/league.ts).
  let tab = opts.tab ?? 'board';
  const head = () => {
    const tabs = el('div', 'ui-tabs');
    tabs.style.gridTemplateColumns = 'repeat(2, 1fr)';
    for (const id of ['board', 'league'] as const) {
      tabs.append(button(t(id === 'board' ? 'board.tab' : 'league.tab'), () => {
        if (tab === id) return;
        tab = id;
        render();
      }, `ui-tab${tab === id ? ' active' : ''}`));
    }
    return [el('h2', '', `🏆 ${t('board.title')}`), tabs];
  };
  let board: Awaited<ReturnType<typeof fetchLeaderboard>> | undefined;
  const render = () => {
    card.replaceChildren(...head());
    if (tab === 'league') {
      card.append(...leagueTab(opts.level), button(t('board.close'), close, 'ui-btn'));
      return;
    }
    if (board === undefined) {
      card.append(el('div', 'ui-muted', t('board.loading')));
      return;
    }
    if (!board) {
      card.append(el('p', '', t('board.off')));
    } else {
      card.append(el('div', 'ui-muted', t('board.note')));
      if (go) card.append(el('div', 'ui-muted', t('rival.note', { n: RIVAL_ACTIONS })));
      if (board.rank) card.append(el('div', 'ui-note', t('board.rank', { n: board.rank, total: board.total })));
      card.append(el('h3', '', t('board.friends')));
      card.append(board.friends.length > 1 ? table(board.friends, 1, go) : el('div', 'ui-muted', t('board.noFriends')));
      card.append(el('h3', '', t('board.top')), table(board.top, 1, go));
    }
    card.append(button(t('board.close'), close, 'ui-btn'));
  };
  render();
  void fetchLeaderboard().then((res) => {
    board = res;
    if (tab === 'board') render();
  });
}
