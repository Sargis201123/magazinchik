// «Район» в утре (game/town.ts, platform/town.ts): общая цель недели с полоской и наградой, «Магазин дня» с кнопкой
// «В гости»; и то, что пришло от района само, — чаевые от гостей, оставивших отметку, и полив теплицы от друзей.

import { t } from '../i18n';
import { STORE_LEVELS, type StoreState } from '../game/economy';
import { water, WATER_MS } from '../game/garden';
import { claimGoal, goalReward, takeLikes } from '../game/town';
import { homeLevel } from '../game/zarshop';
import { track } from '../platform/analytics';
import { takeTownGifts, townInfo } from '../platform/town';
import { button, el, toast } from './dom';

type Update = (next: StoreState | null, feedback?: 'tap' | 'success' | 'error') => void;
const money = (n: number) => n.toLocaleString('ru-RU');

/**
 * Что пришло от района, пока игрока не было: гости магазина оставили отметки (и чаевые), друзья полили теплицу.
 * Забирается один раз (сервер уже списал) — зовём, когда утро открылось и когда пришли данные.
 */
export function applyTownGifts(getState: () => StoreState, update: Update): void {
  const { likes, waters } = takeTownGifts();
  let state = getState();
  let changed = false;
  const liked = likes ? takeLikes(state, likes) : null;
  if (liked) {
    state = liked.state;
    changed = true;
    track('town_likes', state.day, likes);
    toast('assets/ico_shop.png', t('town.likes.title'), t('town.likes.text', { n: likes, sum: money(liked.money) }));
  }
  const wet = waters ? water(state, Date.now(), waters) : null;
  if (wet) {
    state = wet;
    changed = true;
    track('town_water', state.day, waters);
    toast('assets/ico_shop.png', t('garden.title'), t('town.watered', { n: Math.round((waters * WATER_MS) / 3600_000) }));
  }
  if (changed) update(state, 'success');
}

/** Карточка района: цель недели и магазин дня. Сервера нет (не Telegram) — карточки нет. */
export function townBox(state: StoreState, getState: () => StoreState, update: Update, onDayShop?: () => void): HTMLElement[] {
  const info = townInfo();
  if (!info) return [];
  const box = el('div', 'ui-box');
  box.append(el('b', '', `🏘 ${t('town.title')}`));
  // Награда: за прошлую неделю (цель набрали, а забрать не успел) или за эту, если уже набрали.
  const { goal } = info;
  const done = goal.total >= goal.target;
  const claimWeek = info.last && (state.town?.goal ?? 0) < info.last.week ? info.last.week : done && goal.mine && (state.town?.goal ?? 0) < goal.week ? goal.week : 0;
  const bar = el('div', 'ui-bar');
  const fill = el('div', 'ui-bar-fill');
  fill.style.cssText = `width: ${Math.min(100, Math.round((goal.total / goal.target) * 100))}%; background: ${done ? '#63c74d' : '#feae34'};`;
  bar.append(fill);
  box.append(el('div', '', t(done ? 'town.goal.done' : 'town.goal', { n: money(goal.total), max: money(goal.target) })), bar);
  if (!done) box.append(el('div', 'ui-muted', t('town.goal.note', { days: goal.left, n: goalReward(homeLevel(state)) })));
  if (claimWeek)
    box.append(
      button(
        t('town.goal.claim', { n: `${goalReward(homeLevel(state))} 💰` }),
        () => {
          const res = claimGoal(getState(), claimWeek);
          if (!res) return;
          track('town_goal', res.state.day, res.money);
          toast('assets/ico_shop.png', t('town.goal.wonTitle'), t('town.goal.wonText', { n: money(res.money) }));
          update(res.state, 'success');
        },
        'ui-btn secondary',
      ),
    );
  else if (done) box.append(el('div', 'ui-muted', t(goal.mine ? 'town.goal.taken' : 'town.goal.notMine')));
  // Магазин дня: настоящий магазин другого игрока — зайти и оставить отметку.
  const shop = info.shop;
  if (shop) {
    const row = el('div', 'ui-row');
    const name = shop.shop ? `«${shop.shop}»` : t(STORE_LEVELS[Math.min(shop.level, STORE_LEVELS.length - 1)].nameKey);
    row.append(el('span', '', `🏪 ${t('town.day', { shop: name, name: shop.name, day: shop.day })}${info.liked ? ' 👍' : ''}`), ...(onDayShop ? [button(t('visitShop.go'), onDayShop, 'ui-chip')] : []));
    box.append(row);
  }
  return [box];
}
