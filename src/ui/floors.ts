// Раздел «Этажи» во вкладке «Развитие» (game/floors.ts, game/basement.ts, 13.11): открыть этаж, отделать его и
// обустроить то, что на нём живёт. Подвал — целиком здесь; второй этаж (одежда) — открыть здесь, стойки и партии —
// своим блоком в ui/clothes.ts; третий этаж (фудкорт, game/foodcourt.ts) — открыть и отделать здесь, а точки еды и то,
// что на нём случается за день, — в плитке «Фудкорт» вкладки «Уголки».
// Автоматы подаём сухо: что дают и чем за них платишь (гости, облавы, «крыша») — рядом, одной строкой, без «азарта».

import { t, type TextKey } from '../i18n';
import { STORE_LEVELS, type StoreState } from '../game/economy';
import { buyFloor, buyFloorUp, finishCost, finishFloor, FLOOR_UPGRADES, floorLock, floorOf, FLOORS, floorUpLock, type FloorId } from '../game/floors';
import {
  BACK_PAWN_SLOTS,
  basementOf,
  buyPart,
  buySlot,
  COLD_POWER,
  COLD_ROOM,
  MOMS_PER_SLOT,
  PART_IDS,
  PARTS,
  raidFine,
  raidLock,
  sellSlot,
  SLOT_COST,
  SLOT_PLACES,
  SLOT_RESALE,
  slotIncome,
  slotPlaces,
  slotsPlan,
  type BasementPart,
} from '../game/basement';
import { track } from '../platform/analytics';
import { button, el, toast } from './dom';
import { setItemIcon } from './sheet';
import { clothesRows } from './clothes';
import { clothesOf, stockTotal } from '../game/clothes';
import { stallPlaces, stallsOf, STALL_PLACES } from '../game/foodcourt';

type Update = (next: StoreState | null, feedback?: 'tap' | 'success' | 'error') => void;

/** Строка с картинкой из атласа (как artRow утра, morning.ts — своя, чтобы не тянуть утро сюда). Её же берёт ui/foodcourt.ts. */
export function row(texture: string, name: string, notes: (string | HTMLElement)[], actions: HTMLElement[]): HTMLElement {
  const item = el('div', 'ui-item');
  const img = el('img', 'ui-item-art');
  setItemIcon(img, texture);
  img.alt = '';
  const body = el('div');
  body.append(el('div', 'ui-item-name', name), ...notes.map((n) => (typeof n === 'string' ? el('div', 'ui-item-sub', n) : n)));
  const right = el('div', 'ui-item-actions');
  right.append(...actions);
  item.append(img, body, right);
  return item;
}

/** Красная строка — цена для репутации. */
export const warn = (text: string): HTMLElement => {
  const note = el('div', 'ui-item-sub', text);
  note.style.color = '#b13e53';
  return note;
};

/** Сводка свёрнутого раздела: что открыто и сколько автоматов (вещей на стойках второго этажа, точек фудкорта). */
export function floorsSummary(state: StoreState): string {
  const b = basementOf(state);
  const c = clothesOf(state);
  const parts = b ? [t('floors.summary', { n: b.slots, max: slotPlaces(state) })] : [];
  if (c) parts.push(t('floors.second', { n: stockTotal(c) }));
  if (floorOf(state, 'third')) parts.push(t('floors.summaryFood', { n: stallsOf(state).length, max: stallPlaces(state) }));
  return parts.length ? parts.join(' · ') : t('floors.closed');
}

/** Этаж показывать в разделе: открыт или до него одно помещение. */
const nearFloor = (state: StoreState, id: FloorId): boolean => {
  const lock = floorLock(state, id);
  return lock !== 'zar' && !(lock === 'level' && state.level < FLOORS[id].minLevel - 1);
};

/** Раздел «Этажи»: до «Магазинчика» и в Заречье его нет — меньше шума в меню. */
export function floorsBox(state: StoreState, getState: () => StoreState, update: Update): HTMLElement[] {
  if (!nearFloor(state, 'basement')) return [];
  const box = el('div', 'ui-box');
  box.append(el('b', '', `${FLOORS.basement.icon} ${t('floors.title')}`), el('div', 'ui-muted', t('floors.note')));
  if (!floorOf(state, 'basement')) box.append(openRow(state, 'basement', getState, update));
  else box.append(...basementRows(state, getState, update), ...floorUpRows(state, 'basement', getState, update));
  // Второй этаж — одежда (game/clothes.ts, 13.11): показываем с «Минимаркета» (за шаг до «Супермаркета»), чтобы
  // было видно, к чему расти.
  if (nearFloor(state, 'second')) {
    if (!floorOf(state, 'second')) box.append(openRow(state, 'second', getState, update));
    else box.append(...clothesRows(state, getState, update, row, warn), ...floorUpRows(state, 'second', getState, update));
  }
  // Третий этаж — фудкорт: с «Супермаркета» видно, что он будет (замок до «Универмага» и до второго этажа).
  if (nearFloor(state, 'third')) box.append(...thirdRows(state, getState, update), ...floorUpRows(state, 'third', getState, update));
  return [box];
}

/**
 * Улучшения открытого этажа (game/floors.ts FLOOR_UPGRADES, 14.11): строка на каждое — название, что даёт, кнопка с
 * ценой или почему пока нельзя. Тексты — fup.<этаж>.<id> и fup.<этаж>.<id>.note: их добавляет модуль этажа вместе
 * с улучшением. Этаж закрыт или улучшений нет — строк нет.
 */
export function floorUpRows(state: StoreState, id: FloorId, getState: () => StoreState, update: Update): HTMLElement[] {
  if (!floorOf(state, id)) return [];
  return FLOOR_UPGRADES[id].map((u) => {
    const lock = floorUpLock(state, id, u.id);
    const notes = [t(`fup.${id}.${u.id}.note` as TextKey)];
    if (lock === 'level') notes.push(`🔒 ${t('floors.lock', { name: t(STORE_LEVELS[u.minLevel ?? 0].nameKey) })}`);
    if (lock === 'finish') notes.push(`🔒 ${t('fup.lockFinish')}`);
    if (lock === 'needs') notes.push(`🔒 ${t('fup.lockNeeds', { name: t(`fup.${id}.${u.needs}` as TextKey) })}`);
    const action =
      lock === 'owned'
        ? el('span', 'ui-tag', t('bsm.part.on'))
        : button(
            `${u.price} 💰`,
            () => {
              const next = buyFloorUp(getState(), id, u.id);
              if (next) track('floor_up', next.day, u.price);
              update(next, 'success');
            },
            'ui-chip',
            Boolean(lock) || state.money < u.price,
          );
    return row(u.art ?? FLOOR_ROW[id].art, `${u.icon} ${t(`fup.${id}.${u.id}` as TextKey)}`, notes, [action]);
  });
}

/** Что показать у закрытого этажа: картинка, название, что там, и что сказать после открытия. */
const FLOOR_ROW: Record<FloorId, { art: string; name: TextKey; note: TextKey; opened: TextKey }> = {
  basement: { art: 'bsm_stairs', name: 'floor.basement', note: 'floor.basement.note', opened: 'floor.opened' },
  second: { art: 'fl2_front', name: 'floor.second', note: 'floor.second.note', opened: 'floor.second.opened' },
  third: { art: 'fc_lift', name: 'floor.third', note: 'floor.third.note', opened: 'floor.third.opened' },
};

/** Этаж ещё не открыт: картинка, что там, и кнопка (или замок до нужного помещения / этажа ниже). */
function openRow(state: StoreState, id: FloorId, getState: () => StoreState, update: Update): HTMLElement {
  const def = FLOORS[id];
  const look = FLOOR_ROW[id];
  const lock = floorLock(state, id);
  const notes = [t(look.note)];
  if (lock === 'level') notes.push(`🔒 ${t('floors.lock', { name: t(STORE_LEVELS[def.minLevel].nameKey) })}`);
  if (lock === 'below') notes.push(`🔒 ${t('floors.lockBelow')}`);
  return row(look.art, t(look.name), notes, [
    button(
      t('floor.open', { cost: def.cost }),
      () => {
        const next = buyFloor(getState(), id);
        if (!next) return;
        track('floor_open', next.day, def.cost);
        toast('assets/ico_shop.png', t(look.name), t(look.opened));
        update(next, 'success');
      },
      'ui-chip',
      Boolean(lock) || state.money < def.cost,
    ),
  ]);
}

/** Третий этаж: открыть; открыт — как попасть, ремонт и где точки еды. */
function thirdRows(state: StoreState, getState: () => StoreState, update: Update): HTMLElement[] {
  if (!floorOf(state, 'third')) return [openRow(state, 'third', getState, update)];
  const out: HTMLElement[] = [el('div', 'ui-item-sub', `🍕 ${t('floor.third.up')}`)];
  const fin = finishCost(state, 'third');
  if (fin !== null) {
    out.push(
      row('fc_wall', t('floor.third.finish'), [t('floor.third.finish.note', { n: STALL_PLACES[STALL_PLACES.length - 1] })], [
        button(`${fin} 💰`, () => update(finishFloor(getState(), 'third'), 'success'), 'ui-chip', state.money < fin),
      ]),
    );
  }
  return out;
}

function basementRows(state: StoreState, getState: () => StoreState, update: Update): HTMLElement[] {
  const b = basementOf(state)!;
  const out: HTMLElement[] = [el('div', 'ui-item-sub', t('floor.down'))];
  // Ремонт: свет и проводка — мест под автоматы больше.
  const fin = finishCost(state, 'basement');
  if (fin !== null) {
    out.push(
      row('bsm_brick', t('floor.finish'), [t('floor.finish.note', { n: SLOT_PLACES[SLOT_PLACES.length - 1] })], [
        button(`${fin} 💰`, () => update(finishFloor(getState(), 'basement'), 'success'), 'ui-chip', state.money < fin),
      ]),
    );
  }
  // Автоматы: сколько стоит, что даёт вечером и чем за это платишь.
  const max = slotPlaces(state);
  const plan = slotsPlan(state);
  const notes: (string | HTMLElement)[] = [
    plan ? t('bsm.today', { n: plan.players, sum: plan.income - plan.share }) : t('bsm.slots.note', { sum: slotIncome(state.level) }),
    warn(t('bsm.cost', { p: Math.round(MOMS_PER_SLOT * 100), fine: raidFine(Math.max(1, b.slots)) })),
  ];
  if (plan?.share) notes.push(warn(t('bsm.racket', { n: plan.share })));
  const locked = raidLock(state);
  if (locked) notes.push(warn(t('bsm.raidLock', { n: locked + 1 })));
  const last = b.last;
  if (last && last.day === state.day - 1) {
    notes.push(last.raid ? warn(t('bsm.raid', { n: last.raid.n, fine: last.raid.fine })) : t('bsm.last', { n: last.players, sum: last.income - last.share }));
  }
  const actions: HTMLElement[] = [];
  if (b.slots < max) {
    actions.push(
      button(
        t('bsm.slot.buy', { cost: SLOT_COST }),
        () => {
          const next = buySlot(getState());
          if (next) track('slot_buy', next.day, slotPlaces(next));
          update(next, 'success');
        },
        'ui-chip',
        Boolean(locked) || state.money < SLOT_COST,
      ),
    );
  }
  if (b.slots) actions.push(button(t('bsm.slot.sell', { n: Math.round(SLOT_COST * SLOT_RESALE) }), () => update(sellSlot(getState())), 'ui-chip'));
  out.push(row('bsm_slot2', t('bsm.slots', { n: b.slots, max }), notes, actions));
  for (const part of PART_IDS) out.push(partRow(state, part, getState, update));
  return out;
}

/**
 * Склад-холодильник и подсобка ломбарда: что дают и кнопка «Обустроить». Картинки строк (и строки автоматов) —
 * из нового рисунка подвала (art/basement_art.py, 14.11): в меню то же, что игрок видит внизу.
 */
function partRow(state: StoreState, part: BasementPart, getState: () => StoreState, update: Update): HTMLElement {
  const has = basementOf(state)?.parts?.includes(part);
  const cost = PARTS[part].cost;
  // Сколько мест прибавит холодильник — доля склада нынешнего помещения.
  const note = part === 'cold' ? t('bsm.cold.note', { n: Math.round(STORE_LEVELS[state.level].warehouse * COLD_ROOM), power: COLD_POWER }) : t('bsm.back.note', { n: BACK_PAWN_SLOTS });
  const action = has
    ? el('span', 'ui-tag', t('bsm.part.on'))
    : button(`${cost} 💰`, () => update(buyPart(getState(), part), 'success'), 'ui-chip', state.money < cost);
  return row(part === 'cold' ? 'bsm_cold2' : 'bsm_pawn', t(part === 'cold' ? 'bsm.cold' : 'bsm.back'), [note], [action]);
}
