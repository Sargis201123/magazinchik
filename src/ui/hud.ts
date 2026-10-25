import { t, type TextKey } from '../i18n';
import { onShelves, PRODUCTS, sellableProducts, warehouseCapacity, warehouseCount, type DayStats, type StoreState } from '../game/economy';
import { button, curtain, el, injectStyles, openModal, pixelize, replay, rollNumber } from './dom';
import type { Review } from '../game/reviews';
import { reviewCards } from './reviews';
import { liveFace } from './dialog';
import type { LossAdvice } from '../game/losses';
import { RECORD_ICONS, type RecordId } from '../game/records';
import { liteMode } from '../platform/quality';
import { png } from '../platform/assets';
import { sound } from '../platform/sound';
import { haptic } from '../platform/telegram';
import { injectAudioStyles, muteIcon, toggleMute } from './audio';

/** Сколько штук на полках считается «мало» и сколько таких товаров показывать в панели. */
const LOW_ON_SHELF = 3;
const LOW_SHOWN = 6;

/**
 * Итоги дня по времени (мс от открытия): первая плитка выскакивает в TILE_AT, следующие — через TILE_STEP,
 * число в плитке начинает крутиться через ROLL_DELAY и крутится ROLL_MS.
 */
const TILE_AT = 220;
const TILE_STEP = 110;
const ROLL_DELAY = 120;
const ROLL_MS = 900;
/** Печати: первая — когда числа почти докрутились (без докрутки — сразу за плитками), удар — на 60% её анимации. */
const STAMP_AT = 1250;
const CALM_STAMP_AT = 600;
const STAMP_STEP = 420;
const STAMP_HIT = 270;
const STAMP_SPARKS = 10;
/** Наклон печатей по очереди — шлёпнуты от руки, не по линейке. */
const STAMP_TILT = [-10, -5, -8, -4];
/** Лучший день недели загорается, когда столбики выросли. */
const GOLD_AT = 950;
/** Сколько места в столбце графика занимают подписи: сумма сверху и день снизу. */
const CHART_LABELS = 28;
/** Значение длиннее стольких знаков в «Подробнее» — уже своей строкой под названием (на 320 px в строку влезает ~14). */
const SUM_INLINE = 14;
/** Звезда рейтинга и зазор между звёздами — как в CSS .ui-stars. */
const STAR_W = 14;
const STAR_GAP = 1;

/** Что «шлёпается» печатью в итогах дня: новое звание и побитые рекорды. */
export type SummaryStamp = { kind: 'rank'; name: string } | { kind: 'record'; id: RecordId };

/** Цвета причин ухода — те же, что в полоске. */
const LOSS_COLORS = { queue: '#f77622', empty: '#8b9bb4', expensive: '#e43b44', eduard: '#68386c' } as const;

/** «Куда ушли покупатели»: полоска купили/ушли по причинам и совет к каждой причине. */
function lossBox(served: number, losses: LossAdvice[]): HTMLElement {
  const box = el('div', 'ui-box');
  box.append(el('b', '', t('loss.title')));
  const total = served + losses.reduce((sum, l) => sum + l.count, 0);
  const bar = el('div', 'ui-loss-bar');
  const part = (n: number, color: string) => {
    const seg = el('div');
    seg.style.flex = String(n);
    seg.style.background = color;
    bar.append(seg);
  };
  part(served, '#63c74d');
  for (const l of losses) part(l.count, LOSS_COLORS[l.reason]);
  box.append(bar, el('div', 'ui-muted', `🟩 ${t('loss.bought')}: ${served} / ${total}`));
  for (const l of losses) {
    const row = el('div', 'ui-loss-row');
    const dot = el('span', 'ui-loss-dot');
    dot.style.background = LOSS_COLORS[l.reason];
    const text = el('div');
    text.append(el('b', '', `${t(`loss.r.${l.reason}` as TextKey)} — ${l.count}`), el('div', 'ui-item-sub', t(l.key, l.params)));
    row.append(dot, text);
    box.append(row);
  }
  return box;
}

export class Hud {
  private readonly top = el('div', 'ui-hud');
  private readonly stock = el('div', 'ui-stock');
  private readonly hint = el('div', 'ui-hint');
  /** Ускорение дня ×2 — когда магазин работает сам. */
  private readonly speed = el('button', 'ui-speed');
  onSpeed: () => void = () => {};
  /** Срочный подвоз: кнопка над ускорением. */
  private readonly urgent = el('button', 'ui-speed ui-urgent', '🚚');
  onUrgent: () => void = () => {};
  /** «Позвать на помощь» в час пик (game/help.ts): над срочным подвозом, пока очередь длинная. */
  private readonly help = el('button', 'ui-speed ui-help');
  onHelp: () => void = () => {};
  /** Быстрое «без звука» — напротив ускорения, видно всегда, пока идёт игра. */
  private readonly mute = el('button', 'ui-speed ui-mute');
  private day = 1;
  private readonly money = el('span');
  private readonly moneyText = document.createTextNode('');
  private readonly clock = el('span');
  private readonly stars = el('span');
  /** Сколько денег сейчас показано — число «докручивается» до настоящего. */
  private shownMoney: number | null = null;
  private targetMoney = 0;
  private stopRoll = () => {};

  constructor() {
    injectStyles();
    const coin = el('img', 'ui-ico');
    coin.src = png('coin');
    coin.alt = '💰';
    this.money.append(coin, this.moneyText);
    this.top.append(this.money, this.clock, this.stars);
    this.speed.addEventListener('click', () => this.onSpeed());
    this.speed.style.display = 'none';
    this.urgent.addEventListener('click', () => this.onUrgent());
    this.urgent.style.display = 'none';
    this.help.addEventListener('click', () => this.onHelp());
    this.help.style.display = 'none';
    injectAudioStyles();
    this.mute.title = t('audio.mute');
    this.mute.addEventListener('click', () => {
      toggleMute(this.day);
      this.showMute();
    });
    this.showMute();
    document.body.append(this.top, this.stock, this.hint, this.speed, this.urgent, this.help, this.mute);
  }

  /** Значок звука — как сейчас (его могли переключить и в профиле). */
  private showMute(): void {
    const icon = muteIcon();
    if (this.mute.dataset.icon === icon) return;
    this.mute.dataset.icon = icon;
    this.mute.textContent = icon;
    pixelize(this.mute);
  }

  update(state: StoreState, secondsLeft: number, quests = '', night = false): void {
    this.day = state.day;
    this.showMute();
    this.setMoney(state.money);
    const clock = `${night ? t('hud.night') : t('hud.day', { n: state.day })} · ${Math.floor(secondsLeft / 60)}:${String(Math.floor(secondsLeft % 60)).padStart(2, '0')}`;
    if (this.clock.textContent !== clock) this.clock.textContent = clock;
    const stars = '★'.repeat(Math.round(state.rating)).padEnd(5, '☆');
    if (this.stars.textContent !== stars) {
      // Звезда прибавилась — строка звёзд вспыхивает.
      const count = (text: string) => [...text].filter((c) => c === '★').length;
      const up = this.stars.textContent !== '' && count(stars) > count(this.stars.textContent);
      this.stars.textContent = stars;
      if (up) {
        this.stars.classList.remove('ui-shine');
        void this.stars.offsetWidth;
        this.stars.classList.add('ui-shine');
      }
    }
    // Только то, что на полках кончается: пусто — красным, мало — жёлтым. Остальное — в закупке.
    const low = sellableProducts(state)
      .map((id) => ({ id, n: onShelves(state, id) }))
      .filter((p) => p.n <= LOW_ON_SHELF)
      .sort((a, b) => a.n - b.n);
    const shown = low.slice(0, LOW_SHOWN);
    const key = `${shown.map((p) => `${p.id}${p.n}`).join()}|${low.length}|${warehouseCount(state)}/${warehouseCapacity(state)}|${quests}`;
    // Перерисовываем только когда что-то изменилось: update зовётся каждый кадр.
    if (key === this.lastStock) return;
    this.lastStock = key;
    const parts: HTMLElement[] = [el('span', 'ui-stock-wh', `📦 ${warehouseCount(state)}/${warehouseCapacity(state)}`)];
    for (const p of shown) parts.push(el('span', p.n === 0 ? 'ui-stock-out' : 'ui-stock-low', `${PRODUCTS[p.id].icon}${p.n}`));
    if (low.length > shown.length) parts.push(el('span', 'ui-stock-low', `+${low.length - shown.length}`));
    if (quests) parts.push(el('span', 'ui-stock-wh', quests));
    this.stock.replaceChildren(...parts);
    pixelize(this.stock);
  }

  private lastStock = '';

  /** Деньги не прыгают, а быстро докручиваются, как барабан кассы. */
  private setMoney(value: number): void {
    if (this.shownMoney !== null && value === this.targetMoney) return;
    const from = this.shownMoney ?? value;
    this.targetMoney = value;
    this.stopRoll();
    if (from === value) {
      this.moneyText.nodeValue = this.moneyLabel(value);
      return;
    }
    this.money.classList.toggle('ui-money-up', value > from);
    this.money.classList.toggle('ui-money-down', value < from);
    const duration = Math.min(800, 250 + Math.abs(value - from) * 3);
    this.stopRoll = rollNumber(this.moneyText, from, value, duration, (n) => this.moneyLabel(n), () =>
      this.money.classList.remove('ui-money-up', 'ui-money-down'),
    );
  }

  /** Текст счётчика; запоминаем, что показано, — следующая докрутка начнётся отсюда. */
  private moneyLabel(value: number): string {
    this.shownMoney = value;
    return ` ${value}`;
  }

  /** Кнопка ускорения: видна только днём; ×1 или ×2. */
  showUrgent(visible: boolean): void {
    const display = visible ? '' : 'none';
    if (this.urgent.style.display !== display) {
      this.urgent.style.display = display;
      if (visible) pixelize(this.urgent);
    }
  }

  /** «Позвать на помощь»: видна в час пик; busy — ждём окно «Поделиться» (кнопка гаснет). */
  showHelp(visible: boolean, busy = false): void {
    const display = visible ? '' : 'none';
    if (this.help.style.display !== display) {
      this.help.style.display = display;
      if (visible && !this.help.childNodes.length) {
        this.help.textContent = t('help.button');
        pixelize(this.help);
      }
    }
    if (this.help.disabled !== busy) this.help.disabled = busy;
  }

  showSpeed(visible: boolean, speed: number): void {
    const text = speed > 1 ? '⏩ ×2' : '▶ ×1';
    if (this.speed.textContent !== text) this.speed.textContent = text;
    this.speed.style.display = visible ? '' : 'none';
    this.speed.classList.toggle('on', speed > 1);
  }

  /** Счётчик денег подпрыгивает, когда в него «долетели» монетки. */
  bumpMoney(): void {
    const money = this.top.firstElementChild;
    if (!money) return;
    money.classList.remove('ui-bump');
    void (money as HTMLElement).offsetWidth;
    money.classList.add('ui-bump');
  }

  /** Подсказка внизу; в первые дни — яркая плашка, чтобы новичок точно заметил. */
  setHint(text: string, tutorial = false): void {
    if (this.hint.textContent !== text) this.hint.textContent = text;
    this.hint.classList.toggle('ui-hint-tip', tutorial && text !== '');
    // На узком экране плашка почти во всю ширину — в дни обучения кнопка звука стоит выше неё
    // (и не прыгает, когда подсказка то появляется, то гаснет).
    this.mute.classList.toggle('ui-mute-up', tutorial);
  }

  showSummary(
    day: number,
    stats: DayStats,
    rating: { before: number; after: number },
    money: { bill: number | null; shortfall: number; total: number },
    extra: [string, string][],
    stamps: SummaryStamp[],
    history: number[],
    losses: LossAdvice[],
    reviews: Review[],
    onNext: () => void,
    onShare?: (button: HTMLButtonElement) => void,
  ): void {
    const { card, close } = openModal();
    card.classList.add('ui-sum');
    card.append(el('h2', '', t('summary.title', { n: day })));
    // Слабый телефон или «меньше движения» в системе: числа сразу итоговые, печати без искр.
    const calm = liteMode() || matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Главное — крупными плитками: выскакивают по очереди, числа в них докручиваются от нуля.
    const arrowRating = rating.after > rating.before ? '▲' : rating.after < rating.before ? '▼' : '';
    const records = stamps.flatMap((s) => (s.kind === 'record' ? [s.id] : []));
    const tiles = el('div', 'ui-tiles ui-sum-tiles');
    const tile = (icon: string | HTMLElement, value: number, label: string, tone = '', record = false, format: (n: number) => string = String) => {
      const at = TILE_AT + tiles.childElementCount * TILE_STEP;
      const box = el('div', `ui-tile ${tone}${record ? ' record' : ''}`);
      box.style.animationDelay = `${at}ms`;
      const num = el('span', 'ui-tile-num', format(calm ? value : 0));
      const b = el('b');
      b.append(icon, ' ', num);
      const caption = el('span', '', label);
      box.append(b, caption);
      tiles.append(box);
      if (!calm) setTimeout(() => rollNumber(num, 0, value, ROLL_MS, format), at + ROLL_DELAY);
      return { box, num, caption, at };
    };
    const recordTiles: Partial<Record<RecordId, ReturnType<typeof tile>>> = {
      revenue: tile('💰', stats.revenue, t('summary.revenue'), 'good', records.includes('revenue')),
      served: tile('🙂', stats.served, t('summary.served'), '', records.includes('served')),
    };
    tile('🚶', stats.lost, t('summary.lost'), stats.lost > stats.served / 3 ? 'bad' : '');
    // Рейтинг: золотые звёзды заполняются до дробной части, рядом докручивается число, ниже — на сколько изменился.
    const stars = starRow();
    const rate = tile(stars.box, Math.round(rating.after * 10), t('summary.rating'), arrowRating === '▼' ? 'bad' : arrowRating ? 'good' : '', false, (n) =>
      (n / 10).toFixed(1),
    );
    if (arrowRating) {
      const delta = Math.round(Math.abs(rating.after - rating.before) * 10) / 10;
      const sign = arrowRating === '▲' ? '+' : '−';
      rate.caption.append(' ', el('span', `ui-tile-delta ${arrowRating === '▲' ? 'up' : 'down'}`, delta ? `${arrowRating} ${sign}${delta.toFixed(1)}` : arrowRating));
    }
    if (calm) stars.fill(rating.after);
    else
      setTimeout(() => {
        stars.fill(rating.after);
        // Рейтинг вырос — звёзды вспыхивают, когда заполнились.
        if (arrowRating === '▲') setTimeout(() => replay(stars.box, 'ui-shine'), ROLL_MS);
      }, rate.at + ROLL_DELAY);
    card.append(tiles);
    // Реклама работала — сразу под плитками видно, окупилась ли она гостями.
    if (stats.adGuests) card.append(el('div', 'ui-muted ui-sum-ads', t('summary.ads', { n: stats.adGuests })));
    // Новое звание и побитые рекорды — не в «Подробнее», а печатью: звание золотой, рекорд красной.
    if (stamps.length) {
      const row = el('div', 'ui-stamps');
      const recordValue: Record<RecordId, number> = { revenue: stats.revenue, served: stats.served, combo: stats.bestCombo, money: money.total, days: day };
      stamps.forEach((s, i) => {
        const at = (calm ? CALM_STAMP_AT : STAMP_AT) + i * STAMP_STEP;
        const hit = at + STAMP_HIT;
        row.append(
          s.kind === 'rank'
            ? stamp('gold', t('summary.stampRank'), `🏅 ${s.name}`, t('summary.stampRankNote'), at, i, !calm)
            : stamp('red', t('summary.stampRecord'), `${recordValue[s.id]} ${RECORD_ICONS[s.id]}`, t(`records.${s.id}` as TextKey), at, i, !calm),
        );
        // Рекорд по выручке или покупателям: на его плитку в миг удара падает корона.
        const target = s.kind === 'record' ? recordTiles[s.id] : undefined;
        if (target) {
          const crown = el('img', 'ui-tile-crown');
          crown.src = png('ico_crown');
          crown.alt = '';
          crown.style.animationDelay = `${hit}ms`;
          target.box.append(crown);
        }
        setTimeout(() => {
          if (!card.isConnected) return;
          if (s.kind === 'rank') sound.medal();
          else sound.pop(i);
          haptic.tap();
          if (target && !calm) replay(target.num, 'ui-shine');
        }, hit);
      });
      card.append(row);
    }
    card.append(grannySays(day, stats, rating, history));
    // Карточка итогов для сторис или чата (platform/shareCard.ts).
    if (onShare) {
      const share: HTMLButtonElement = button(t('share.button'), () => onShare(share), 'ui-btn secondary');
      card.append(share);
    }
    // Выручка за последние 7 дней: сегодня — жёлтым.
    const week = history.slice(-7);
    if (week.length > 1) {
      const chart = el('div', 'ui-chart');
      const max = Math.max(...week, 1);
      // Лучший день недели (из равных — последний) загорается золотом, когда столбики выросли.
      const top = Math.max(...week);
      const best = top > 0 ? week.lastIndexOf(top) : -1;
      week.forEach((value, i) => {
        const col = el('div', 'ui-chart-col');
        const bar = el('div', `ui-chart-bar${i === week.length - 1 ? ' today' : ''}${i === best ? ' record' : ''}`);
        // Высота — от места под столбик (без подписей сверху и снизу): иначе высокие столбики сжимаются до одной высоты.
        bar.style.height = `calc((100% - ${CHART_LABELS}px) * ${(value / max).toFixed(3)})`;
        bar.style.animationDelay = i === best ? `${i * 70}ms, ${GOLD_AT}ms` : `${i * 70}ms`;
        const caption = el('span', 'ui-chart-value', String(value));
        if (i === best) {
          const crown = el('img', 'ui-chart-crown');
          crown.src = png('ico_crown');
          crown.alt = '';
          crown.style.animationDelay = `${GOLD_AT + 150}ms`;
          caption.append(crown);
        }
        col.append(caption, bar, el('span', 'ui-chart-day', String(day - week.length + 1 + i)));
        chart.append(col);
      });
      card.append(el('div', 'ui-muted', t('summary.week')), chart);
      requestAnimationFrame(() => drawChartLine(chart));
    }
    // Главное — плитки, бабушка, график и деньги; остальное — под «Подробнее».
    const more = el('details', 'ui-more');
    more.append(el('summary', '', t('summary.more')));
    // Короткое значение — справа в строке с названием; длинное (кафе, проверка, доставка) — своей строкой
    // под ним: в одну строку оно не влезало в узкий экран и налезало на название.
    const row = (label: string, value: string | number, target: HTMLElement = more) => {
      const text = String(value);
      const r = el('div', text.length > SUM_INLINE ? 'ui-sum-line' : 'ui-row');
      r.append(el('span', '', label), el('b', '', text));
      target.append(r);
    };
    row(t('summary.money'), `${money.total} 💰`, card);
    if (money.shortfall > 0) card.append(el('div', 'ui-note', t('summary.shortfall', { n: money.shortfall })));
    // Почему уходили покупатели — подсказка на завтра, её видно сразу.
    if (losses.length) card.append(lossBox(stats.served, losses));
    card.append(more);
    row(t('summary.complaints'), stats.complaints);
    row(t('summary.spoiled'), stats.spoiled);
    if (stats.nightRevenue) row(t('summary.night'), `+${stats.nightRevenue} 💰`);
    if (stats.stolen) row(t('summary.stolen'), `−${stats.stolen} 💰`);
    if (stats.caught) row(t('summary.caught'), stats.caught);
    if (stats.skimmed) row(t('summary.skimmed'), `−${stats.skimmed} 💰`);
    for (const [label, value] of extra) row(label, value);
    if (money.bill !== null) row(t('summary.bills'), `−${money.bill} 💰`);
    row(t('summary.rating'), `${rating.before.toFixed(1)} → ${rating.after.toFixed(1)}★ ${arrowRating}`);
    // Что написали посетители — сразу видно, что исправить завтра.
    if (reviews.length) more.append(el('h3', '', t('summary.reviews')), ...reviewCards(reviews));
    card.append(
      button(t('summary.next'), () => {
        // Роллет опускается с номером нового дня — и поднимается уже утром.
        curtain(t('hud.day', { n: day + 1 }), () => {
          close();
          onNext();
        });
      }),
    );
  }
}

/** Пять звёзд рейтинга: серые снизу, золотые поверх; fill заполняет до дробной части (4,3 — четыре и треть пятой). */
function starRow(): { box: HTMLElement; fill: (rating: number) => void } {
  const row = () =>
    Array.from({ length: 5 }, () => {
      const img = el('img');
      img.src = png('ico_star');
      img.alt = '';
      return img;
    });
  const box = el('span', 'ui-stars');
  const gold = el('span', 'ui-stars-fill');
  gold.style.width = '0px';
  gold.append(...row());
  box.append(...row(), gold);
  return {
    box,
    fill: (rating) => {
      const r = Math.min(5, Math.max(0, rating));
      const full = Math.floor(r);
      gold.style.width = `${full * (STAR_W + STAR_GAP) + (r - full) * STAR_W}px`;
    },
  };
}

/** Печать в итогах дня: сверху что, крупно — звание или число, снизу — пояснение. В миг удара — кольцо и искры. */
export function stamp(tone: 'gold' | 'red', top: string, big: string, note: string, at: number, i: number, sparks: boolean): HTMLElement {
  const wrap = el('div', `ui-stamp-wrap ${tone}`);
  wrap.style.setProperty('--at', `${at}ms`);
  wrap.style.setProperty('--rot', `${STAMP_TILT[i % STAMP_TILT.length]}deg`);
  const box = el('div', `ui-stamp ${tone}`);
  box.append(el('small', '', top), el('b', '', big), el('span', '', note));
  wrap.append(box);
  // Кольцо и искры — под печатью: видно только то, что вылетело из-под неё.
  if (sparks) {
    wrap.prepend(el('i', 'ui-stamp-ring'));
    // Искры вылетают от краёв печати наружу, а не из середины поверх надписи.
    for (let k = 0; k < STAMP_SPARKS; k++) {
      const angle = ((k + Math.random() * 0.6) / STAMP_SPARKS) * Math.PI * 2;
      const dist = 22 + Math.random() * 22;
      const spark = el('i', 'ui-spark');
      spark.style.left = `${50 + Math.cos(angle) * 50}%`;
      spark.style.top = `${50 + Math.sin(angle) * 54}%`;
      spark.style.setProperty('--dx', `${Math.round(Math.cos(angle) * dist * 1.3)}px`);
      spark.style.setProperty('--dy', `${Math.round(Math.sin(angle) * dist)}px`);
      wrap.prepend(spark);
    }
  }
  return wrap;
}

type GrannyMood = 'great' | 'good' | 'slow' | 'lost' | 'down';
const GRANNY_FACE: Record<GrannyMood, string> = { great: '_happy', good: '', slow: '_sad', lost: '_surprised', down: '_sad' };

/** Бабушка одной фразой оценивает день: по выручке против недели, ушедшим и рейтингу. */
function grannySays(day: number, stats: DayStats, rating: { before: number; after: number }, history: number[]): HTMLElement {
  const earlier = history.slice(-8, -1);
  const avg = earlier.length ? earlier.reduce((a, b) => a + b, 0) / earlier.length : stats.revenue;
  const mood: GrannyMood =
    stats.lost > Math.max(3, stats.served / 3)
      ? 'lost'
      : rating.after < rating.before - 0.05
        ? 'down'
        : stats.revenue >= avg * 1.15 && earlier.length
          ? 'great'
          : stats.revenue < avg * 0.8
            ? 'slow'
            : 'good';
  const box = el('div', 'ui-granny');
  const started = performance.now();
  box.append(
    liveFace(`assets/portrait_grandma${GRANNY_FACE[mood]}.png`, () => performance.now() - started < 1600, 'ui-granny-face'),
    el('p', '', t(`summary.granny.${mood}.${day % 2}` as TextKey)),
  );
  return box;
}

/** Линия по верхушкам столбиков недели: рисуется слева направо, на каждом дне — точка. */
function drawChartLine(chart: HTMLElement): void {
  const bars = [...chart.querySelectorAll<HTMLElement>('.ui-chart-bar')];
  if (bars.length < 2 || !chart.isConnected) return;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.classList.add('ui-chart-line');
  svg.setAttribute('width', String(chart.clientWidth));
  svg.setAttribute('height', String(chart.clientHeight));
  // offsetTop/offsetHeight не зависят от анимации scaleY — берём уже итоговые верхушки.
  const points = bars.map((bar) => {
    const col = bar.parentElement as HTMLElement;
    return { x: col.offsetLeft + col.offsetWidth / 2, y: bar.offsetTop };
  });
  const line = document.createElementNS(NS, 'polyline');
  line.setAttribute('points', points.map((p) => `${p.x},${p.y}`).join(' '));
  let len = 0;
  for (let i = 1; i < points.length; i++) len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  line.style.strokeDasharray = String(len);
  line.style.setProperty('--len', String(len));
  svg.append(line);
  points.forEach((p, i) => {
    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('cx', String(p.x));
    dot.setAttribute('cy', String(p.y));
    dot.setAttribute('r', '2.5');
    dot.style.transformOrigin = `${p.x}px ${p.y}px`;
    dot.style.animationDelay = `${600 + (900 * i) / (points.length - 1)}ms`;
    svg.append(dot);
  });
  chart.append(svg);
}
