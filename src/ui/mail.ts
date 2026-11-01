// «Почта» — одна карточка утра со всем, что игрок просто забирает: сундучок выручки, письмо, сосед
// за отложенным, бабушкин гостинец (серия дней), угощения и подарки друзей, «спасибо» за визиты,
// новости конкурентов, награды лиги, гильдии, торговой недели, «Чёрной пятницы», пропуска и открытка
// праздника. Одна кнопка «Забрать всё» — короткий список «что пришло» (значок и сумма), письма и
// новости читаются касанием. Награды и поля сохранения — те же, что у прежних карточек и окон.
//
// Каждый источник — маленький переходник в SOURCES: убрать механику — убрать её строку отсюда, и всё.
// Решения (что выбрать, куда пойти) почта не принимает: такое остаётся своей карточкой.

import { t, type TextKey } from '../i18n';
import type { StoreState } from '../game/economy';
import { openChest } from '../game/returns';
import { GIFT_DAYS } from '../game/gift';
import { PRODUCTS } from '../game/economy';
import { claimLeague, leagueReward, openPresents } from '../game/social';
import { homeLevel } from '../game/zarshop';
import { rushPrize } from '../game/rush';
import { claimPass, passCoins, passLevel } from '../game/pass';
import { activeEvent, cardWaiting, openCard } from '../game/live';
import { claimGifts, duelInfo, duelReward, guildInfo, guildReward, visitsInfo, weekendInfo } from '../platform/multiplayer';
import { leagueInfo } from '../platform/league';
import { openPresentsBox, presentsInfo } from '../platform/presents';
import { liveEvents, todayLocal } from '../platform/live';
import { flushSoon, track } from '../platform/analytics';
import { png } from '../platform/assets';
import { liteMode } from '../platform/quality';
import { sound } from '../platform/sound';
import { music } from '../platform/music';
import { haptic } from '../platform/telegram';
import { markTaken, mailBag, type MailBag } from './mailbag';
import { burst, letterFrom, regularName, returnStyles, showLetter } from './returns';
import { showOpened } from './presents';
import { showLiveCard } from './live';
import { button, el, rollNumber, toast, UI_FONT } from './dom';

/** Записать состояние без перерисовки утра: карточка доигрывает своё и перерисует сама. */
type Update = (next: StoreState) => void;

/** Что нужно строкам почты: состояние, почта сцены, как обновить. */
interface MailCtx {
  state: StoreState;
  getState: () => StoreState;
  update: Update;
  bag: MailBag | null;
}

/** Строка почты: что пришло, сколько монет, прочитать (письмо, новость) и забрать. */
interface MailEntry {
  id: string;
  icon: string;
  text: string;
  /** Монеты: уже в кассе (письмо, гостинец) или придут по «Забрать всё». */
  coins?: number;
  read?: () => void;
  /** Забрать: false — не вышло (нет связи), строка останется. Нет take — уже в кассе, только отметить. */
  take?: () => boolean | Promise<boolean>;
  /** Забрать можно только по нажатию (ходит на сервер): при «Открыть магазин» само не забирается. */
  online?: boolean;
}

type Source = (c: MailCtx) => MailEntry | null;

// ---------- Источники ----------

/** Сундучок выручки (returns.ts): торговля кассира без хозяина и доход филиала. */
const chestSource: Source = ({ state, getState, update }) => {
  const chest = state.ret?.chest;
  if (!chest) return null;
  return {
    id: 'chest',
    icon: '🧰',
    text: t('mail.chest', { h: Math.max(1, Math.floor(chest.hours)) }),
    coins: chest.sum,
    take: () => {
      const opened = openChest(getState());
      if (!opened) return false;
      update(opened.state);
      track('ret_chest', opened.state.day, opened.chest.sum);
      return true;
    },
  };
};

/** Письмо (returns.ts): вложенное бабушкой уже в кассе, прочитать — касанием. */
const letterSource: Source = ({ bag, getState }) => {
  const gift = bag?.letter;
  if (!gift) return null;
  return { id: 'letter', icon: '✉️', text: t('mail.letter', { name: letterFrom(gift).name }), coins: gift.money, read: () => showLetter(gift, getState()) };
};

/** Сосед за отложенным заказом: забрал и заплатил (деньги в кассе) или зайдёт к закрытию. */
const orderSource: Source = ({ bag }) => {
  const res = bag?.order;
  if (!res) return null;
  const params = { name: regularName(res.order.who), qty: res.order.qty, icon: PRODUCTS[res.order.pid].icon };
  return { id: 'order', icon: PRODUCTS[res.order.pid].icon, text: t(res.paid ? 'mail.order.paid' : 'mail.order.wait', params), coins: res.paid || undefined };
};

/** Бабушкин гостинец за ежедневный вход (gift.ts): деньги и товар уже в кассе и на полках. */
const giftSource: Source = ({ bag }) => {
  const g = bag?.gift?.gift;
  if (!g) return null;
  const extra = [g.goods ? `+${g.goods.qty} ${PRODUCTS[g.goods.id].icon}` : '', g.rating ? `+${g.rating}★` : ''].filter(Boolean).join(' ');
  return { id: 'gift', icon: '🎁', text: `${t('mail.gift', { n: g.day })}${extra ? ` · ${extra}` : ''}`, coins: g.money };
};

/** Друзья угостили кофе в гостях (multiplayer.ts): монеты — с сервера. */
const treatsSource: Source = ({ getState, update }) => {
  const gifts = visitsInfo()?.gifts ?? [];
  if (!gifts.length) return null;
  return {
    id: 'treats',
    icon: '☕',
    text: t('mail.treats', { names: [...new Set(gifts.map((g) => g.name))].slice(0, 3).join(', ') }),
    coins: gifts.reduce((sum, g) => sum + g.amount, 0),
    online: true,
    take: async () => {
      const n = await claimGifts();
      if (n) update({ ...getState(), money: getState().money + n });
      return true;
    },
  };
};

/** Подарки друзей и «спасибо» за мои (presents.ts): открыть — с сервера; что оставили — прочитать. */
let opened: { day: number; res: NonNullable<Awaited<ReturnType<typeof openPresentsBox>>>; got: ReturnType<typeof openPresents>; level: number } | null = null;
const presentsSource: Source = ({ getState, update }) => {
  const info = presentsInfo();
  if (!info || (!info.waiting && !info.thanks)) return null;
  return {
    id: 'presents',
    icon: '💝',
    text: info.waiting ? t('mail.presents', { n: info.waiting }) : t('mail.presentsThanks', { n: info.thanks }),
    online: true,
    take: async () => {
      const res = await openPresentsBox();
      if (!res) return false;
      const got = openPresents(getState(), res.presents, res.thanks.length);
      track('present_open', getState().day, res.presents.length);
      update(got.state);
      if (res.presents.length || res.thanks.length) opened = { day: getState().day, res, got, level: getState().level };
      return true;
    },
  };
};

/** Друзья сказали «спасибо» за визит (rivals.ts): монеты уже в кассе. */
const thanksSource: Source = ({ bag }) => {
  const thanks = bag?.thanks;
  if (!thanks) return null;
  return { id: 'thanks', icon: '🙏', text: t('mail.thanks', { names: thanks.names.join(', ') }), coins: thanks.n };
};

/** Что натворили конкуренты (rivals.ts): прочитать — окно с ответом. */
const rivalSource: Source = ({ bag }) => {
  const rival = bag?.rival;
  if (!rival) return null;
  return { id: 'rival', icon: '📰', text: t('mail.rival'), read: rival.read };
};

/** Итог недели в лиге района (social.ts): награда, кубок за тройку. */
const leagueSource: Source = ({ state, getState, update }) => {
  const last = leagueInfo()?.last;
  if (!last || (state.leagueClaimed !== undefined && state.leagueClaimed >= last.week)) return null;
  return {
    id: 'league',
    icon: '🏆',
    text: t('mail.league', { place: last.place, size: last.size }),
    coins: last.score > 0 ? leagueReward(homeLevel(state), last.place, last.tier) : undefined,
    take: () => {
      const got = claimLeague(getState(), last);
      if (!got) return false;
      track('league_claim', getState().day, last.place);
      update(got.state);
      if (got.cup) toast('assets/ico_trophy.png', t('league.cupTitle'), t('league.cup', { place: last.place }), true);
      return true;
    },
  };
};

/** Гильдия выполнила цель прошлой недели. */
const guildSource: Source = ({ state, getState, update }) => {
  const g = guildInfo();
  if (!g?.last?.reached || state.guildClaimed === g.last.week) return null;
  const week = g.last.week;
  const reward = guildReward(homeLevel(state));
  return {
    id: 'guild',
    icon: '🤝',
    text: t('mail.guild', { name: g.name }),
    coins: reward,
    take: () => {
      if (getState().guildClaimed === week) return false;
      update({ ...getState(), money: getState().money + reward, guildClaimed: week });
      return true;
    },
  };
};

/** Торговая неделя с другом закончилась: награда победителю (и утешительная). */
const duelSource: Source = ({ state, getState, update }) => {
  const last = duelInfo()?.last;
  if (!last || state.duelClaimed === last.week) return null;
  const reward = duelReward(homeLevel(state), last.won);
  return {
    id: 'duel',
    icon: '⚔️',
    text: t(last.won ? 'mail.duel.won' : 'mail.duel.lost', { name: last.name }),
    coins: reward,
    take: () => {
      if (getState().duelClaimed === last.week) return false;
      update({ ...getState(), money: getState().money + reward, duelClaimed: last.week });
      return true;
    },
  };
};

/** «Чёрная пятница района» прошла: приз за место. */
const rushSource: Source = ({ state, getState, update }) => {
  const last = weekendInfo()?.last;
  if (!last || state.rushClaimed === last.week) return null;
  const prize = rushPrize(state.level, last.rank, last.players);
  return {
    id: 'rush',
    icon: '🛍',
    text: t('mail.rush', { rank: last.rank, players: last.players }),
    coins: prize,
    take: () => {
      if (getState().rushClaimed === last.week) return false;
      update({ ...getState(), money: getState().money + prize, rushClaimed: last.week });
      return true;
    },
  };
};

/** Сезонный пропуск: все открытые награды обеих дорожек (премиальная — если куплен). */
const passSource: Source = ({ state, getState, update }) => {
  const pass = state.pass;
  if (!pass) return null;
  const ready: [number, 'free' | 'premium'][] = [];
  for (let l = 1; l <= passLevel(pass); l++) {
    if (!pass.free.includes(l)) ready.push([l, 'free']);
    if (pass.paid && !pass.premium.includes(l)) ready.push([l, 'premium']);
  }
  if (!ready.length) return null;
  return {
    id: 'pass',
    icon: '🎫',
    text: t('mail.pass', { n: ready.length }),
    coins: ready.reduce((sum, [l, track]) => sum + passCoins(state, l) * (track === 'premium' ? 2 : 1), 0),
    take: () => {
      let s = getState();
      for (const [l, track] of ready) s = claimPass(s, l, track) ?? s;
      update(s);
      return true;
    },
  };
};

/** Праздник по календарю (live.ts): открытка дня — монеты сразу, саму открытку — посмотреть касанием. */
let liveOpened: { day: number; theme: Parameters<typeof showLiveCard>[0]; gift: Parameters<typeof showLiveCard>[1] } | null = null;
const adventSource: Source = ({ state, getState, update }) => {
  const today = todayLocal();
  const e = activeEvent(liveEvents(), today);
  if (!e || !cardWaiting(state, e, today)) return null;
  return {
    id: 'advent',
    icon: '📅',
    text: t('mail.advent'),
    take: () => {
      const got = openCard(getState(), e, today);
      if (!got) return false;
      track('live_card', getState().day, got.gift.n);
      update(got.state);
      liveOpened = { day: getState().day, theme: e.theme, gift: got.gift };
      return true;
    },
  };
};

/**
 * Все источники почты по порядку строк. Убрать механику — убрать строку (nx-social2 убирает торговую
 * неделю и гильдию и сводит подарки в один вид: duelSource, guildSource, treatsSource/presentsSource).
 */
const SOURCES: Source[] = [chestSource, giftSource, letterSource, orderSource, treatsSource, presentsSource, thanksSource, rivalSource, leagueSource, guildSource, duelSource, rushSource, passSource, adventSource];

// ---------- Карточка ----------

const css = `
.ui-mail { display: flex; flex-direction: column; gap: 6px; }
.ui-mail-head { display: flex; align-items: center; gap: 8px; }
.ui-mail-head b { flex: 1; }
.ui-mail-chest { width: 44px; height: 40px; position: relative; display: grid; place-items: center; flex: none; }
.ui-mail-chest img { width: 40px; image-rendering: pixelated; }
.ui-mail-chest.wait img { animation: ui-ret-hop 1.1s ease-in-out infinite; }
.ui-mail-chest .ui-ret-coin { width: 12px; height: 12px; margin: -6px 0 0 -6px; }
.ui-mail-rows { display: flex; flex-direction: column; gap: 3px; }
.ui-mail-row { display: flex; align-items: center; gap: 6px; font: 600 13px/1.3 ${UI_FONT}; color: #3a2f40; min-height: 26px; }
.ui-mail-row .ico { width: 22px; text-align: center; flex: none; }
.ui-mail-row .txt { flex: 1; min-width: 0; }
.ui-mail-row .sum { font-weight: 800; color: #3e8948; white-space: nowrap; }
.ui-mail-row.done { color: #8b7a8e; }
.ui-mail-row.done .sum { color: #8b7a8e; }
.ui-mail-row .ui-chip { padding: 2px 8px; min-height: 24px; }
.ui-mail-total { font: 800 16px/1.2 ${UI_FONT}; color: #3e8948; text-align: center; min-height: 20px; }
.ui-mail-total.got { animation: ui-ret-pop .35s cubic-bezier(.3, 1.6, .5, 1); }
.ui-mail-gran { display: flex; gap: 6px; align-items: center; font: italic 600 12px/1.3 ${UI_FONT}; color: #5a4a5e; }
.ui-mail-gran img { width: 28px; height: 28px; image-rendering: pixelated; border-radius: 6px; flex: none; }
.ui-mail-days { display: grid; grid-template-columns: repeat(${GIFT_DAYS}, 1fr); gap: 3px; }
.ui-mail-days i { font-style: normal; text-align: center; font: 700 10px/16px ${UI_FONT}; border: 2px solid #2b2233; border-radius: 5px; background: #fff; }
.ui-mail-days i.done { background: #e3f5d6; color: #3e8948; }
.ui-mail-days i.today { background: #fee761; }
.ui-mail-empty { font: 600 12px/1.3 ${UI_FONT}; color: #8b7a8e; }
.ui-infos-more summary { cursor: pointer; list-style: none; font: 700 12px/1.6 ${UI_FONT}; }
.ui-infos-more summary::-webkit-details-marker { display: none; }
.ui-infos-more summary::before { content: '▸ '; }
.ui-infos-more[open] summary::before { content: '▾ '; }
.ui-mail-sum { font: 800 14px ${UI_FONT}; color: #3e8948; }
.ui-mail-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.ui-mail-chips .ui-chip { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ui-calm .ui-mail-chest.wait img, .ui-calm .ui-mail-total.got { animation: none; }
@media (prefers-reduced-motion: reduce) { .ui-mail-chest.wait img, .ui-mail-total.got { animation: none; } }
`;

let styled = false;
function styles(): void {
  returnStyles();
  if (styled) return;
  styled = true;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
}

/** Что пришло этим утром: строки почты (забранные — с отметкой). */
function entries(c: MailCtx): MailEntry[] {
  const out: MailEntry[] = [];
  for (const source of SOURCES) {
    const entry = source(c);
    if (entry) out.push(entry);
  }
  return out;
}

/** Строки, которые забираются прямо сейчас (ждём сервер): их не забрать второй раз ни кнопкой, ни «Открыть магазин». */
const claiming = new Set<string>();
const isTaken = (bag: MailBag | null, id: string) => Boolean(bag?.taken.includes(id)) || claiming.has(id);
/** Идёт «Забрать всё» (ждём сервер). */
export const mailBusy = (): boolean => claiming.size > 0;

/** Сколько всего в почте, что ещё не забрано (для аналитики и для «Открыть магазин»). */
export function mailWaiting(state: StoreState, getState: () => StoreState, update: Update): number {
  const bag = mailBag(state.day);
  return entries({ state, getState, update, bag }).filter((e) => !isTaken(bag, e.id)).length;
}

/**
 * Забрать всё, что не требует сети, — при «Открыть магазин», если почту не открыли. Сундучок, лига,
 * пропуск — в кассу; угощения и подарки друзей лежат на сервере и подождут следующего утра.
 */
export function takeQuietly(getState: () => StoreState, update: Update): void {
  const state = getState();
  const bag = mailBag(state.day);
  const list = entries({ state, getState, update, bag }).filter((e) => !isTaken(bag, e.id) && !e.online);
  for (const e of list) e.take?.();
  if (list.length) markTaken(state.day, list.map((e) => e.id), list.reduce((sum, e) => sum + (e.coins ?? 0), 0));
}

/**
 * Карточка «Почта» над вкладками утра. render — перерисовать утро после «Забрать всё».
 * Пусто и ничего не приходило — короткая строка о завтрашнем (карточка не пропадает: утром есть куда смотреть).
 */
export function mailBox(state: StoreState, getState: () => StoreState, update: Update, render: () => void): HTMLElement[] {
  styles();
  const bag = mailBag(state.day);
  const list = entries({ state, getState, update, bag });
  const waiting = list.filter((e) => !isTaken(bag, e.id));
  const calm = liteMode() || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const box = el('div', 'ui-box ui-mail');
  box.dataset.mail = waiting.length ? 'full' : list.length ? 'taken' : 'empty';
  const head = el('div', 'ui-mail-head');
  // Сундучок — картинкой в углу: подпрыгивает, пока не забрали; при «Забрать всё» — крышка и монеты.
  const chest = waiting.find((e) => e.id === 'chest') ? el('div', 'ui-mail-chest wait') : null;
  let chestImg: HTMLImageElement | null = null;
  if (chest) {
    chestImg = el('img');
    chestImg.src = png('chest_closed');
    chestImg.alt = '';
    chest.append(chestImg);
    head.append(chest);
  }
  head.append(el('b', '', `${waiting.length ? '📬' : '📭'} ${t('mail.title')}`));
  box.append(head);

  // Бабушкин гостинец: серия дней коробочками и её строчка — как в прежнем окне, только маленько.
  const gift = bag?.gift;
  if (gift) {
    const days = el('div', 'ui-mail-days');
    for (let d = 1; d <= GIFT_DAYS; d++) days.append(el('i', d < gift.gift.day ? 'done' : d === gift.gift.day ? 'today' : '', d < gift.gift.day ? '✓' : d === gift.gift.day ? '🎁' : String(d)));
    const gran = el('div', 'ui-mail-gran');
    const face = el('img');
    face.src = png('portrait_grandma_happy');
    face.alt = '';
    gran.append(face, el('span', '', `«${t(gift.gift.day === GIFT_DAYS ? 'gift.textBig' : 'gift.text', { n: gift.gift.day, total: GIFT_DAYS })}»`));
    box.append(days, gran);
  }

  // Всё забрано — коротко: сколько пришло, значки пришедшего, письма и новости — прочитать.
  if (!waiting.length && (list.length || bag?.taken.length)) {
    head.append(el('span', 'ui-mail-sum', bag?.got ? `+${bag.got} 💰` : ''));
    const line = el('div', 'ui-mail-row done');
    line.append(el('span', 'ico', '✓'), el('span', 'txt', `${t('mail.taken')} ${list.map((e) => e.icon).join(' ')}`));
    box.append(line);
    const chips = el('div', 'ui-mail-chips');
    for (const e of list) if (e.read) chips.append(button(`📖 ${e.text}`, () => e.read!(), 'ui-chip'));
    if (opened?.day === state.day && bag?.taken.includes('presents')) {
      const o = opened;
      chips.append(button(`📖 ${t('mail.readPresents')}`, () => showOpened(o.res.presents, o.res.thanks, o.got, o.level), 'ui-chip'));
    }
    if (liveOpened?.day === state.day && bag?.taken.includes('advent')) {
      const l = liveOpened;
      chips.append(button(`📖 ${t('mail.readCard')}`, () => showLiveCard(l.theme, l.gift), 'ui-chip'));
    }
    if (chips.childElementCount) box.append(chips);
    const tm = gift?.tomorrow;
    if (tm) box.append(el('div', 'ui-mail-empty', tm.day === 1 ? t('gift.restart', { treat: t(`gift.treat.${tm.day}` as TextKey) }) : t('gift.tomorrow', { n: tm.day, treat: t(`gift.treat.${tm.day}` as TextKey) })));
    return [box];
  }

  const rows = el('div', 'ui-mail-rows');
  for (const e of list) {
    const done = isTaken(bag, e.id);
    const row = el('div', `ui-mail-row${done ? ' done' : ''}`);
    row.dataset.id = e.id;
    row.append(el('span', 'ico', e.icon), el('span', 'txt', e.text));
    if (e.coins) row.append(el('span', 'sum', `+${e.coins} 💰`));
    if (e.read) row.append(button(`📖 ${t('mail.read')}`, () => e.read!(), 'ui-chip'));
    rows.append(row);
  }
  if (list.length) box.append(rows);
  else {
    // Ничего не пришло: строка о том, что завтра (гостинец уже взят вчера — серия ждёт).
    box.append(el('div', 'ui-mail-empty', t('mail.empty')));
    return [box];
  }
  const coins = waiting.reduce((sum, e) => sum + (e.coins ?? 0), 0);
  const total = el('div', 'ui-mail-total', coins ? t('mail.total', { n: coins }) : '');
  const take = button(t('mail.takeAll'), () => {
    if (take.disabled || mailBusy()) return;
    take.disabled = true;
    const day = getState().day;
    const got: string[] = [];
    const coinsOf = (ids: string[]) => waiting.filter((e) => ids.includes(e.id)).reduce((sum, e) => sum + (e.coins ?? 0), 0);
    const tryTake = (ok: boolean | undefined, e: MailEntry) => {
      if (ok !== false) got.push(e.id);
    };
    // Сначала всё, что без сервера, — сразу и отмечено: перерисовка или «Открыть магазин» его уже не возьмут.
    for (const e of waiting.filter((x) => !x.online)) {
      try {
        tryTake(e.take ? (e.take() as boolean) : true, e);
      } catch {
        /* строка останется в почте */
      }
    }
    markTaken(day, got, coinsOf(got));
    // Потом — с сервера (угощения, подарки друзей): пока ждём, строки «забираются» и второй раз не берутся.
    const online = waiting.filter((x) => x.online);
    for (const e of online) claiming.add(e.id);
    void (async () => {
      for (const e of online) {
        try {
          tryTake(await e.take?.(), e);
        } catch {
          /* нет связи — заберём завтра */
        }
        claiming.delete(e.id);
      }
      const late = got.filter((id) => online.some((e) => e.id === id));
      if (late.length) markTaken(day, late, coinsOf(late));
      track('mail_claim', day, got.length);
      flushSoon();
      // Утро уже закрыли (открыли магазин) — праздновать и перерисовывать некому.
      if (!box.isConnected) return;
      // Тёплое: крышка сундучка, монеты брызгами, сумма докручивается.
      if (chest && chestImg && got.includes('chest')) {
        chest.classList.remove('wait');
        chestImg.src = png('chest_open');
        burst(chest, calm);
      }
      if (!music.sting('coin')) sound.coin();
      haptic.success();
      const after = () => window.setTimeout(() => box.isConnected && render(), calm ? 0 : 700);
      if (coins) {
        rollNumber(total, 0, coins, calm ? 0 : 600, (n) => t('mail.total', { n }), () => {
          total.classList.add('got');
          after();
        });
      } else after();
    })();
  });
  if (mailBusy()) take.disabled = true;
  box.append(total, take);
  return [box];
}
