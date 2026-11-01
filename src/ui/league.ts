// Недельный турнир района (game/social.ts, api/_lib/league.ts): утренняя карточка с местом и
// «до 2-го места N», бонус выходных одной строкой, награда за прошлую неделю с маленьким праздником
// (и там же — прощальная награда за закрытые дуэль, гильдию и выходные) и вкладка в рейтинге.

import { t, type TextKey } from '../i18n';
import { track } from '../platform/analytics';
import { fetchLeague, leagueAskedAt, leagueInfo, type LeagueInfo } from '../platform/league';
import { MP_EVENT } from '../platform/multiplayer';
import { liteMode } from '../platform/quality';
import { claimFarewell, claimLeague, farewellReward, leagueReward, LEAGUE_SIZE, myStanding, TIER_ICON, type LeagueRow } from '../game/social';
import { STORE_LEVELS, type StoreState } from '../game/economy';
import { button, el, toast } from './dom';

const money = (n: number) => n.toLocaleString('ru-RU');
const tierName = (tier: number): string => `${TIER_ICON[Math.max(0, Math.min(2, tier))]} ${t(`league.tier.${Math.max(0, Math.min(2, tier))}` as TextKey)}`;

/** Таблицу освежаем не чаще раза в минуту (утро после дня — счёт подрос). */
const FRESH_MS = 60_000;
function refreshSoon(): void {
  // Ещё не спрашивали (запуск — спросит loadMultiplayer) или спрашивали недавно — не дублировать.
  if (!leagueAskedAt() || Date.now() - leagueAskedAt() < FRESH_MS) return;
  void fetchLeague().then((info) => {
    if (info) window.dispatchEvent(new Event(MP_EVENT));
  });
}

/** Конфетти поверх окна — в облегчённом режиме и при «меньше движения» без него, только всплывашка. */
function confetti(): void {
  if (liteMode() || typeof document === 'undefined' || !document.body.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = el('div');
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden';
  const colors = ['#fee761', '#e43b44', '#63c74d', '#2ce8f5', '#feae34', '#b55088'];
  for (let i = 0; i < 28; i++) {
    const bit = el('i');
    const x = Math.random() * 100;
    bit.style.cssText = `position:absolute;left:${x}%;top:-12px;width:6px;height:9px;background:${colors[i % colors.length]};image-rendering:pixelated`;
    layer.append(bit);
    bit.animate(
      [
        { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${(Math.random() - 0.5) * 120}px, ${70 + Math.random() * 30}vh) rotate(${Math.random() * 720}deg)`, opacity: 0.9 },
      ],
      { duration: 1400 + Math.random() * 900, delay: Math.random() * 300, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' },
    );
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 2800);
}

/**
 * Утро, сверху: итог прошлой недели — забрать награду (кубок, переход в другую лигу). Той же кнопкой —
 * прощальная награда за дуэль, гильдию и «Чёрную пятницу» (их закрыли 01.11), если она ещё не забрана.
 */
export function leagueClaimBox(state: StoreState, getState: () => StoreState, update: (next: StoreState, feedback: 'tap' | 'success' | 'error') => void): HTMLElement[] {
  const info = leagueInfo();
  const last = info?.last && (state.leagueClaimed === undefined || state.leagueClaimed < info.last.week) ? info.last : undefined;
  const bye = farewellReward(state, info?.farewell);
  if (!last && !bye) return [];
  const box = el('div', 'ui-box ui-rush');
  const reward = last && last.score > 0 ? leagueReward(state.level, last.place, last.tier) : 0;
  const moved = !last ? 'stay' : last.next > last.tier ? 'up' : last.next < last.tier ? 'down' : 'stay';
  if (last) {
    box.append(
      el('b', '', `🏆 ${t('league.result', { place: last.place, size: last.size, tier: tierName(last.tier) })}`),
      el('div', '', t('league.resultScore', { n: money(last.score) })),
      el('div', 'ui-muted', t(`league.move.${moved}` as TextKey, { tier: tierName(last.next) })),
    );
  }
  if (bye) box.append(el('div', 'ui-note', t('farewell.note')), el('div', '', t('farewell.reward', { n: money(bye) })));
  const total = reward + bye;
  box.append(
    button(total ? t('league.claim', { n: money(total) }) : t('league.claimNone'), () => {
      let next = getState();
      let cup = false;
      const got = last ? claimLeague(next, last) : null;
      if (got) {
        next = got.state;
        cup = got.cup;
        track('league_claim', next.day, last!.place);
      }
      const old = claimFarewell(next, leagueInfo()?.farewell);
      if (old) {
        next = old.state;
        track('farewell_claim', next.day, old.money);
      }
      if (!got && !old) return;
      update(next, 'success');
      if (cup) {
        confetti();
        toast('assets/ico_trophy.png', t('league.cupTitle'), t('league.cup', { place: last!.place }), true);
      } else if (moved === 'up') {
        confetti();
      }
    }),
  );
  return [box];
}

/** Бонус выходных (WEEKEND_BONUS в game/social.ts) — одна строка под местом. */
const weekendLine = (info: LeagueInfo): HTMLElement[] =>
  info.weekend ? [el('div', 'ui-note', t('league.weekend'))] : [];

/** Место в лиге этой недели — для значка в свёрнутой карточке «Сегодня» (null — не в лиге). */
export function leaguePlace(): number | null {
  const rows = leagueInfo()?.rows;
  return rows?.length ? (myStanding(rows)?.place ?? null) : null;
}

/** Утренняя карточка: лига недели, место, «до N-го места» и тройка лучших. */
export function leagueBox(onTable?: () => void): HTMLElement[] {
  refreshSoon();
  const info = leagueInfo();
  if (!info?.rows?.length || info.tier === undefined) return [];
  const box = el('div', 'ui-box ui-duel');
  box.append(el('b', '', `🏆 ${t('league.title', { tier: tierName(info.tier) })}`), ...standingLines(info, 3));
  if (onTable) box.append(button(t('league.table'), onTable, 'ui-btn secondary'));
  return [box];
}

/** Место и разрыв, тройка лучших (или вся таблица — top = LEAGUE_SIZE). */
function standingLines(info: LeagueInfo, top: number): HTMLElement[] {
  const rows = info.rows ?? [];
  const me = myStanding(rows);
  const out: HTMLElement[] = [];
  if (me) {
    out.push(el('div', '', t('league.place', { place: me.place, size: rows.length })));
    out.push(el('div', 'ui-muted', me.gap ? t('league.gap', { place: me.place - 1, n: money(me.gap) }) : t('league.first')));
  }
  out.push(...weekendLine(info), el('div', 'ui-muted', t('league.left', { n: info.daysLeft })));
  rows.slice(0, top).forEach((r, i) => out.push(row(r, i + 1)));
  // Сам игрок ниже тройки — его строка под ней.
  const mine = rows.findIndex((r) => r.me);
  if (top < rows.length && mine >= top) out.push(row(rows[mine], mine + 1));
  return out;
}

function row(r: LeagueRow, place: number): HTMLElement {
  const medal = ['🥇', '🥈', '🥉'][place - 1] ?? `${place}.`;
  const line = el('div', `ui-item-sub${r.me ? ' ui-me' : ''}`);
  line.textContent = `${medal} ${r.me ? t('board.you', { name: r.name }) : r.name} · ${t(STORE_LEVELS[Math.min(r.level, STORE_LEVELS.length - 1)].nameKey)} — ${money(r.score)} 💰`;
  return line;
}

/** Вкладка «Турнир района» в рейтинге. */
export function leagueTab(level = 0): HTMLElement[] {
  const info = leagueInfo();
  if (!info) return [el('p', '', t('board.off'))];
  if (!info.rows?.length || info.tier === undefined) return [el('div', 'ui-muted', t('league.notYet'))];
  return [
    el('h3', '', t('league.title', { tier: tierName(info.tier) })),
    el('div', 'ui-muted', t('league.note', { size: LEAGUE_SIZE })),
    el('div', 'ui-muted', t('league.weekendNote')),
    ...standingLines(info, LEAGUE_SIZE),
    el('div', 'ui-muted', t('league.rewards', { a: leagueReward(level, 1, info.tier), b: leagueReward(level, 2, info.tier), c: leagueReward(level, 3, info.tier) })),
  ];
}
