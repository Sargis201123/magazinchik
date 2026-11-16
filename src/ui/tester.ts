// Раздел «🧪 Тестер» в самом низу «Развития» (16.11, автор: «чтоб я тестировал всё, что возможно»).
// Виден только «своим» (platform/tester.ts) и при разработке; обычный игрок его не увидит.

import { t } from '../i18n';
import type { StoreState } from '../game/economy';
import { grantTester, moneyLabel, TESTER_GRANTS } from '../game/tester';
import { testerMode } from '../platform/tester';
import { button, el } from './dom';

type Update = (next: StoreState | null, feedback?: 'tap' | 'success' | 'error') => void;

export function testerBox(getState: () => StoreState, update: Update): HTMLElement[] {
  if (!testerMode()) return [];
  const box = el('div', 'ui-box');
  box.append(el('b', '', `🧪 ${t('tester.title')}`), el('div', 'ui-muted', t('tester.note')));
  const chips = el('div', 'ui-chips');
  for (const amount of TESTER_GRANTS) {
    chips.append(
      button(`+${moneyLabel(amount)} 💰`, () => update(grantTester(getState(), amount), 'success'), 'ui-chip'),
    );
  }
  box.append(chips);
  return [box];
}
