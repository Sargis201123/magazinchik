// Мечты соседей (game/dreams.ts) в утреннем меню: карточка-новость над вкладками (мечта — «Вложиться» / «Не сейчас»,
// через две-три недели — чем кончилось) и раздел «Мечты соседей» во вкладке «Развитие» — во что вложились и что это
// даёт сейчас. Лица — свои портреты (art/dreams.py, portrait_dream_<кто>), как у жителей Заречья.

import { t, type TextKey } from '../i18n';
import type { StoreState } from '../game/economy';
import { regularById } from '../game/regulars';
import {
  BOAT_GUESTS,
  BREAD_CUT,
  CART_SHARE,
  DREAMS,
  dreamNews,
  investDream,
  investsOf,
  PAYBACK,
  seeDream,
  skipDream,
  type DreamId,
  type DreamInvest,
} from '../game/dreams';
import { track } from '../platform/analytics';
import { button, el, who } from './dom';

type Update = (next: StoreState | null, feedback?: 'tap' | 'success' | 'error') => void;

const nameOf = (id: DreamId): string => {
  const r = DREAMS[id].regular;
  return t(r ? regularById(r).nameKey : 'tale.anya.name');
};

/** Портрет и имя: кто пришёл и о чём мечтает (в списке — ещё строка: сколько вложено и что сейчас). */
const face = (id: DreamId, line?: string): HTMLElement => {
  const name = el('div');
  name.append(el('b', '', nameOf(id)), el('div', 'ui-item-sub', `${DREAMS[id].icon} ${t(`dream.${id}.name` as TextKey)}`));
  if (line) name.append(el('div', 'ui-item-sub', line));
  return who(`dream_${id}`, name, Boolean(line));
};

/** Что даёт сбывшаяся мечта — строкой (в новости и в списке). */
const perkText = (v: DreamInvest): string => {
  switch (DREAMS[v.id].perk) {
    case 'cart':
      return t('dream.perk.cart', { n: Math.round(v.sum * CART_SHARE) });
    case 'bread':
      return t('dream.perk.bread', { p: Math.round(BREAD_CUT * 100) });
    case 'boat':
      return t('dream.perk.boat', { p: Math.round(BOAT_GUESTS * 100) });
    default:
      return t('dream.perk.payback', { n: v.sum * PAYBACK });
  }
};

/** Утренняя карточка: новая мечта или новость о вложении (одна за утро — headlines.ts). */
export function dreamBox(state: StoreState, getState: () => StoreState, update: Update): HTMLElement[] {
  const news = dreamNews(state);
  if (!news) return [];
  const box = el('div', 'ui-box ui-tale');
  if (news.kind === 'ask') {
    const { id, sum } = news;
    box.append(
      el('b', '', t('dream.title')),
      face(id),
      el('p', '', t(`dream.${id}.ask` as TextKey, { n: sum })),
      el('div', 'ui-muted', t('dream.need')),
      button(
        t('dream.yes', { n: sum }),
        () => {
          const next = investDream(getState(), id);
          if (next) track('dream_invest', next.day, sum);
          update(next, 'success');
        },
        'ui-btn',
        state.money < sum,
      ),
      button(t('dream.no'), () => update(skipDream(getState(), id)), 'ui-btn secondary'),
    );
    return [box];
  }
  const { inv, ok, gift } = news;
  const dream = DREAMS[inv.id];
  const n = dream.perk === 'cart' ? Math.round(inv.sum * CART_SHARE) : inv.sum * PAYBACK;
  const p = Math.round((dream.perk === 'bread' ? BREAD_CUT : BOAT_GUESTS) * 100);
  box.append(el('b', '', t(ok ? 'dream.okTitle' : 'dream.failTitle', { icon: dream.icon })), face(inv.id), el('p', '', t(`dream.${inv.id}.${ok ? 'ok' : 'fail'}` as TextKey, { n, p })));
  if (gift) box.append(el('div', 'ui-note', t('dream.gift', { n: gift })));
  if (dream.regular) box.append(el('div', 'ui-muted', t('dream.loyal')));
  box.append(
    button(t(ok ? 'dream.okBtn' : 'dream.failBtn'), () => {
      const next = seeDream(getState());
      if (next) track(ok ? 'dream_ok' : 'dream_fail', next.day, inv.sum);
      update(next, ok || gift ? 'success' : 'tap');
    }),
  );
  return [box];
}

/** Раздел «Развития»: во что вложились — ждём новостей, сбылось (и что даёт) или не вышло. Пусто — раздела нет. */
export function dreamsBox(state: StoreState): { box: HTMLElement; summary: string } | null {
  const list = investsOf(state);
  if (!list.length) return null;
  const box = el('div', 'ui-box');
  box.append(el('b', '', t('dream.list')));
  for (const v of list) {
    const status = v.end === 'ok' ? `✅ ${perkText(v)}` : v.end === 'fail' ? t('dream.failed') : `⏳ ${t('dream.wait')}`;
    box.append(face(v.id, `${v.sum} 💰 · ${status}`));
  }
  const summary = t('dream.summary', { n: list.filter((v) => !v.end).length, k: list.filter((v) => v.end === 'ok').length });
  return { box, summary };
}
