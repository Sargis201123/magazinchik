// «Вестник района»: по понедельникам бот присылает каждому, кто торговал на прошлой неделе,
// газету о его неделе — выручка (и как изменилась), место среди своих и место в турнире района
// (league.ts; дуэль, гильдию и «Чёрную пятницу» убрали 01.11). Повод вернуться в начале новой недели.
// Шлёт cron (worker/index.ts) понемногу каждый час понедельника; один номер — один раз.

import { weekOf, weekRevenue } from './week.js';
import { finalize, leagueReady } from './league.js';
import { ready } from './social.js';
import { bot, type D1, type Env } from './telegram.js';
import { langOf, type Lang } from './lang.js';

/** Сколько газет за один запуск cron (лимиты Telegram и время воркера). */
export const PAPERS_PER_RUN = 150;
/** Понедельник, днём по Москве (UTC+3): с 9 до 21. */
const HOURS = { from: 6, to: 18 };

/** Разряды пробелом — на всех языках газеты (по-турецки и по-испански «1,200» читалось бы как дробь). */
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

type Headline = 'league' | 'king' | 'growth' | 'quiet' | 'done';
/** Заголовки номера на каждом языке. */
const HEADLINES: Record<Lang, Record<Headline, string>> = {
  ru: {
    league: 'ТУРНИР РАЙОНА: ваш магазин в тройке лучших лиги!',
    king: 'КОРОЛЬ КВАРТАЛА: ваш магазин заработал больше всех друзей!',
    growth: 'РЕКОРДНЫЙ РОСТ: выручка взлетела',
    quiet: 'ТИХАЯ НЕДЕЛЯ: покупатели ждут возвращения хозяина',
    done: 'НЕДЕЛЯ ПОЗАДИ: магазин работает, район доволен',
  },
  en: {
    league: 'DISTRICT TOURNAMENT: your shop is in the league\'s top 3!',
    king: 'KING OF THE BLOCK: your shop out-earned all your friends!',
    growth: 'RECORD GROWTH: revenue soared',
    quiet: 'A QUIET WEEK: customers miss the owner',
    done: 'ANOTHER WEEK DONE: the shop is open, the town is happy',
  },
  tr: {
    league: 'MAHALLE TURNUVASI: dükkânın ligin ilk 3’ünde!',
    king: 'MAHALLENİN KRALI: dükkânın bütün arkadaşlarından fazla kazandı!',
    growth: 'REKOR BÜYÜME: hasılat uçtu',
    quiet: 'SAKİN BİR HAFTA: müşteriler dükkân sahibini özledi',
    done: 'BİR HAFTA DAHA GERİDE: dükkân açık, mahalle memnun',
  },
  es: {
    league: 'TORNEO DEL BARRIO: ¡tu tienda está entre los 3 mejores de la liga!',
    king: 'REY DE LA CUADRA: ¡tu tienda ganó más que todos tus amigos!',
    growth: 'CRECIMIENTO RÉCORD: los ingresos se dispararon',
    quiet: 'UNA SEMANA TRANQUILA: los clientes extrañan al dueño',
    done: 'OTRA SEMANA CUMPLIDA: la tienda está abierta y el barrio, contento',
  },
  kk: {
    league: 'АУДАН ТУРНИРІ: дүкенің лиганың үздік үштігінде!',
    king: 'КВАРТАЛ КӨШБАСШЫСЫ: дүкенің барлық достарыңнан көп тапты!',
    growth: 'РЕКОРДТЫҚ ӨСУ: түсім күрт өсті',
    quiet: 'ТЫНЫШ АПТА: сатып алушылар дүкен иесін күтіп отыр',
    done: 'АПТА АРТТА ҚАЛДЫ: дүкен жұмыс істеп тұр, аудан риза',
  },
  uz: {
    league: 'MAHALLA TURNIRI: doʻkoning liganing eng yaxshi uchligida!',
    king: 'MAHALLA QIROLI: doʻkoning hamma doʻstlaringdan koʻp ishladi!',
    growth: 'REKORD OʻSISH: tushum osmonga chiqdi',
    quiet: 'SOKIN HAFTA: xaridorlar xoʻjayinni sogʻinishdi',
    done: 'YANA BIR HAFTA ORTDA: doʻkon ishlayapti, mahalla mamnun',
  },
  pt: {
    league: 'TORNEIO DO BAIRRO: sua loja está entre as 3 melhores da liga!',
    king: 'REI DO QUARTEIRÃO: sua loja faturou mais que todos os seus amigos!',
    growth: 'CRESCIMENTO RECORDE: o faturamento disparou',
    quiet: 'UMA SEMANA TRANQUILA: os clientes estão com saudade do dono',
    done: 'MAIS UMA SEMANA: a loja está aberta e o bairro, contente',
  },
};

/** Заголовок номера — по главному событию недели игрока. */
export function headline(lang: Lang, p: { revenue: number; prev: number; rank?: number; friends: number; leaguePlace?: number | null }): string {
  const h = HEADLINES[lang];
  if (p.leaguePlace && p.leaguePlace <= 3) return h.league;
  if (p.friends > 1 && p.rank === 1) return h.king;
  if (p.prev > 0 && p.revenue >= p.prev * 1.2) return h.growth;
  if (p.prev > 0 && p.revenue < p.prev * 0.8) return h.quiet;
  return h.done;
}

/** Строки газеты: суммы уже с разрядами, имена — уже экранированы. */
interface PaperTexts {
  friends: (rank: number, total: number) => string;
  /** Турнир района: место, сколько магазинов в лиге, лига (0 — Бронза, 1 — Серебро, 2 — Золото). */
  league: (place: number, size: number, tier: number) => string;
  title: (dates: string) => string;
  revenue: (sum: string, trend: string) => string;
  footer: string;
  open: string;
}
const PAPER: Record<Lang, PaperTexts> = {
  ru: {
    friends: (rank, total) => `🏅 Среди своих: ${rank}-е место из ${total}`,
    league: (place, size, tier) => `🏆 Турнир района, ${['🥉 Бронза', '🥈 Серебро', '🥇 Золото'][tier]}: ${place}-е место из ${size}`,
    title: (dates) => `🗞 <b>Вестник района</b> · ${dates}`,
    revenue: (sum, trend) => `💰 Выручка за неделю: ${sum}${trend}`,
    footer: 'Новая неделя уже началась — покупатели ждут!',
    open: '▶ Открыть магазин',
  },
  en: {
    friends: (rank, total) => `🏅 Among friends: #${rank} of ${total}`,
    league: (place, size, tier) => `🏆 District tournament, ${['🥉 Bronze', '🥈 Silver', '🥇 Gold'][tier]}: #${place} of ${size}`,
    title: (dates) => `🗞 <b>The Town Gazette</b> · ${dates}`,
    revenue: (sum, trend) => `💰 Weekly revenue: ${sum}${trend}`,
    footer: 'A new week has begun — customers are waiting!',
    open: '▶ Open the shop',
  },
  tr: {
    friends: (rank, total) => `🏅 Arkadaşlar arasında: ${total} kişi içinde ${rank}. sıra`,
    league: (place, size, tier) => `🏆 Mahalle turnuvası, ${['🥉 Bronz', '🥈 Gümüş', '🥇 Altın'][tier]}: ${size} dükkân içinde ${place}. sıra`,
    title: (dates) => `🗞 <b>Mahalle Gazetesi</b> · ${dates}`,
    revenue: (sum, trend) => `💰 Haftalık hasılat: ${sum}${trend}`,
    footer: 'Yeni hafta başladı bile — müşteriler bekliyor!',
    open: '▶ Dükkânı aç',
  },
  es: {
    friends: (rank, total) => `🏅 Entre amigos: puesto ${rank} de ${total}`,
    league: (place, size, tier) => `🏆 Torneo del barrio, ${['🥉 Bronce', '🥈 Plata', '🥇 Oro'][tier]}: puesto ${place} de ${size}`,
    title: (dates) => `🗞 <b>La Gaceta del Barrio</b> · ${dates}`,
    revenue: (sum, trend) => `💰 Ingresos de la semana: ${sum}${trend}`,
    footer: '¡Ya empezó una nueva semana y los clientes te esperan!',
    open: '▶ Abrir la tienda',
  },
  kk: {
    friends: (rank, total) => `🏅 Достар арасында: ${total} адамның ішінде ${rank}-орын`,
    league: (place, size, tier) => `🏆 Аудан турнирі, ${['🥉 Қола', '🥈 Күміс', '🥇 Алтын'][tier]}: ${size} дүкеннің ішінде ${place}-орын`,
    title: (dates) => `🗞 <b>Аудан хабаршысы</b> · ${dates}`,
    revenue: (sum, trend) => `💰 Апталық түсім: ${sum}${trend}`,
    footer: 'Жаңа апта басталып кетті — сатып алушылар күтіп тұр!',
    open: '▶ Дүкенді ашу',
  },
  uz: {
    friends: (rank, total) => `🏅 Doʻstlar orasida: ${total} tadan ${rank}-oʻrin`,
    league: (place, size, tier) => `🏆 Mahalla turniri, ${['🥉 Bronza', '🥈 Kumush', '🥇 Oltin'][tier]}: ${size} tadan ${place}-oʻrin`,
    title: (dates) => `🗞 <b>Mahalla xabarnomasi</b> · ${dates}`,
    revenue: (sum, trend) => `💰 Haftalik tushum: ${sum}${trend}`,
    footer: 'Yangi hafta boshlandi — xaridorlar kutyapti!',
    open: '▶ Doʻkonni ochish',
  },
  pt: {
    friends: (rank, total) => `🏅 Entre amigos: ${rank}º lugar de ${total}`,
    league: (place, size, tier) => `🏆 Torneio do bairro, ${['🥉 Bronze', '🥈 Prata', '🥇 Ouro'][tier]}: ${place}º lugar de ${size}`,
    title: (dates) => `🗞 <b>Gazeta do Bairro</b> · ${dates}`,
    revenue: (sum, trend) => `💰 Faturamento da semana: ${sum}${trend}`,
    footer: 'Uma nova semana já começou — os clientes estão esperando!',
    open: '▶ Abrir a loja',
  },
};

/** Текст газеты для игрока за неделю week (null — не торговал). */
export async function paperFor(db: D1, id: number, week: number, lang: Lang): Promise<string | null> {
  const revenue = await weekRevenue(db, id, week);
  if (revenue <= 0) return null;
  const t = PAPER[lang];
  const prev = await weekRevenue(db, id, week - 1);
  const lines: string[] = [];
  // Свои: место по выручке за неделю.
  const friends = await friendsOf(db, id);
  let rank: number | undefined;
  if (friends.length > 1) {
    const scores = await Promise.all(friends.map(async (f) => ({ f, w: await weekRevenue(db, f, week) })));
    rank = scores.filter((s) => s.w > revenue).length + 1;
    lines.push(t.friends(rank, friends.length));
  }
  // Турнир района: итог недели (считается один раз и запоминается, league.ts).
  await leagueReady(db);
  const cup = await finalize(db, id, week);
  if (cup && cup.score > 0) lines.push(t.league(cup.place, cup.size, Math.max(0, Math.min(2, cup.tier))));
  const change = prev > 0 ? Math.round(((revenue - prev) / prev) * 100) : null;
  const trend = change === null ? '' : change >= 0 ? ` (▲ ${change}%)` : ` (▼ ${-change}%)`;
  return [
    t.title(weekDates(week)),
    '',
    `<b>${headline(lang, { revenue, prev, rank, friends: friends.length, leaguePlace: cup && cup.score > 0 ? cup.place : null })}</b>`,
    '',
    t.revenue(fmt(revenue), trend),
    ...lines,
    '',
    t.footer,
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
    // Язык из players (social.ts); старые записи без языка — ru.
    const lang = langOf(p.lang);
    // Отметка — до отправки: если что-то упадёт, второй раз тот же номер не придёт.
    await db.prepare('INSERT OR IGNORE INTO newspaper (id, week) VALUES (?, ?)').bind(p.id, week).run();
    const text = await paperFor(db, p.id, week, lang);
    if (!text) continue;
    try {
      await bot(token, 'sendMessage', {
        chat_id: p.id,
        text,
        parse_mode: 'HTML',
        ...(app ? { reply_markup: { inline_keyboard: [[{ text: PAPER[lang].open, web_app: { url: app } }]] } } : {}),
      });
      sent++;
    } catch (e) {
      // Бот заблокирован или чата нет — больше не пишем (как напоминания, social.ts).
      if (/forbidden|chat not found/i.test(String(e))) await db.prepare('UPDATE players SET misses = 99 WHERE id = ?').bind(p.id).run();
    }
  }
  return sent;
}
