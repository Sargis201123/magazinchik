// Сумка почты на утро: что принесла сцена, пока игрок был далеко, — письмо, сосед за отложенным заказом,
// бабушкин гостинец, «спасибо» и новости от конкурентов. Сцена кладёт (morningFlow.ts, rivals.ts),
// карточка «Почта» в утреннем окне показывает (ui/mail.ts). Остальное в почте — из сохранения и с
// сервера (сундучок, лига, пропуск…): его карточка собирает сама.
//
// Файл маленький и без окон: его тянет сцена, а сама карточка — в отдельном куске сборки утра.

import type { Gift, GiftPreview } from '../game/gift';
import type { LetterGift, OrderResult } from '../game/returns';
import type { RivalNews } from '../game/rival';

export interface MailBag {
  /** Игровой день утра. */
  day: number;
  letter?: LetterGift;
  /** Сосед пришёл за отложенным: забрал и заплатил или зайдёт к закрытию. */
  order?: OrderResult;
  /** Гостинец за ежедневный вход (уже в кассе — карточка о нём рассказывает) и что будет завтра. */
  gift?: { gift: Gift; tomorrow: GiftPreview | null };
  /** Друзья сказали «спасибо» за наш визит: монеты уже в кассе. */
  thanks?: { names: string[]; n: number };
  /** Что натворили конкуренты: прочитать — окно с ответом (ui/rival.ts). */
  rival?: { news: RivalNews; read: () => void };
  /** Что уже забрали этим утром (ид строк почты). */
  taken: string[];
}

/** Почта пополнилась (пришла новость конкурента) — карточку перерисовать. */
export const MAIL_EVENT = 'magazinchik:mail';

let bag: MailBag | null = null;

/** Почта этого утра (другого дня — нет). */
export const mailBag = (day: number): MailBag | null => (bag?.day === day ? bag : null);

/** Положить в почту утра day. */
export function postMail(day: number, patch: Partial<Omit<MailBag, 'day' | 'taken'>>): void {
  const cur = mailBag(day) ?? { day, taken: [] };
  // Пришло новое того же вида (вторая пачка «спасибо») — строка снова не забрана.
  const fresh = Object.keys(patch);
  bag = { ...cur, ...patch, taken: cur.taken.filter((id) => !fresh.includes(id)) };
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(MAIL_EVENT));
}

/** Отметить строки забранными. */
export function markTaken(day: number, ids: string[]): void {
  const cur = mailBag(day);
  if (cur) bag = { ...cur, taken: [...new Set([...cur.taken, ...ids])] };
}
