// «Вестник района»: по понедельникам бот присылает каждому, кто торговал на прошлой неделе,
// газету о его неделе — выручка (и как изменилась), место среди своих, дуэль с другом, цель
// гильдии и место в «Чёрной пятнице». Повод вернуться в начале новой недели.
// Шлёт cron (worker/index.ts) понемногу каждый час понедельника; один номер — один раз.

import { guildOf, lastResult, nameOf, weekOf, weekRevenue } from './guild.js';
import { ready } from './social.js';
import { standing, summary } from './weekend.js';
import { bot, type D1, type Env } from './telegram.js';
import { langOf, type Lang } from './lang.js';

/** Сколько газет за один запуск cron (лимиты Telegram и время воркера). */
export const PAPERS_PER_RUN = 150;
/** Понедельник, днём по Москве (UTC+3): с 9 до 21. */
const HOURS = { from: 6, to: 18 };

/** Имена игроков и гильдий — в HTML-разметке сообщения. */
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

type Headline = 'weekend' | 'king' | 'duel' | 'growth' | 'quiet' | 'done';
/** Заголовки номера на каждом языке. */
const HEADLINES: Record<Lang, Record<Headline, string>> = {
  ru: {
    weekend: 'ЛУЧШИЕ ВЫХОДНЫЕ РАЙОНА: ваш магазин в десятке «Чёрной пятницы»!',
    king: 'КОРОЛЬ КВАРТАЛА: ваш магазин заработал больше всех друзей!',
    duel: 'ДУЭЛЬ ВЫИГРАНА: конкурент признаёт поражение',
    growth: 'РЕКОРДНЫЙ РОСТ: выручка взлетела',
    quiet: 'ТИХАЯ НЕДЕЛЯ: покупатели ждут возвращения хозяина',
    done: 'НЕДЕЛЯ ПОЗАДИ: магазин работает, район доволен',
  },
  en: {
    weekend: 'BEST WEEKEND IN TOWN: your shop made the Black Friday top 10!',
    king: 'KING OF THE BLOCK: your shop out-earned all your friends!',
    duel: 'DUEL WON: your rival admits defeat',
    growth: 'RECORD GROWTH: revenue soared',
    quiet: 'A QUIET WEEK: customers miss the owner',
    done: 'ANOTHER WEEK DONE: the shop is open, the town is happy',
  },
  tr: {
    weekend: 'MAHALLENİN EN İYİ HAFTA SONU: dükkânın Black Friday’de ilk 10’a girdi!',
    king: 'MAHALLENİN KRALI: dükkânın bütün arkadaşlarından fazla kazandı!',
    duel: 'DÜELLO KAZANILDI: rakibin yenilgiyi kabul ediyor',
    growth: 'REKOR BÜYÜME: hasılat uçtu',
    quiet: 'SAKİN BİR HAFTA: müşteriler dükkân sahibini özledi',
    done: 'BİR HAFTA DAHA GERİDE: dükkân açık, mahalle memnun',
  },
  es: {
    weekend: 'EL MEJOR FIN DE SEMANA DEL BARRIO: ¡tu tienda entró al top 10 del Black Friday!',
    king: 'REY DE LA CUADRA: ¡tu tienda ganó más que todos tus amigos!',
    duel: 'DUELO GANADO: tu rival admite la derrota',
    growth: 'CRECIMIENTO RÉCORD: los ingresos se dispararon',
    quiet: 'UNA SEMANA TRANQUILA: los clientes extrañan al dueño',
    done: 'OTRA SEMANA CUMPLIDA: la tienda está abierta y el barrio, contento',
  },
  kk: {
    weekend: 'АУДАННЫҢ ЕҢ ҮЗДІК ДЕМАЛЫСЫ: дүкенің «Қара жұманың» алғашқы ондығында!',
    king: 'КВАРТАЛ КӨШБАСШЫСЫ: дүкенің барлық достарыңнан көп тапты!',
    duel: 'ЖЕКПЕ-ЖЕКТЕ ЖЕҢІС: бәсекелес жеңілгенін мойындады',
    growth: 'РЕКОРДТЫҚ ӨСУ: түсім күрт өсті',
    quiet: 'ТЫНЫШ АПТА: сатып алушылар дүкен иесін күтіп отыр',
    done: 'АПТА АРТТА ҚАЛДЫ: дүкен жұмыс істеп тұр, аудан риза',
  },
  uz: {
    weekend: 'MAHALLANING ENG ZOʻR DAM OLISH KUNLARI: doʻkoning «Qora juma» oʻntaligiga kirdi!',
    king: 'MAHALLA QIROLI: doʻkoning hamma doʻstlaringdan koʻp ishladi!',
    duel: 'DUEL YUTILDI: raqibing magʻlubiyatni tan olyapti',
    growth: 'REKORD OʻSISH: tushum osmonga chiqdi',
    quiet: 'SOKIN HAFTA: xaridorlar xoʻjayinni sogʻinishdi',
    done: 'YANA BIR HAFTA ORTDA: doʻkon ishlayapti, mahalla mamnun',
  },
  pt: {
    weekend: 'O MELHOR FIM DE SEMANA DO BAIRRO: sua loja entrou no top 10 da Black Friday!',
    king: 'REI DO QUARTEIRÃO: sua loja faturou mais que todos os seus amigos!',
    duel: 'DUELO VENCIDO: o rival admite a derrota',
    growth: 'CRESCIMENTO RECORDE: o faturamento disparou',
    quiet: 'UMA SEMANA TRANQUILA: os clientes estão com saudade do dono',
    done: 'MAIS UMA SEMANA: a loja está aberta e o bairro, contente',
  },
};

/** Заголовок номера — по главному событию недели игрока. */
export function headline(lang: Lang, p: { revenue: number; prev: number; duelWon?: boolean; rank?: number; friends: number; weekendRank?: number | null }): string {
  const h = HEADLINES[lang];
  if (p.weekendRank && p.weekendRank <= 10) return h.weekend;
  if (p.friends > 1 && p.rank === 1) return h.king;
  if (p.duelWon) return h.duel;
  if (p.prev > 0 && p.revenue >= p.prev * 1.2) return h.growth;
  if (p.prev > 0 && p.revenue < p.prev * 0.8) return h.quiet;
  return h.done;
}

/** Строки газеты: суммы уже с разрядами, имена — уже экранированы. */
interface PaperTexts {
  friends: (rank: number, total: number) => string;
  duelWon: (name: string, mine: string, theirs: string) => string;
  duelLost: (name: string, mine: string, theirs: string) => string;
  guildReached: (guild: string) => string;
  guildMissed: (guild: string) => string;
  weekend: (rank: number, players: number) => string;
  title: (dates: string) => string;
  revenue: (sum: string, trend: string) => string;
  footer: string;
  open: string;
}
const PAPER: Record<Lang, PaperTexts> = {
  ru: {
    friends: (rank, total) => `🏅 Среди своих: ${rank}-е место из ${total}`,
    duelWon: (name, mine, theirs) => `⚔️ Дуэль: победа над «${name} и Ко» (${mine} против ${theirs})`,
    duelLost: (name, mine, theirs) => `⚔️ Дуэль: «${name} и Ко» впереди (${theirs} против ${mine}) — реванш на этой неделе!`,
    guildReached: (guild) => `🛡 Гильдия «${guild}»: цель недели выполнена — награда ждёт в игре`,
    guildMissed: (guild) => `🛡 Гильдия «${guild}»: до цели не хватило — на этой неделе добьём!`,
    weekend: (rank, players) => `🛍 «Чёрная пятница»: ${rank}-е место из ${players} — приз ждёт в игре`,
    title: (dates) => `🗞 <b>Вестник района</b> · ${dates}`,
    revenue: (sum, trend) => `💰 Выручка за неделю: ${sum}${trend}`,
    footer: 'Новая неделя уже началась — покупатели ждут!',
    open: '▶ Открыть магазин',
  },
  en: {
    friends: (rank, total) => `🏅 Among friends: #${rank} of ${total}`,
    duelWon: (name, mine, theirs) => `⚔️ Duel: you beat ${name} & Co (${mine} vs ${theirs})`,
    duelLost: (name, mine, theirs) => `⚔️ Duel: ${name} & Co won (${theirs} vs ${mine}) — rematch this week!`,
    guildReached: (guild) => `🛡 Guild “${guild}”: weekly goal reached — the reward is waiting`,
    guildMissed: (guild) => `🛡 Guild “${guild}”: fell short — let's make it this week!`,
    weekend: (rank, players) => `🛍 Black Friday: #${rank} of ${players} — your prize is waiting`,
    title: (dates) => `🗞 <b>The Town Gazette</b> · ${dates}`,
    revenue: (sum, trend) => `💰 Weekly revenue: ${sum}${trend}`,
    footer: 'A new week has begun — customers are waiting!',
    open: '▶ Open the shop',
  },
  tr: {
    friends: (rank, total) => `🏅 Arkadaşlar arasında: ${total} kişi içinde ${rank}. sıra`,
    duelWon: (name, mine, theirs) => `⚔️ Düello: ${name} & Co. karşısında zafer (${mine} – ${theirs})`,
    duelLost: (name, mine, theirs) => `⚔️ Düello: ${name} & Co. önde (${theirs} – ${mine}) — bu hafta rövanş!`,
    guildReached: (guild) => `🛡 “${guild}” loncası: haftanın hedefi tamam — ödül oyunda seni bekliyor`,
    guildMissed: (guild) => `🛡 “${guild}” loncası: hedefe biraz kalmıştı — bu hafta başaracağız!`,
    weekend: (rank, players) => `🛍 Black Friday: ${players} kişi içinde ${rank}. sıra — ödülün oyunda seni bekliyor`,
    title: (dates) => `🗞 <b>Mahalle Gazetesi</b> · ${dates}`,
    revenue: (sum, trend) => `💰 Haftalık hasılat: ${sum}${trend}`,
    footer: 'Yeni hafta başladı bile — müşteriler bekliyor!',
    open: '▶ Dükkânı aç',
  },
  es: {
    friends: (rank, total) => `🏅 Entre amigos: puesto ${rank} de ${total}`,
    duelWon: (name, mine, theirs) => `⚔️ Duelo: le ganaste a ${name} y Cía. (${mine} contra ${theirs})`,
    duelLost: (name, mine, theirs) => `⚔️ Duelo: ${name} y Cía. va adelante (${theirs} contra ${mine}). ¡Revancha esta semana!`,
    guildReached: (guild) => `🛡 Gremio “${guild}”: ¡meta semanal cumplida! El premio te espera en el juego`,
    guildMissed: (guild) => `🛡 Gremio “${guild}”: no llegamos a la meta. ¡Esta semana sí!`,
    weekend: (rank, players) => `🛍 Black Friday: puesto ${rank} de ${players}. Tu premio te espera en el juego`,
    title: (dates) => `🗞 <b>La Gaceta del Barrio</b> · ${dates}`,
    revenue: (sum, trend) => `💰 Ingresos de la semana: ${sum}${trend}`,
    footer: '¡Ya empezó una nueva semana y los clientes te esperan!',
    open: '▶ Abrir la tienda',
  },
  kk: {
    friends: (rank, total) => `🏅 Достар арасында: ${total} адамның ішінде ${rank}-орын`,
    duelWon: (name, mine, theirs) => `⚔️ Жекпе-жек: «${name} және К°» жеңілді (${mine} — ${theirs})`,
    duelLost: (name, mine, theirs) => `⚔️ Жекпе-жек: «${name} және К°» алда (${theirs} — ${mine}) — осы аптада қайта сынасамыз!`,
    guildReached: (guild) => `🛡 «${guild}» гильдиясы: апта мақсаты орындалды — сыйлық ойында күтіп тұр`,
    guildMissed: (guild) => `🛡 «${guild}» гильдиясы: мақсатқа сәл жетпеді — осы аптада жетеміз!`,
    weekend: (rank, players) => `🛍 «Қара жұма»: ${players} дүкеннің ішінде ${rank}-орын — сыйлық ойында күтіп тұр`,
    title: (dates) => `🗞 <b>Аудан хабаршысы</b> · ${dates}`,
    revenue: (sum, trend) => `💰 Апталық түсім: ${sum}${trend}`,
    footer: 'Жаңа апта басталып кетті — сатып алушылар күтіп тұр!',
    open: '▶ Дүкенді ашу',
  },
  uz: {
    friends: (rank, total) => `🏅 Doʻstlar orasida: ${total} tadan ${rank}-oʻrin`,
    duelWon: (name, mine, theirs) => `⚔️ Duel: «${name} va Ko» ustidan gʻalaba (${mine} – ${theirs})`,
    duelLost: (name, mine, theirs) => `⚔️ Duel: «${name} va Ko» oldinda (${theirs} – ${mine}) — shu hafta qasos olamiz!`,
    guildReached: (guild) => `🛡 «${guild}» gildiyasi: haftalik maqsad bajarildi — mukofot oʻyinda kutyapti`,
    guildMissed: (guild) => `🛡 «${guild}» gildiyasi: maqsadga ozgina yetmadi — shu hafta uddalaymiz!`,
    weekend: (rank, players) => `🛍 «Qora juma»: ${players} tadan ${rank}-oʻrin — sovrin oʻyinda kutyapti`,
    title: (dates) => `🗞 <b>Mahalla xabarnomasi</b> · ${dates}`,
    revenue: (sum, trend) => `💰 Haftalik tushum: ${sum}${trend}`,
    footer: 'Yangi hafta boshlandi — xaridorlar kutyapti!',
    open: '▶ Doʻkonni ochish',
  },
  pt: {
    friends: (rank, total) => `🏅 Entre amigos: ${rank}º lugar de ${total}`,
    duelWon: (name, mine, theirs) => `⚔️ Duelo: vitória sobre ${name} e Cia. (${mine} contra ${theirs})`,
    duelLost: (name, mine, theirs) => `⚔️ Duelo: ${name} e Cia. na frente (${theirs} contra ${mine}) — revanche nesta semana!`,
    guildReached: (guild) => `🛡 Guilda “${guild}”: meta da semana cumprida — o prêmio está esperando no jogo`,
    guildMissed: (guild) => `🛡 Guilda “${guild}”: faltou pouco para a meta — nesta semana a gente consegue!`,
    weekend: (rank, players) => `🛍 Black Friday: ${rank}º lugar de ${players} — o prêmio está esperando no jogo`,
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
  // Дуэль недели.
  let duelWon: boolean | undefined;
  const duel = await db.prepare('SELECT rival FROM duels WHERE id = ? AND week = ?').bind(id, week).first<{ rival: number }>();
  if (duel) {
    const theirs = await weekRevenue(db, duel.rival, week);
    const name = esc(await nameOf(db, duel.rival));
    duelWon = revenue > theirs;
    lines.push((duelWon ? t.duelWon : t.duelLost)(name, fmt(revenue), fmt(theirs)));
  }
  // Гильдия.
  const g = await guildOf(db, id);
  if (g) {
    const gname = esc(g.name);
    const reached = await lastResult(db, g.id, week);
    if (reached !== null) lines.push(reached ? t.guildReached(gname) : t.guildMissed(gname));
  }
  // «Чёрная пятница района».
  const w = await standing(db, id, week);
  if (w.rank) {
    const { players } = await summary(db, week);
    lines.push(t.weekend(w.rank, players));
  }
  const change = prev > 0 ? Math.round(((revenue - prev) / prev) * 100) : null;
  const trend = change === null ? '' : change >= 0 ? ` (▲ ${change}%)` : ` (▼ ${-change}%)`;
  return [
    t.title(weekDates(week)),
    '',
    `<b>${headline(lang, { revenue, prev, duelWon, rank, friends: friends.length, weekendRank: w.rank })}</b>`,
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
