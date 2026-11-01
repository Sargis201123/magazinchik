// Заречье в утреннем окне (game/zarechye.ts): карточка от города «В Заречье пустует торговая улица»,
// переключатель «Где работаем сегодня: Центр / Заречье», новости Семёна Сома, истории жителей и
// карточка в «Развитии». Решения здесь не принимаются — только кнопки; состояние меняет утро (morning.ts).

import type { StoreState } from '../game/economy';
import {
  bossWon,
  hasZar,
  inZar,
  homeShop,
  zarHomeEstimate,
  zarHomeUsual,
  zarLock,
  zarShop,
  ZAR_DUEL_FISH,
  ZAR_MAX_LEVEL,
  ZAR_PRICE,
  type Where,
  type ZarBossStep,
  type ZarTale,
} from '../game/zarechye';
import { STORE_LEVELS } from '../game/economy';
import { t } from '../i18n';
import { button, el } from './dom';
import { dialogBox } from './dialog';
import { assetUrl } from '../platform/assets';

/** Голос Сома — низкий, как у Эдуарда; жители — повыше. */
const SOM_PITCH = 260;
const RESIDENT_PITCH = 560;

/** Карточка от города: открыть лавку в Заречье или «Потом» (останется в «Развитии»). */
export function zarOfferBox(state: StoreState, onOpen: () => void, onLater: () => void): HTMLElement {
  const short = state.money < ZAR_PRICE || state.debt > 0;
  const after = [
    el('div', 'ui-note', t('zar.offer.note', { cost: ZAR_PRICE })),
    ...(short ? [el('div', 'ui-note', t(state.debt > 0 ? 'zar.offer.debt' : 'zar.offer.short', { cost: ZAR_PRICE }))] : []),
    button(t('zar.offer.yes', { cost: ZAR_PRICE }), onOpen, 'ui-btn', short),
  ];
  return dialogBox({
    caption: t('zar.offer.caption'),
    art: 'assets/zar_offer.png',
    portrait: 'portrait_anchor_happy',
    name: t('zar.offer.who'),
    text: t('zar.offer.text'),
    pitch: 520,
    after,
    nextLabel: t('zar.offer.later'),
    onNext: onLater,
  });
}

/** «Где работаем сегодня»: две кнопки, сегодняшняя — нажата. */
export function zarSwitchBox(state: StoreState, onSwitch: (where: Where) => void): HTMLElement[] {
  if (!hasZar(state)) return [];
  const box = el('div', 'ui-box ui-zar-switch');
  const here: Where = inZar(state) ? 'zar' : 'home';
  const chips = el('div', 'ui-chips');
  for (const where of ['home', 'zar'] as const) {
    const b = button(t(where === 'home' ? 'zar.switch.home' : 'zar.switch.zar'), () => where !== here && onSwitch(where), `ui-chip${where === here ? ' active' : ''}`);
    b.dataset.zar = where;
    chips.append(b);
  }
  const note = here === 'zar' ? t('zar.switch.noteZar', { n: zarHomeUsual(state) }) : t('zar.switch.noteHome', { n: zarHomeEstimate(state) });
  box.append(el('b', '', t('zar.switch.title')), chips, el('div', 'ui-muted', note));
  return [box];
}

/** Новость Семёна Сома: портрет с настроением, реплика, что это значит. */
export function zarBossBox(stage: number, step: ZarBossStep, onNext: () => void): HTMLElement {
  const note = t(step.noteKey, { n: ZAR_DUEL_FISH, money: step.reward?.money ?? 0 });
  return dialogBox({
    caption: t('zar.boss.caption'),
    portrait: `portrait_zar_som${step.mood ? `_${step.mood}` : ''}`,
    name: t('zar.boss.name'),
    text: `«${t(step.lineKey, { n: ZAR_DUEL_FISH })}»`,
    pitch: SOM_PITCH,
    after: [el('div', 'ui-note', note)],
    nextLabel: t(stage > 3 ? 'zar.boss.hooray' : 'zar.boss.ok'),
    onNext,
  });
}

/** Шаг истории жителя Заречья. */
export function zarTaleBox(tale: ZarTale, beat: number, onNext: () => void): HTMLElement {
  const reward = tale.beats[beat].reward;
  const after = reward?.money ? [el('div', 'ui-note', t('zar.tale.money', { n: reward.money }))] : reward?.rating ? [el('div', 'ui-note', t('zar.tale.rating'))] : [];
  return dialogBox({
    caption: t('zar.tale.caption'),
    portrait: tale.portrait,
    name: t(tale.nameKey),
    text: t(tale.beats[beat].key),
    pitch: RESIDENT_PITCH,
    after,
    nextLabel: t('zar.tale.ok'),
    onNext,
  });
}

/** «Развитие»: Заречье — закрыто, можно открыть или уже открыто (что там и сколько приносит Центр). */
export function zarGrowBox(state: StoreState, onOpen: () => void): HTMLElement[] {
  const lock = zarLock(state);
  // До финала о Заречье молчим — как о здании «Гиганта» до стройки.
  if (lock === 'finale') return [];
  const box = el('div', 'ui-box');
  box.append(el('b', '', `🌉 ${t('zar.title')}`));
  const art = el('img');
  art.src = assetUrl('assets/zar_offer.png');
  art.alt = '';
  art.style.cssText = `display: block; width: 100%; max-width: 300px; margin: 6px auto; image-rendering: pixelated;${hasZar(state) || !lock ? '' : ' filter: grayscale(0.8) opacity(0.75);'}`;
  box.append(art);
  if (!hasZar(state)) {
    if (lock) {
      box.append(el('div', 'ui-muted', `🔒 ${t('zar.lock.hyper')}`));
      return [box];
    }
    box.append(el('div', '', t('zar.grow.offer')));
    if (state.debt > 0) box.append(el('div', 'ui-note', t('zar.offer.debt')));
    box.append(button(t('zar.offer.yes', { cost: ZAR_PRICE }), onOpen, 'ui-btn', state.money < ZAR_PRICE || state.debt > 0));
    return [box];
  }
  const zar = zarShop(state)!;
  const home = homeShop(state);
  box.append(
    el('div', 'ui-muted', t('zar.grow.shop', { name: t(STORE_LEVELS[zar.level].nameKey), r: zar.rating.toFixed(1), step: zar.level + 1, max: ZAR_MAX_LEVEL + 1 })),
    el('div', 'ui-muted', t('zar.grow.home', { name: t(STORE_LEVELS[home.level].nameKey), n: zarHomeEstimate(state) })),
    el('div', 'ui-muted', t(bossWon(state) ? 'zar.grow.somFriends' : 'zar.grow.som')),
  );
  return [box];
}
