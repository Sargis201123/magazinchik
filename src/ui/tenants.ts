// Раздел «Арендаторы» во вкладке «Развитие» (game/tenants.ts): свободные комнаты флигеля и кого в них пустить.
// У каждого — отделка (платит хозяин один раз), аренда за день и прибавка гостей. Сцена перестраивает
// флигель по tenantsLook.

import { t } from '../i18n';
import type { StoreState } from '../game/economy';
import { evict, rentLock, rentRoom, TENANT_IDS, tenantDesc, tenantGuests, tenantName, tenantRent, tenantRooms, TENANTS, tenantsOf, type TenantId } from '../game/tenants';
import { inZar } from '../game/zarshop';
import { track } from '../platform/analytics';
import { button, el, toast } from './dom';

const effect = (id: TenantId): string => t('tenant.effect', { n: TENANTS[id].rent, g: Math.round(TENANTS[id].guests * 100) });

export function tenantsBox(state: StoreState, getState: () => StoreState, update: (next: StoreState | null, feedback?: 'tap' | 'success' | 'error') => void): HTMLElement[] {
  const rooms = tenantRooms(state);
  if (inZar(state) || !rooms) return [];
  const here = tenantsOf(state);
  const box = el('div', 'ui-box');
  box.append(el('b', '', `🔑 ${t('tenant.title')}`), el('div', 'ui-muted', t('tenant.note')), el('div', '', t('tenant.rooms', { n: here.length, max: rooms })));
  if (here.length) box.append(el('div', '', t('tenant.total', { n: tenantRent(state), g: Math.round((tenantGuests(state) - 1) * 100) })));
  else if (here.length >= rooms) box.append(el('div', 'ui-note', t('tenant.full')));
  // Сначала те, кто уже работает, потом кого можно пустить.
  for (const id of [...here, ...TENANT_IDS.filter((other) => !here.includes(other))]) {
    const item = TENANTS[id];
    const lock = rentLock(state, id);
    const row = el('div', 'ui-item');
    const icon = el('div', '', item.icon);
    icon.style.cssText = `width: 34px; font-size: 24px; text-align: center;${lock === 'full' ? ' filter: grayscale(0.8) opacity(0.6);' : ''}`;
    const body = el('div');
    body.append(el('div', 'ui-item-name', t(tenantName(id))), el('div', 'ui-item-sub', t(tenantDesc(id))), el('div', 'ui-item-sub', effect(id)));
    const actions = el('div', 'ui-item-actions');
    if (lock === 'here') {
      actions.append(
        el('span', 'ui-tag', t('tenant.here')),
        button(
          t('tenant.evict'),
          () => {
            toast('assets/ico_shop.png', t('tenant.title'), t('tenant.left', { name: t(tenantName(id)) }));
            update(evict(getState(), id), 'tap');
          },
          'ui-chip',
        ),
      );
    } else if (lock === 'full') body.append(el('div', 'ui-item-sub', t('tenant.full')));
    else {
      actions.append(
        button(
          t('tenant.rent', { n: `${item.setup} 💰` }),
          () => {
            const next = rentRoom(getState(), id);
            if (!next) return;
            track('tenant', next.day, item.setup);
            toast('assets/ico_shop.png', t('tenant.rented'), t('tenant.rentedText', { name: t(tenantName(id)) }));
            update(next, 'success');
          },
          'ui-chip hood-buy',
          lock === 'money',
        ),
      );
    }
    row.append(icon, body, actions);
    box.append(row);
  }
  return [box];
}
