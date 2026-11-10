// Раздел «Арендаторы» во вкладке «Развитие» (game/tenants.ts): свободные комнаты флигеля и кого в них пустить.
// У каждого — отделка (платит хозяин один раз), аренда за день и прибавка гостей; у тех, кто уже работает, —
// лицо и доверие хозяина комнаты и вторая отделка. Сцена перестраивает флигель по tenantsLook.

import { t } from '../i18n';
import type { StoreState } from '../game/economy';
import {
  evict,
  guestsOf,
  PAL_MAX,
  PAL_RENT,
  rentLock,
  rentOf,
  rentRoom,
  TENANT_IDS,
  tenantDesc,
  tenantGuests,
  tenantName,
  tenantPal,
  tenantPalLine,
  tenantRent,
  tenantRooms,
  TENANTS,
  tenantsOf,
  tenantTier,
  tenantWho,
  TIER_GUESTS,
  TIER_RENT,
  upgradeCost,
  upgradeLock,
  upgradeTenant,
  type TenantId,
} from '../game/tenants';
import { inZar } from '../game/zarshop';
import { track } from '../platform/analytics';
import { button, el, staffFace, toast, who } from './dom';

const effect = (state: StoreState, id: TenantId): string => t('tenant.effect', { n: rentOf(state, id), g: Math.round(guestsOf(state, id) * 100) });

export function tenantsBox(state: StoreState, getState: () => StoreState, update: (next: StoreState | null, feedback?: 'tap' | 'success' | 'error') => void): HTMLElement[] {
  const rooms = tenantRooms(state);
  if (inZar(state) || !rooms) return [];
  const here = tenantsOf(state);
  const box = el('div', 'ui-box');
  box.append(el('b', '', `🔑 ${t('tenant.title')}`), el('div', 'ui-muted', t('tenant.note')), el('div', '', t('tenant.rooms', { n: here.length, max: rooms })));
  if (here.length) box.append(el('div', '', t('tenant.total', { n: tenantRent(state), g: Math.round((tenantGuests(state) - 1) * 100) })));
  // Сначала те, кто уже работает, потом кого можно пустить.
  for (const id of [...here, ...TENANT_IDS.filter((other) => !here.includes(other))]) {
    const item = TENANTS[id];
    const lock = rentLock(state, id);
    const row = el('div', 'ui-item');
    const icon = el('div', '', item.icon);
    icon.style.cssText = `width: 34px; font-size: 24px; text-align: center;${lock === 'full' ? ' filter: grayscale(0.8) opacity(0.6);' : ''}`;
    const body = el('div');
    const tier2 = lock === 'here' && tenantTier(state, id) === 2;
    body.append(el('div', 'ui-item-name', `${t(tenantName(id))}${tier2 ? ' ★' : ''}`), el('div', 'ui-item-sub', t(tenantDesc(id))), el('div', 'ui-item-sub', effect(state, id)));
    const actions = el('div', 'ui-item-actions stack');
    if (lock === 'here') {
      // Хозяин комнаты: лицо, имя и доверие (растёт, когда выполняешь его просьбы на доске «Заказы»).
      if (item.face !== undefined) {
        const pal = tenantPal(state, id);
        const line = pal >= PAL_MAX ? t(tenantPalLine(id)) : t('tenant.pal', { name: t(tenantWho(id)), n: pal, max: PAL_MAX, p: Math.round(PAL_RENT * 100) });
        body.append(who(staffFace(item.face), el('div', 'ui-item-sub', line), true));
      }
      const up = upgradeLock(state, id);
      if (up !== 'done') {
        const cost = upgradeCost(id);
        body.append(el('div', 'ui-item-sub', t('tenant.upgradeNote', { n: Math.round(item.rent * TIER_RENT), g: Math.round((item.guests + TIER_GUESTS) * 100) })));
        actions.append(
          button(
            t('tenant.upgrade', { n: `${cost} 💰` }),
            () => {
              const next = upgradeTenant(getState(), id);
              if (!next) return;
              track('tenant_up', next.day, cost);
              toast('assets/ico_shop.png', t(tenantName(id)), t('tenant.upgraded', { n: rentOf(next, id) }));
              update(next, 'success');
            },
            'ui-chip hood-buy',
            up === 'money',
          ),
        );
      }
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
