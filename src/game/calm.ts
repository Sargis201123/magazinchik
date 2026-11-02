// Старые сохранения после упрощения 02.11 («спокойный персонал»): поля убранных механик снимаем, чтобы
// они не жили в сохранении мёртвым грузом и не всплыли, если поле когда-нибудь снова понадобится.
//
// Что было убрано и что игрок теряет (ничего оплаченного):
// - поломка холодильника — полка просто снова работает (флаг broken снят, ремонт не нужен);
// - болезнь, выходной, «отпроситься», усталость — все снова на смене;
// - просьба о прибавке — снята, обида — прощена; кто уже получил прибавку, получает её и дальше;
// - неожиданный счёт и переманивание — утреннее событие снято (неоплаченный счёт так и не был выставлен);
// - ночные кражи и сторож — сторожу платили за ночь, вперёд не оплачено; Бобик остаётся при магазине;
// - навыки хозяина — растут сами по уровню (owner.ts), очки навыков ничего не стоили.
// Заречье (zarechye.ts) хранит второй магазин срезом тех же полей — его чистим так же.

import type { StaffMember, StoreState } from './economy';
import { EVENT_KINDS, type DayPlan } from './events';
import type { ShopSlice } from './zarechye';

/** Поля сотрудника, которых больше нет. */
const OLD_STAFF = ['raiseAsk', 'upset', 'streak', 'offDay'] as const;
/** Поля старого сохранения, которых больше нет в StoreState. */
const OLD_STATE = ['quitNotice', 'skills'] as const;

type Loose = Record<string, unknown>;

/** Убрать из объекта перечисленные поля; если их не было — тот же объект. */
function strip<T extends object>(obj: T, keys: readonly string[]): T {
  if (!keys.some((k) => k in obj)) return obj;
  const out = { ...obj } as Loose;
  for (const k of keys) delete out[k];
  return out as T;
}

function calmMember(m: StaffMember): StaffMember {
  const out = strip(m, OLD_STAFF);
  const c = out.career as (typeof out.career & Loose) | undefined;
  return c && ('askAfter' in c || 'miss' in c) ? { ...out, career: strip(c, ['askAfter', 'miss']) } : out;
}

function calmPlan(plan: DayPlan): DayPlan {
  let out = strip(plan, ['sick']);
  if (out.event && !EVENT_KINDS.has(out.event.kind)) {
    out = { ...out };
    delete out.event;
  }
  return out;
}

/** Магазин (весь state или срез Заречья): полки, персонал, план дня, охрана. */
function calmShop<S extends ShopSlice>(shop: S): S {
  const out: ShopSlice = { ...shop };
  if (out.shelves) out.shelves = out.shelves.map((s) => strip(s, ['broken']));
  if (out.storedShelves) out.storedShelves = out.storedShelves.map((s) => strip(s, ['broken']));
  if (out.staff) out.staff = out.staff.map(calmMember);
  if (out.plan) out.plan = calmPlan(out.plan);
  // От охраны остаётся только Бобик.
  if (out.security) {
    if (out.security.dog) out.security = { dog: out.security.dog };
    else delete out.security;
  }
  return out as S;
}

/** Старое сохранение → без убранных механик. Новое сохранение проходит без изменений (по содержимому). */
export function migrateCalm(state: StoreState): StoreState {
  let s = calmShop(strip(state, OLD_STATE));
  // Утреннее предложение повысить (не филиал) — теперь повышение в «Учить».
  const offer = s.career?.offer as { to?: string } | undefined;
  if (offer && offer.to !== 'branch') {
    const career = { ...s.career };
    delete career.offer;
    s = { ...s, career };
  }
  const ceremony = s.career?.ceremony;
  if (ceremony && 'miss' in ceremony) s = { ...s, career: { ...s.career, ceremony: strip(ceremony, ['miss']) } };
  if (s.zar?.away) s = { ...s, zar: { ...s.zar, away: calmShop(strip(s.zar.away, OLD_STATE)) } };
  return s;
}
