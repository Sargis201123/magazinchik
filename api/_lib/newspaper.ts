// «Вестник района»: по понедельникам бот присылает каждому, кто торговал на прошлой неделе,
// газету о его неделе — выручка (и как изменилась), место среди своих, дуэль с другом, цель
// гильдии и место в «Чёрной пятнице». Повод вернуться в начале новой недели.
// Шлёт cron (worker/index.ts) понемногу каждый час понедельника; один номер — один раз.

import { guildOf, lastResult, nameOf, weekOf, weekRevenue } from './guild.js';
import { ready } from './social.js';
import { standing, summary } from './weekend.js';
import { bot, type D1, type Env } from './telegram.js';

/** Сколько газет за один запуск cron (лимиты Telegram и время воркера). */
export const PAPERS_PER_RUN = 150;
/** Понедельник, днём по Москве (UTC+3): с 9 до 21. */
const HOURS = { from: 6, to: 18 };

type Lang = 'ru' | 'en';
/** Имена игроков и гильдий — в HTML-разметке сообщения. */
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmt = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** Свои — как в рейтинге (stats.ts): кого пригласил, кто пригласил, кого пригласил тот же друг. */
async function friendsOf(db: D1, id: number): Promise<number[]> {
  const rows = await db
    .prepare(
      `SELECT id FROM progress WHERE id = ?1
         OR id IN (SELECT invitee FROM referrals WHERE inviter = ?1)
         OR id IN (SELECT inviter FROM referrals WHERE invitee = ?1)
         OR id IN (SELECT invitee FROM referrals WHERE inviter IN (SELECT inviter FROM referrals WHERE invitee = ?1))
       LIMIT 50`,
    )
    .bind(id)
    .all<{ id: number }>();
  return rows.results.map((r) => r.id);
}

/** Даты недели: «26.10–01.11». */
const DAY = 24 * 3600_000;
const dd = (ms: number): string => {
  const d = new Date(ms);
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
export const weekDates = (week: number): string => `${dd((week * 7 - 3) * DAY)}–${dd((week * 7 + 3) * DAY)}`;

/** Заголовок номера — по главному событию недели игрока. */
function headline(lang: Lang, p: { revenue: number; prev: number; duelWon?: boolean; rank?: number; friends: number; weekendRank?: number | null }): string {
  const ru = lang === 'ru';
  if (p.weekendRank && p.weekendRank <= 10) return ru ? 'ЛУЧШИЕ ВЫХОДНЫЕ РАЙОНА: ваш магазин в десятке «Чёрной пятницы»!' : 'BEST WEEKEND IN TOWN: your shop made the Black Friday top 10!';
  if (p.friends > 1 && p.rank === 1) return ru ? 'КОРОЛЬ КВАРТАЛА: ваш магазин заработал больше всех друзей!' : 'KING OF THE BLOCK: your shop out-earned all your friends!';
  if (p.duelWon) return ru ? 'ДУЭЛЬ ВЫИГРАНА: конкурент признаёт поражение' : 'DUEL WON: your rival admits defeat';
  if (p.prev > 0 && p.revenue >= p.prev * 1.2) return ru ? 'РЕКОРДНЫЙ РОСТ: выручка взлетела' : 'RECORD GROWTH: revenue soared';
  if (p.prev > 0 && p.revenue < p.prev * 0.8) return ru ? 'ТИХАЯ НЕДЕЛЯ: покупатели ждут возвращения хозяина' : 'A QUIET WEEK: customers miss the owner';
  return ru ? 'НЕДЕЛЯ ПОЗАДИ: магазин работает, район доволен' : 'ANOTHER WEEK DONE: the shop is open, the town is happy';
}

/** Текст газеты для игрока за неделю week (null — не торговал). */
export async function paperFor(db: D1, id: number, week: number, lang: Lang): Promise<string | null> {
  const revenue = await weekRevenue(db, id, week);
  if (revenue <= 0) return null;
  const ru = lang === 'ru';
  const prev = await weekRevenue(db, id, week - 1);
  const lines: string[] = [];
  // Свои: место по выручке за неделю.
  const friends = await friendsOf(db, id);
  let rank: number | undefined;
  if (friends.length > 1) {
    const scores = await Promise.all(friends.map(async (f) => ({ f, w: await weekRevenue(db, f, week) })));
    rank = scores.filter((s) => s.w > revenue).length + 1;
    lines.push(ru ? `🏅 Среди своих: ${rank}-е место из ${friends.length}` : `🏅 Among friends: #${rank} of ${friends.length}`);
  }
  // Дуэль недели.
  let duelWon: boolean | undefined;
  const duel = await db.prepare('SELECT rival FROM duels WHERE id = ? AND week = ?').bind(id, week).first<{ rival: number }>();
  if (duel) {
    const theirs = await weekRevenue(db, duel.rival, week);
    const name = esc(await nameOf(db, duel.rival));
    duelWon = revenue > theirs;
    lines.push(
      duelWon
        ? ru ? `⚔️ Дуэль: победа над «${name} и Ко» (${fmt(revenue)} против ${fmt(theirs)})` : `⚔️ Duel: you beat ${name} & Co (${fmt(revenue)} vs ${fmt(theirs)})`
        : ru ? `⚔️ Дуэль: «${name} и Ко» впереди (${fmt(theirs)} против ${fmt(revenue)}) — реванш на этой неделе!` : `⚔️ Duel: ${name} & Co won (${fmt(theirs)} vs ${fmt(revenue)}) — rematch this week!`,
    );
  }
  // Гильдия.
  const g = await guildOf(db, id);
  if (g) {
    const gname = esc(g.name);
    const reached = await lastResult(db, g.id, week);
    if (reached !== null)
      lines.push(
        reached
          ? ru ? `🛡 Гильдия «${gname}»: цель недели выполнена — награда ждёт в игре` : `🛡 Guild “${gname}”: weekly goal reached — the reward is waiting`
          : ru ? `🛡 Гильдия «${gname}»: до цели не хватило — на этой неделе добьём!` : `🛡 Guild “${gname}”: fell short — let's make it this week!`,
      );
  }
  // «Чёрная пятница района».
  const w = await standing(db, id, week);
  if (w.rank) {
    const { players } = await summary(db, week);
    lines.push(ru ? `🛍 «Чёрная пятница»: ${w.rank}-е место из ${players} — приз ждёт в игре` : `🛍 Black Friday: #${w.rank} of ${players} — your prize is waiting`);
  }
  const change = prev > 0 ? Math.round(((revenue - prev) / prev) * 100) : null;
  const trend = change === null ? '' : change >= 0 ? ` (▲ ${change}%)` : ` (▼ ${-change}%)`;
  return [
    ru ? `🗞 <b>Вестник района</b> · ${weekDates(week)}` : `🗞 <b>The Town Gazette</b> · ${weekDates(week)}`,
    '',
    `<b>${headline(lang, { revenue, prev, duelWon, rank, friends: friends.length, weekendRank: w.rank })}</b>`,
    '',
    ru ? `💰 Выручка за неделю: ${fmt(revenue)}${trend}` : `💰 Weekly revenue: ${fmt(revenue)}${trend}`,
    ...lines,
    '',
    ru ? 'Новая неделя уже началась — покупатели ждут!' : 'A new week has begun — customers are waiting!',
  ].join('\n');
}

/** Раз в час (cron): в понедельник разослать газету за прошлую неделю тем, кто ещё не получил. */
export async function sendNewspapers(env: Env, now = Date.now()): Promise<number> {
  const token = env.BOT_TOKEN ?? '';
  const db = env.DB;
  if (!token || !db) return 0;
  const date = new Date(now);
  if (date.getUTCDay() !== 1 || date.getUTCHours() < HOURS.from || date.getUTCHours() > HOURS.to) return 0;
  await ready(db);
  const week = weekOf(now) - 1;
  // Торговали на прошлой неделе (есть её начало), бота не блокировали, газету ещё не получали.
  const { results } = await db
    .prepare(
      `SELECT w.id AS id, p.lang AS lang FROM week_start w JOIN players p ON p.id = w.id
       WHERE w.week = ? AND p.misses < 99 AND w.id NOT IN (SELECT id FROM newspaper WHERE week = ?) LIMIT ?`,
    )
    .bind(week, week, PAPERS_PER_RUN)
    .all<{ id: number; lang: string }>();
  const app = env.APP_URL ?? '';
  let sent = 0;
  for (const p of results) {
    const lang: Lang = p.lang === 'en' ? 'en' : 'ru';
    // Отметка — до отправки: если что-то упадёт, второй раз тот же номер не придёт.
    await db.prepare('INSERT OR IGNORE INTO newspaper (id, week) VALUES (?, ?)').bind(p.id, week).run();
    const text = await paperFor(db, p.id, week, lang);
    if (!text) continue;
    try {
      await bot(token, 'sendMessage', {
        chat_id: p.id,
        text,
        parse_mode: 'HTML',
        ...(app ? { reply_markup: { inline_keyboard: [[{ text: lang === 'ru' ? '▶ Открыть магазин' : '▶ Open the shop', web_app: { url: app } }]] } } : {}),
      });
      sent++;
    } catch (e) {
      // Бот заблокирован или чата нет — больше не пишем (как напоминания, social.ts).
      if (/forbidden|chat not found/i.test(String(e))) await db.prepare('UPDATE players SET misses = 99 WHERE id = ?').bind(p.id).run();
    }
  }
  return sent;
}
