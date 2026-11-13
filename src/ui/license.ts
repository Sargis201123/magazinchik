// Лицензия на пиво и сигареты в меню (game/license.ts): раздел во вкладке «Развитие» и утренняя карточка
// о штрафе после проверки. Подаём сухо и прямо: товар с высокой наценкой, продавать только взрослым.

import { t } from '../i18n';
import { PRODUCTS, STORE_LEVELS, type StoreState } from '../game/economy';
import { buyLicense, hasLicense, LICENSE_FINE, LICENSE_LEVEL, LICENSE_PRICE, licenseLock, seeLicenseNotice, type LicenseCheck } from '../game/license';
import { track } from '../platform/analytics';
import { button, el, toast } from './dom';
import { sheetPng } from './sheet';

type Update = (next: StoreState | null, feedback?: 'tap' | 'success' | 'error') => void;

/** Красная строка-предупреждение. */
const warn = (text: string): HTMLElement => {
  const note = el('div', 'ui-item-sub', text);
  note.style.color = '#b13e53';
  return note;
};

/** Раздел «Лицензия» в «Развитии»: до «Минимаркета» и в Заречье его нет — меньше шума в меню. */
export function licenseBox(state: StoreState, getState: () => StoreState, update: Update): HTMLElement[] {
  const lock = licenseLock(state);
  if (lock === 'zar' || (state.level < LICENSE_LEVEL - 1 && !state.license)) return [];
  const box = el('div', 'ui-box');
  box.append(el('b', '', `🔞 ${t('license.title')}`));
  const row = el('div', 'ui-item');
  const img = el('img');
  img.src = sheetPng('license_stand');
  img.alt = '';
  img.style.cssText = `width: 40px; height: 38px; object-fit: contain; image-rendering: pixelated;${lock ? ' filter: grayscale(0.8) opacity(0.6);' : ''}`;
  const body = el('div');
  const goods = `${PRODUCTS.beer.icon} ${t('product.beer')} · ${PRODUCTS.cigarettes.icon} ${t('product.cigarettes')}`;
  body.append(el('div', 'ui-item-name', goods), el('div', 'ui-item-sub', t('license.note')));
  const license = state.license;
  if (hasLicense(state) && license) {
    body.append(el('div', 'ui-item-sub', `✅ ${t('license.on', { n: license.since ?? state.day })}`));
    if (license.strikes) body.append(warn(`⚠️ ${t('license.strikes', { n: license.strikes, fine: LICENSE_FINE })}`));
    if (license.fined) body.append(warn(t('license.lastChance')));
    if (license.last && !license.last.fine) body.append(el('div', 'ui-item-sub', t('license.checkOk', { n: license.last.day })));
  } else {
    if (license?.last?.revoked) body.append(warn(t('license.lost', { n: license.last.day })));
    if (lock === 'level') body.append(el('div', 'ui-item-sub', `🔒 ${t('license.lock', { name: t(STORE_LEVELS[LICENSE_LEVEL].nameKey) })}`));
  }
  row.append(img, body);
  box.append(row);
  if (!hasLicense(state)) {
    box.append(
      button(
        t('license.buy', { cost: LICENSE_PRICE }),
        () => {
          const bought = buyLicense(getState());
          if (!bought) return;
          track('license', bought.day, license?.last?.revoked ? 2 : 1);
          toast('assets/ico_shop.png', t('license.bought'), t('license.boughtText'));
          update(bought, 'success');
        },
        'ui-btn secondary',
        Boolean(lock) || state.money < LICENSE_PRICE,
      ),
    );
  }
  return [box];
}

/** Утренняя карточка: вчера вечером проверка нашла продажу подросткам — штраф, а во второй раз и лицензию отобрали. */
export function licenseNoticeBox(check: LicenseCheck, getState: () => StoreState, update: Update): HTMLElement {
  const box = el('div', 'ui-box');
  box.append(
    el('h3', '', `🧾 ${t('license.check.title')}`),
    el('p', '', t(check.revoked ? 'license.check.revoked' : 'license.check.fine', { n: check.found, fine: check.fine })),
    button(t('license.check.ok'), () => update(seeLicenseNotice(getState()), 'tap')),
  );
  return box;
}
