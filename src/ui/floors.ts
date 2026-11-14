// Раздел «Этажи» во вкладке «Развитие» (game/floors.ts, game/basement.ts, 13.11): открыть этаж, отделать его и
// обустроить то, что на нём живёт. Сейчас этаж один — подвал; второй и третий допишутся сюда же своим блоком.
// Автоматы подаём сухо: что дают и чем за них платишь (гости, облавы, «крыша») — рядом, одной строкой, без «азарта».

import { t } from '../i18n';
import { STORE_LEVELS, type StoreState } from '../game/economy';
import { buyFloor, finishCost, finishFloor, floorLock, floorOf, FLOORS, type FloorId } from '../game/floors';
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

type Update = (next: StoreState | null, feedback?: 'tap' | 'success' | 'error') => void;

/** Строка с картинкой из атласа (как artRow утра, morning.ts — своя, чтобы не тянуть утро сюда). */
function row(texture: string, name: string, notes: (string | HTMLElement)[], actions: HTMLElement[]): HTMLElement {
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
const warn = (text: string): HTMLElement => {
  const note = el('div', 'ui-item-sub', text);
  note.style.color = '#b13e53';
  return note;
};

/** Сводка свёрнутого раздела: что открыто и сколько автоматов. */
export function floorsSummary(state: StoreState): string {
  const b = basementOf(state);
  return b ? t('floors.summary', { n: b.slots, max: slotPlaces(state) }) : t('floors.closed');
}

/** Раздел «Этажи»: до «Магазинчика» и в Заречье его нет — меньше шума в меню. */
export function floorsBox(state: StoreState, getState: () => StoreState, update: Update): HTMLElement[] {
  const lock = floorLock(state, 'basement');
  if (lock === 'zar' || (lock === 'level' && state.level < FLOORS.basement.minLevel - 1)) return [];
  const box = el('div', 'ui-box');
  box.append(el('b', '', `${FLOORS.basement.icon} ${t('floors.title')}`), el('div', 'ui-muted', t('floors.note')));
  if (!floorOf(state, 'basement')) {
    box.append(openRow(state, 'basement', getState, update));
    return [box];
  }
  box.append(...basementRows(state, getState, update));
  return [box];
}

/** Этаж ещё не открыт: картинка, что внизу, и кнопка (или замок до нужного помещения). */
function openRow(state: StoreState, id: FloorId, getState: () => StoreState, update: Update): HTMLElement {
  const def = FLOORS[id];
  const lock = floorLock(state, id);
  const notes = [t('floor.basement.note')];
  if (lock === 'level') notes.push(`🔒 ${t('floors.lock', { name: t(STORE_LEVELS[def.minLevel].nameKey) })}`);
  return row('bsm_stairs', t('floor.basement'), notes, [
    button(
      t('floor.open', { cost: def.cost }),
      () => {
        const next = buyFloor(getState(), id);
        if (!next) return;
        track('floor_open', next.day, def.cost);
        toast('assets/ico_shop.png', t('floor.basement'), t('floor.opened'));
        update(next, 'success');
      },
      'ui-chip',
      Boolean(lock) || state.money < def.cost,
    ),
  ]);
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
  out.push(row('bsm_slot', t('bsm.slots', { n: b.slots, max }), notes, actions));
  for (const part of PART_IDS) out.push(partRow(state, part, getState, update));
  return out;
}

/** Склад-холодильник и подсобка ломбарда: что дают и кнопка «Обустроить». */
function partRow(state: StoreState, part: BasementPart, getState: () => StoreState, update: Update): HTMLElement {
  const has = basementOf(state)?.parts?.includes(part);
  const cost = PARTS[part].cost;
  // Сколько мест прибавит холодильник — доля склада нынешнего помещения.
  const note = part === 'cold' ? t('bsm.cold.note', { n: Math.round(STORE_LEVELS[state.level].warehouse * COLD_ROOM), power: COLD_POWER }) : t('bsm.back.note', { n: BACK_PAWN_SLOTS });
  const action = has
    ? el('span', 'ui-tag', t('bsm.part.on'))
    : button(`${cost} 💰`, () => update(buyPart(getState(), part), 'success'), 'ui-chip', state.money < cost);
  return row(part === 'cold' ? 'bsm_cold' : 'bsm_back', t(part === 'cold' ? 'bsm.cold' : 'bsm.back'), [note], [action]);
}
