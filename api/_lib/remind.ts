// Напоминания от бота: раз в час cron (wrangler.jsonc) смотрит, кто не заходил почти сутки, и бот
// пишет ему одно сообщение в день — от лица героя, с его портретом и по делу: Соня хочет что-то
// сказать, друг прислал подмогу, сегодня заходит Дед Мороз, ждёт праздничная открытка, бабушкина
// серия гостинцев вот-вот прервётся, товар доживает последний день, выходная распродажа района,
// кассир торгует без хозяина. Поводы игра присылает сама (src/game/comeback.ts → social.ts, saveHooks).
//
// Что ждёт игрока в магазине (src/game/returns.ts → таблица waiting): сосед придёт за отложенным,
// письмо от бабушки или постоянного покупателя, сундучок выручки с суммой. Это и свои поводы, и
// приписка «Ещё ждут: …» к любому другому — напоминание всегда называет конкретное.
//
// Пишем только днём по местному времени игрока (QUIET; пояс присылает игра, неизвестен — Москва).
// Три напоминания без ответа — больше не пишем, пока игрок сам не вернётся. Заблокировал бота —
// не пишем никогда. Картинки — public/promo/remind_<герой>.png, адрес — от APP_URL (у cron нет запроса).

import { activeEvent, addDays, cardOf, dateAt, daysBetween, guestOn, type GuestId, type LiveEvent } from '../../src/game/live.js';
import { liveEventsFor } from './live.js';
import { ready } from './social.js';
import { bot, type Env } from './telegram.js';
import { langOf, type Lang } from './lang.js';
import { isWeekend } from './week.js';

const HOUR = 3600_000;
/** Не заходил столько — напомнить; не чаще раза в REMIND_EVERY; не больше MAX_MISSES подряд. */
export const IDLE_AFTER = 20 * HOUR;
export const REMIND_EVERY = 22 * HOUR;
export const MAX_MISSES = 3;
/** Пишем только днём по местному времени игрока: с 10:00 до 21:00. */
export const QUIET = { from: 10, to: 21 };
/** Пояс игрока, если игра его ещё не присылала: Москва (UTC+3), как было до местного времени. */
export const DEFAULT_TZ = 180;
/** За один запуск cron — не больше стольких сообщений. */
const BATCH = 200;

/** Минуты дня по местному времени игрока. */
export const localMinutes = (now: number, tz: number): number => (((Math.floor(now / 60_000) + tz) % 1440) + 1440) % 1440;
/** Сейчас у игрока день (можно писать). */
export const daytime = (now: number, tz: number): boolean => {
  const m = localMinutes(now, tz);
  return m >= QUIET.from * 60 && m < QUIET.to * 60;
};

export type Reason = 'sonya' | 'helped' | 'guest' | 'card' | 'gift' | 'order' | 'letter' | 'chest' | 'spoil' | 'weekend' | 'cashier' | 'day';
export type Face = 'sonya' | 'grandma' | 'valya' | 'anchor' | GuestId;

/** Что известно об игроке для напоминания: поводы из игры (hooks) и что знает сервер. */
export interface Player {
  id: number;
  lang: Lang;
  tz: number;
  sonya: number;
  spoil: number;
  streak: number;
  gift: string;
  cashier: number;
  day: number;
  /** О чём писали в прошлый раз — второй раз подряд о том же не пишем, если есть другой повод. */
  reason: string | null;
  /** Имя друга, чья подмога ещё не забрана (share.ts). */
  helper: string | null;
  /** Сколько примерно в сундучке выручки (уже округлено игрой). */
  chest?: number;
  /** От кого ждёт письмо (returns.ts LetterFrom). */
  letter?: string;
  /** Кто придёт за отложенным и за чем: «petr:bread», и сколько штук. */
  order?: string;
  qty?: number;
}

export interface Reminder {
  reason: Reason;
  face: Face;
  text: string;
}

/** Дней в серии бабушкиных гостинцев (как GIFT_DAYS в src/game/gift.ts: тот тянет за собой всю экономику). */
const GIFT_DAYS = 7;
const DAY_NAMES: Record<Lang, string[]> = {
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  tr: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  kk: ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'],
  uz: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
  pt: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
};
/** Дата словами: «5 декабря», «December 5», «5 Aralık», «5 de diciembre», «5 желтоқсан», «5-dekabr», «5 de dezembro». */
const DAY_FORMAT: Record<Lang, (d: number, month: string) => string> = {
  ru: (d, month) => `${d} ${month}`,
  en: (d, month) => `${month} ${d}`,
  tr: (d, month) => `${d} ${month}`,
  es: (d, month) => `${d} de ${month}`,
  kk: (d, month) => `${d} ${month}`,
  uz: (d, month) => `${d}-${month}`,
  pt: (d, month) => `${d} de ${month}`,
};
const dayName = (date: string, lang: Lang): string => DAY_FORMAT[lang](Number(date.slice(8)), DAY_NAMES[lang][Number(date.slice(5, 7)) - 1]);

/** Тексты от лица героев. В {…} — подстановки. */
export const TEXTS: Record<Lang, Record<string, string>> = {
  ru: {
    sonya: '👧 Соня: «Пап, ты сегодня зайдёшь в магазин? Я хотела тебе кое-что сказать…»',
    helped: '👵 Бабушка: «Внучек, {name} прислал тебе подмогу! Заходи — сегодня касса будет пробивать быстрее»',
    'guest.moroz': '🎅 Дед Мороз: «Хо-хо! Сегодня загляну в твой магазинчик с подарком — открывайся, не проспи!»',
    'guest.snegurochka': '❄️ Снегурочка: «Сегодня я загляну к тебе в магазин с подарком. Жди меня!»',
    'card.newyear': '🎄 Снегурочка: «Открытка на {date} уже ждёт тебя в магазинчике. До Нового года — {left}!»',
    'card.newyear.eve': '🎆 Снегурочка: «Сегодня последний день года! Открытка уже ждёт тебя в магазинчике. С наступающим!»',
    'card.newyear.jan': '🎄 Снегурочка: «С Новым годом! Открытка на {date} ждёт тебя в магазинчике»',
    'card.feb23': '🎖 Бабушка: «Внучек, с праздником! В магазине тебя ждёт открытка к 23 Февраля»',
    'card.march8': '🌷 Валентина: «С праздником весны! В магазинчике тебя ждёт открытка — и мимоза»',
    gift: '👵 Бабушка: «Внучек, гостинец уже собран — день {n} из 7! Загляни сегодня, а то серия начнётся сначала»',
    'gift.big': '👵 Бабушка: «Внучек, шесть дней подряд заходил — сегодня самый большой гостинец! Не пропусти»',
    spoil: '🧓 Валентина: «Слышала, у тебя {n} шт. товара доживают последний день. Уцени, пока не пропали!»',
    weekend: '📺 Новости района: «Выходные! В турнире района каждая монета сейчас идёт в очки в полтора раза. Самое время обогнать соседей»',
    cashier: '👵 Бабушка: «Кассир торгует без тебя, но полки пустеют. Заглянул бы, закупил товара»',
    day: '👵 Бабушка: «День {day}: у дверей уже собрались покупатели. Открываем?»',
    'day.0': '👵 Бабушкин гостинец уже ждёт! Загляни в магазинчик — покупатели скучают.',
    order: '🧓 Валентина: «Встретила {who} — спрашивает про свой заказ: {item}, {qty} шт. Ты же обещал отложить!»',
    letter: '👵 Бабушка: «Внучек, тебе письмо от {from}! Лежит у кассы, ждёт»',
    'letter.grandma': '👵 Бабушка: «Внучек, я тебе письмо написала — и кое-что в него вложила. Загляни!»',
    'letter.sonya': '👧 Соня: «Пап, я тебе открытку нарисовала! Она в магазине, у кассы»',
    chest: '👵 Бабушка: «Сундучок выручки уже тяжёленький — около {sum} 💰. Загляни, открой!»',
    also: 'Ещё ждут: {list}',
    'also.order': 'заказ для {who}',
    'also.letter': 'письмо от {from}',
    'also.chest': 'сундучок ≈{sum} 💰',
    play: '▶ Играть',
  },
  en: {
    sonya: '👧 Sonya: "Dad, will you come by the shop today? I wanted to tell you something…"',
    helped: '👵 Grandma: "Dear, {name} sent you help! Drop by — the till will ring faster today"',
    'guest.moroz': '🎅 Grandfather Frost: "Ho-ho! I\'ll drop by your shop today with a present — be open!"',
    'guest.snegurochka': '❄️ Snow Maiden: "I\'ll visit your shop today with a present. Wait for me!"',
    'card.newyear': '🎄 Snow Maiden: "Your card for {date} is waiting in the shop. {left} to New Year!"',
    'card.newyear.eve': '🎆 Snow Maiden: "It\'s the last day of the year! Your card is waiting in the shop. Happy New Year!"',
    'card.newyear.jan': '🎄 Snow Maiden: "Happy New Year! Your card for {date} is waiting in the shop"',
    'card.feb23': '🎖 Grandma: "Dear, happy holiday! A February 23rd card is waiting for you in the shop"',
    'card.march8': '🌷 Valentina: "Happy spring holiday! A card is waiting for you in the shop — with mimosa"',
    gift: '👵 Grandma: "Dear, your gift is ready — day {n} of 7! Come today, or the streak starts over"',
    'gift.big': '👵 Grandma: "Dear, six days in a row — today is the biggest gift! Don\'t miss it"',
    spoil: '🧓 Valentina: "I heard {n} items in your shop are on their last day. Mark them down before they spoil!"',
    weekend: '📺 District news: "It\'s the weekend! Every coin counts 1.5× in the district tournament right now. Time to overtake the neighbours"',
    cashier: '👵 Grandma: "Your cashier is trading without you, but the shelves are emptying. Come restock"',
    day: '👵 Grandma: "Day {day}: customers are already at the door. Shall we open?"',
    'day.0': "👵 Grandma's gift is waiting! Drop by the shop — the customers miss you.",
    order: '🧓 Valentina: "I ran into {who} — asking about the order: {item}, {qty} pcs. You promised to put it aside!"',
    letter: '👵 Grandma: "Dear, there\'s a letter for you from {from}! It\'s waiting by the till"',
    'letter.grandma': '👵 Grandma: "Dear, I wrote you a letter — and tucked a little something inside. Drop by!"',
    'letter.sonya': '👧 Sonya: "Dad, I drew you a card! It\'s in the shop, by the till"',
    chest: '👵 Grandma: "The takings chest is getting heavy — about {sum} 💰. Come open it!"',
    also: 'Also waiting: {list}',
    'also.order': "{who}'s order",
    'also.letter': 'a letter from {from}',
    'also.chest': 'the chest ≈{sum} 💰',
    play: '▶ Play',
  },
  tr: {
    sonya: '👧 Sonya: “Baba, bugün dükkâna uğrayacak mısın? Sana bir şey söylemek istiyordum…”',
    helped: '👵 Nine: “Yavrum, {name} sana yardım gönderdi! Uğra — bugün kasa daha hızlı çalışacak”',
    'guest.moroz': '🎅 Ayaz Dede: “Ho-ho! Bugün dükkânına hediyeyle uğrayacağım — açık ol, uyuya kalma!”',
    'guest.snegurochka': '❄️ Kar Kızı: “Bugün dükkânına hediyeyle uğrayacağım. Beni bekle!”',
    'card.newyear': '🎄 Kar Kızı: “{date} kartın dükkânda seni bekliyor. Yılbaşına {left} kaldı!”',
    'card.newyear.eve': '🎆 Kar Kızı: “Bugün yılın son günü! Kartın dükkânda seni bekliyor. Yeni yılın şimdiden kutlu olsun!”',
    'card.newyear.jan': '🎄 Kar Kızı: “Mutlu yıllar! {date} kartın dükkânda seni bekliyor”',
    'card.feb23': '🎖 Nine: “Yavrum, bayramın kutlu olsun! Dükkânda seni 23 Şubat kartı bekliyor”',
    'card.march8': '🌷 Valentina: “Bahar bayramın kutlu olsun! Dükkânda seni bir kart bekliyor — bir de mimoza”',
    gift: '👵 Nine: “Yavrum, hediyen hazır — 7 günün {n}. günü! Bugün uğra, yoksa seri baştan başlar”',
    'gift.big': '👵 Nine: “Yavrum, altı gündür üst üste geliyorsun — bugün en büyük hediye seni bekliyor! Kaçırma”',
    spoil: '🧓 Valentina: “Duydum ki dükkânında {n} ürünün son günüymüş. Bozulmadan indirime koy!”',
    weekend: '📺 Mahalle haberleri: “Hafta sonu geldi! Mahalle turnuvasında şu an her para 1,5 kat puan. Komşuları geçmenin tam zamanı”',
    cashier: '👵 Nine: “Kasiyer sensiz satış yapıyor ama raflar boşalıyor. Bir uğra da mal al”',
    day: '👵 Nine: “{day}. gün: kapıda müşteriler toplandı bile. Açıyor muyuz?”',
    'day.0': '👵 Ninenin hediyesi seni bekliyor! Dükkâna uğra — müşteriler seni özledi.',
    order: '🧓 Valentina: “{who} ile karşılaştım — siparişini soruyor: {item}, {qty} adet. Ayıracağına söz vermiştin!”',
    letter: '👵 Nine: “Yavrum, {from} sana mektup göndermiş! Kasanın yanında seni bekliyor”',
    'letter.grandma': '👵 Nine: “Yavrum, sana bir mektup yazdım — içine de küçük bir şey koydum. Uğra!”',
    'letter.sonya': '👧 Sonya: “Baba, sana bir kart çizdim! Dükkânda, kasanın yanında”',
    chest: '👵 Nine: “Hasılat sandığı ağırlaştı — yaklaşık {sum} 💰. Gel de aç!”',
    also: 'Seni bekleyenler: {list}',
    'also.order': '{who} için sipariş',
    'also.letter': 'mektup: {from}',
    'also.chest': 'sandık ≈{sum} 💰',
    play: '▶ Oyna',
  },
  es: {
    sonya: '👧 Sonia: “Papá, ¿vas a pasar hoy por la tienda? Quería decirte algo…”',
    helped: '👵 La abuela: “Cariño, ¡{name} te mandó ayuda! Pásate: hoy la caja cobrará más rápido”',
    'guest.moroz': '🎅 El Abuelo Frío: “¡Jo, jo, jo! Hoy paso por tu tienda con un regalo. ¡Ten todo abierto y no te quedes dormido!”',
    'guest.snegurochka': '❄️ La Doncella de Nieve: “Hoy paso por tu tienda con un regalo. ¡Espérame!”',
    'card.newyear': '🎄 La Doncella de Nieve: “Tu tarjeta del {date} te espera en la tienda. ¡Faltan {left} para Año Nuevo!”',
    'card.newyear.eve': '🎆 La Doncella de Nieve: “¡Es el último día del año! Tu tarjeta te espera en la tienda. ¡Feliz Año Nuevo!”',
    'card.newyear.jan': '🎄 La Doncella de Nieve: “¡Feliz Año Nuevo! Tu tarjeta del {date} te espera en la tienda”',
    'card.feb23': '🎖 La abuela: “Cariño, ¡feliz día! En la tienda te espera una tarjeta por el 23 de febrero”',
    'card.march8': '🌷 Valentina: “¡Feliz fiesta de la primavera! En la tienda te espera una tarjeta… y mimosas”',
    gift: '👵 La abuela: “Cariño, tu regalo ya está listo: ¡día {n} de 7! Pásate hoy o la racha empieza de nuevo”',
    'gift.big': '👵 La abuela: “Cariño, seis días seguidos: ¡hoy toca el regalo más grande! No te lo pierdas”',
    spoil: '🧓 Valentina: “Me contaron que tienes mercancía en su último día: {n} uds. ¡Rebájala antes de que se eche a perder!”',
    weekend: '📺 Noticias del barrio: “¡Es fin de semana! En el torneo del barrio cada moneda vale 1,5 veces en puntos. Es el momento de adelantar a los vecinos”',
    cashier: '👵 La abuela: “Tu cajero vende sin ti, pero los estantes se están vaciando. Pásate a reponer”',
    day: '👵 La abuela: “Día {day}: ya hay clientes en la puerta. ¿Abrimos?”',
    'day.0': '👵 ¡El regalo de la abuela te espera! Pásate por la tienda: los clientes te extrañan.',
    order: '🧓 Valentina: “Me encontré con {who} y me preguntó por su pedido: {item}, {qty} uds. ¡Prometiste apartarlo!”',
    letter: '👵 La abuela: “Cariño, ¡te llegó una carta de {from}! Te espera junto a la caja”',
    'letter.grandma': '👵 La abuela: “Cariño, te escribí una carta… y metí algo adentro. ¡Pásate!”',
    'letter.sonya': '👧 Sonia: “Papá, ¡te dibujé una tarjeta! Está en la tienda, junto a la caja”',
    chest: '👵 La abuela: “El cofre de las ganancias ya pesa: unas {sum} 💰. ¡Ven a abrirlo!”',
    also: 'También te esperan: {list}',
    'also.order': 'el pedido de {who}',
    'also.letter': 'una carta de {from}',
    'also.chest': 'el cofre ≈{sum} 💰',
    play: '▶ Jugar',
  },
  // Имена в {who}/{from} уже в нужном падеже (PEOPLE.kk): who — табыс («кімді»), from — шығыс («кімнен»).
  kk: {
    sonya: '👧 Соня: «Әке, бүгін дүкенге соғасың ба? Саған бір нәрсе айтайын деп едім…»',
    helped: '👵 Әже: «Балам, саған көмек келді — жіберген: {name}! Кір — бүгін касса тезірек жұмыс істейді»',
    'guest.moroz': '🎅 Аяз Ата: «Хо-хо! Бүгін дүкеніңе сыйлықпен соғамын — ашық бол, ұйықтап қалма!»',
    'guest.snegurochka': '❄️ Ақшақар: «Бүгін дүкеніңе сыйлықпен келемін. Мені күт!»',
    'card.newyear': '🎄 Ақшақар: «Ашықхат ({date}) дүкенде сені күтіп тұр. Жаңа жылға дейін — {left}!»',
    'card.newyear.eve': '🎆 Ақшақар: «Бүгін жылдың соңғы күні! Ашықхат дүкенде сені күтіп тұр. Жаңа жылың құтты болсын!»',
    'card.newyear.jan': '🎄 Ақшақар: «Жаңа жылың құтты болсын! Ашықхат ({date}) дүкенде сені күтіп тұр»',
    'card.feb23': '🎖 Әже: «Балам, мерекең құтты болсын! Дүкенде сені 23 ақпанға арналған ашықхат күтіп тұр»',
    'card.march8': '🌷 Валентина: «Көктем мерекесі құтты болсын! Дүкенде сені ашықхат күтіп тұр — мимозамен бірге»',
    gift: '👵 Әже: «Балам, сәлемдеме дайын — 7 күннің {n}-күні! Бүгін соқ, әйтпесе серия басынан басталады»',
    'gift.big': '👵 Әже: «Балам, алты күн қатарынан келдің — бүгін ең үлкен сәлемдеме! Өткізіп алма»',
    spoil: '🧓 Валентина: «Естідім, дүкеніңде {n} дана тауардың соңғы күні екен. Бүлінбей тұрғанда бағасын түсір!»',
    weekend: '📺 Аудан жаңалықтары: «Демалыс! Аудан турнирінде қазір әр тиын 1,5 есе ұпай береді. Көршілерді озатын кез»',
    cashier: '👵 Әже: «Кассир сенсіз сатып жатыр, бірақ сөрелер босап барады. Соғып, тауар сатып алсаң етті»',
    day: '👵 Әже: «{day}-күн: есік алдында сатып алушылар жиналып қалды. Ашамыз ба?»',
    'day.0': '👵 Әженің сәлемдемесі күтіп тұр! Дүкенге соқ — сатып алушылар сағынды.',
    order: '🧓 Валентина: «{who} кездестірдім — тапсырысын сұрап жатыр: {item}, {qty} дана. Сақтап қоямын деп уәде бергенсің ғой!»',
    letter: '👵 Әже: «Балам, саған хат бар — {from}! Кассаның жанында жатыр»',
    'letter.grandma': '👵 Әже: «Балам, саған хат жаздым — ішіне бір нәрсе де салдым. Соқ!»',
    'letter.sonya': '👧 Соня: «Әке, саған ашықхат салдым! Ол дүкенде, кассаның жанында»',
    chest: '👵 Әже: «Түсім сандықшасы ауырлап қалды — шамамен {sum} 💰. Кел, аш!»',
    also: 'Тағы күтіп тұр: {list}',
    'also.order': 'тапсырыс — {who}',
    'also.letter': 'хат — {from}',
    'also.chest': 'сандықша ≈{sum} 💰',
    play: '▶ Ойнау',
  },
  uz: {
    sonya: '👧 Sonya: «Dada, bugun doʻkonga kirasanmi? Senga bir gap aytmoqchi edim…»',
    helped: '👵 Buvi: «Nevaram, {name} senga yordam yubordi! Kirib oʻt — bugun kassa tezroq ishlaydi»',
    'guest.moroz': '🎅 Qor bobo: «Xo-xo! Bugun doʻkonchangga sovgʻa bilan kiraman — ochiq tur, uxlab qolma!»',
    'guest.snegurochka': '❄️ Qorqiz: «Bugun doʻkoningga sovgʻa bilan kiraman. Meni kut!»',
    'card.newyear': '🎄 Qorqiz: «{date} otkritkang doʻkonchada seni kutyapti. Yangi yilgacha — {left}!»',
    'card.newyear.eve': '🎆 Qorqiz: «Bugun yilning oxirgi kuni! Otkritkang doʻkonchada kutyapti. Yangi yiling muborak!»',
    'card.newyear.jan': '🎄 Qorqiz: «Yangi yil muborak! {date} otkritkang doʻkonchada seni kutyapti»',
    'card.feb23': '🎖 Buvi: «Nevaram, bayraming muborak! Doʻkonda seni 23-fevral otkritkasi kutyapti»',
    'card.march8': '🌷 Valentina: «Bahor bayrami muborak! Doʻkonchada seni otkritka kutyapti — mimoza bilan»',
    gift: '👵 Buvi: «Nevaram, sovgʻa tayyor — 7 kundan {n}-kun! Bugun kir, boʻlmasa seriya boshidan boshlanadi»',
    'gift.big': '👵 Buvi: «Nevaram, olti kun ketma-ket kelding — bugun eng katta sovgʻa! Qoʻldan boy berma»',
    spoil: '🧓 Valentina: «Eshitdim, doʻkoningda {n} ta mahsulotning oxirgi kuni ekan. Buzilmasidan arzonlashtir!»',
    weekend: '📺 Mahalla yangiliklari: «Dam olish kunlari! Mahalla turnirida hozir har bir tanga 1,5 barobar ochko beradi. Qoʻshnilardan oʻzib ketish vaqti»',
    cashier: '👵 Buvi: «Kassir sensiz savdo qilyapti, lekin javonlar boʻshab qolyapti. Kirib, mol xarid qilsang boʻlardi»',
    day: '👵 Buvi: «{day}-kun: eshik oldida xaridorlar yigʻilib qoldi. Ochamizmi?»',
    'day.0': '👵 Buvining sovgʻasi kutyapti! Doʻkonchaga kir — xaridorlar seni sogʻinishdi.',
    order: '🧓 Valentina: «Yoʻlda {who} uchradi — buyurtmasini soʻrayapti: {item}, {qty} ta. Olib qoʻyaman degan eding-ku!»',
    letter: '👵 Buvi: «Nevaram, senga {from} xat keldi! Kassa yonida kutyapti»',
    'letter.grandma': '👵 Buvi: «Nevaram, senga xat yozdim — ichiga bir narsa ham solib qoʻydim. Kirib oʻt!»',
    'letter.sonya': '👧 Sonya: «Dada, senga otkritka chizdim! U doʻkonda, kassa yonida»',
    chest: '👵 Buvi: «Tushum sandiqchasi ogʻirlashib qoldi — taxminan {sum} 💰. Kelib och!»',
    also: 'Yana kutyapti: {list}',
    'also.order': '{who} buyurtma',
    'also.letter': '{from} xat',
    'also.chest': 'sandiqcha ≈{sum} 💰',
    play: '▶ Oʻynash',
  },
  pt: {
    sonya: '👧 Sônia: “Pai, você vai passar na loja hoje? Eu queria te contar uma coisa…”',
    helped: '👵 Vovó: “Querido, {name} te mandou uma ajuda! Passe aqui — hoje o caixa vai atender mais rápido”',
    'guest.moroz': '🎅 Ded Moroz: “Ho-ho-ho! Hoje vou passar na sua lojinha com um presente — abra cedo, não perca a hora!”',
    'guest.snegurochka': '❄️ Snegurochka: “Hoje vou passar na sua loja com um presente. Me espere!”',
    'card.newyear': '🎄 Snegurochka: “Seu cartão de {date} está esperando na lojinha. Faltam {left} para o Ano-Novo!”',
    'card.newyear.eve': '🎆 Snegurochka: “Hoje é o último dia do ano! Seu cartão está esperando na lojinha. Feliz Ano-Novo!”',
    'card.newyear.jan': '🎄 Snegurochka: “Feliz Ano-Novo! Seu cartão de {date} está esperando na lojinha”',
    'card.feb23': '🎖 Vovó: “Querido, feliz dia! Tem um cartão do 23 de Fevereiro esperando por você na loja”',
    'card.march8': '🌷 Valentina: “Feliz festa da primavera! Tem um cartão esperando por você na lojinha — e mimosas”',
    gift: '👵 Vovó: “Querido, seu mimo já está pronto — dia {n} de 7! Passe hoje, senão a sequência recomeça”',
    'gift.big': '👵 Vovó: “Querido, seis dias seguidos — hoje é o maior mimo de todos! Não perca”',
    spoil: '🧓 Valentina: “Fiquei sabendo que {n} un. de mercadoria estão no último dia. Faça um desconto antes que estraguem!”',
    weekend: '📺 Notícias do bairro: “É fim de semana! No torneio do bairro cada moeda vale 1,5 vez em pontos. Hora de passar os vizinhos”',
    cashier: '👵 Vovó: “O caixa está vendendo sem você, mas as prateleiras estão esvaziando. Passe aqui para repor”',
    day: '👵 Vovó: “Dia {day}: já tem clientes na porta. Vamos abrir?”',
    'day.0': '👵 O mimo da vovó está esperando! Passe na lojinha — os clientes estão com saudade.',
    order: '🧓 Valentina: “Encontrei {who} — perguntou da encomenda: {item}, {qty} un. Você prometeu separar!”',
    letter: '👵 Vovó: “Querido, chegou uma carta {from} para você! Está esperando no caixa”',
    'letter.grandma': '👵 Vovó: “Querido, escrevi uma carta para você — e coloquei uma coisinha dentro. Passe aqui!”',
    'letter.sonya': '👧 Sônia: “Pai, desenhei um cartão para você! Está na loja, ao lado do caixa”',
    chest: '👵 Vovó: “O baú do faturamento já está pesadinho — umas {sum} 💰. Venha abrir!”',
    also: 'Também esperando: {list}',
    'also.order': 'encomenda {who}',
    'also.letter': 'carta {from}',
    'also.chest': 'baú ≈{sum} 💰',
    play: '▶ Jogar',
  },
};

const fill = (text: string, params: Record<string, string | number>): string => text.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ''));

/**
 * Кто пишет письма и приходит за заказом (src/game/regulars.ts, returns.ts): имя «от кого» (родительный
 * падеж) и «встретила кого» (винительный). Неизвестная метка — повода нет.
 * По-португальски «от кого» — сразу с предлогом и артиклем («da vovó», «do Misha»), «кого» — с артиклем.
 */
export const PEOPLE: Record<Lang, Record<string, { from: string; who: string }>> = {
  ru: {
    grandma: { from: 'бабушки', who: 'бабушку' },
    valya: { from: 'Валентины', who: 'Валентину' },
    sonya: { from: 'Сони', who: 'Соню' },
    petr: { from: 'Петра Ильича', who: 'Петра Ильича' },
    sveta: { from: 'Светы', who: 'Свету' },
    kostya: { from: 'Кости', who: 'Костю' },
    akhmed: { from: 'Ахмеда', who: 'Ахмеда' },
    olga: { from: 'Ольги Николаевны', who: 'Ольгу Николаевну' },
    misha: { from: 'Миши', who: 'Мишу' },
    // Прощальное письмо ушедшего сотрудника (src/game/career.ts).
    staff: { from: 'бывшего сотрудника', who: 'бывшего сотрудника' },
  },
  en: {
    grandma: { from: 'Grandma', who: 'Grandma' },
    valya: { from: 'Valentina', who: 'Valentina' },
    sonya: { from: 'Sonya', who: 'Sonya' },
    petr: { from: 'Pyotr Ilyich', who: 'Pyotr Ilyich' },
    sveta: { from: 'Sveta', who: 'Sveta' },
    kostya: { from: 'Kostya', who: 'Kostya' },
    akhmed: { from: 'Akhmed', who: 'Akhmed' },
    olga: { from: 'Olga Nikolaevna', who: 'Olga Nikolaevna' },
    misha: { from: 'Misha', who: 'Misha' },
    staff: { from: 'a former employee', who: 'a former employee' },
  },
  tr: {
    grandma: { from: 'Nine', who: 'Nine' },
    valya: { from: 'Valentina', who: 'Valentina' },
    sonya: { from: 'Sonya', who: 'Sonya' },
    petr: { from: 'Pyotr Ilyich', who: 'Pyotr Ilyich' },
    sveta: { from: 'Sveta', who: 'Sveta' },
    kostya: { from: 'Kostya', who: 'Kostya' },
    akhmed: { from: 'Akhmed', who: 'Akhmed' },
    olga: { from: 'Olga Nikolaevna', who: 'Olga Nikolaevna' },
    misha: { from: 'Misha', who: 'Misha' },
    staff: { from: 'eski bir çalışan', who: 'eski bir çalışanı' },
  },
  es: {
    grandma: { from: 'la abuela', who: 'la abuela' },
    valya: { from: 'Valentina', who: 'Valentina' },
    sonya: { from: 'Sonia', who: 'Sonia' },
    petr: { from: 'Piotr Ilich', who: 'Piotr Ilich' },
    sveta: { from: 'Sveta', who: 'Sveta' },
    kostya: { from: 'Kostia', who: 'Kostia' },
    akhmed: { from: 'Ajmed', who: 'Ajmed' },
    olga: { from: 'Olga Nikoláyevna', who: 'Olga Nikoláyevna' },
    misha: { from: 'Misha', who: 'Misha' },
    staff: { from: 'un antiguo empleado', who: 'a un antiguo empleado' },
  },
  // Казахский: from — шығыс септік («кімнен»: хат — әжеден), who — табыс септік («кімді»: әжені кездестірдім).
  kk: {
    grandma: { from: 'әжеден', who: 'Әжені' },
    valya: { from: 'Валентинадан', who: 'Валентинаны' },
    sonya: { from: 'Сонядан', who: 'Соняны' },
    petr: { from: 'Пётр Ильичтен', who: 'Пётр Ильичті' },
    sveta: { from: 'Светадан', who: 'Светаны' },
    kostya: { from: 'Костядан', who: 'Костяны' },
    akhmed: { from: 'Ахмедтен', who: 'Ахмедті' },
    olga: { from: 'Ольга Николаевнадан', who: 'Ольга Николаевнаны' },
    misha: { from: 'Мишадан', who: 'Мишаны' },
    staff: { from: 'бұрынғы қызметкерден', who: 'Бұрынғы қызметкерді' },
  },
  // По-узбекски имя стоит без падежного окончания: тексты построены так, чтобы оно не требовалось.
  uz: {
    grandma: { from: 'buvidan', who: 'buvi' },
    valya: { from: 'Valentinadan', who: 'Valentina' },
    sonya: { from: 'Sonyadan', who: 'Sonya' },
    petr: { from: 'Pyotr Ilichdan', who: 'Pyotr Ilich' },
    sveta: { from: 'Svetadan', who: 'Sveta' },
    kostya: { from: 'Kostyadan', who: 'Kostya' },
    akhmed: { from: 'Axmeddan', who: 'Axmed' },
    olga: { from: 'Olga Nikolayevnadan', who: 'Olga Nikolayevna' },
    misha: { from: 'Mishadan', who: 'Misha' },
    staff: { from: 'sobiq xodimdan', who: 'sobiq xodim' },
  },
  pt: {
    grandma: { from: 'da vovó', who: 'a vovó' },
    valya: { from: 'da Valentina', who: 'a Valentina' },
    sonya: { from: 'da Sônia', who: 'a Sônia' },
    petr: { from: 'do Piotr Ilitch', who: 'o Piotr Ilitch' },
    sveta: { from: 'da Sveta', who: 'a Sveta' },
    kostya: { from: 'do Kostia', who: 'o Kostia' },
    akhmed: { from: 'do Akhmed', who: 'o Akhmed' },
    olga: { from: 'da Olga Nikoláievna', who: 'a Olga Nikoláievna' },
    misha: { from: 'do Misha', who: 'o Misha' },
    staff: { from: 'de um ex-funcionário', who: 'um ex-funcionário' },
  },
};
/** Любимые товары постоянных покупателей — то, что они просят отложить. */
export const ITEMS: Record<Lang, Record<string, string>> = {
  ru: { bread: '🍞 хлеб', milk: '🥛 молоко', potatoes: '🥔 картошка', meat: '🥩 мясо', apples: '🍎 яблоки', juice: '🧃 сок' },
  en: { bread: '🍞 bread', milk: '🥛 milk', potatoes: '🥔 potatoes', meat: '🥩 meat', apples: '🍎 apples', juice: '🧃 juice' },
  tr: { bread: '🍞 ekmek', milk: '🥛 süt', potatoes: '🥔 patates', meat: '🥩 et', apples: '🍎 elma', juice: '🧃 meyve suyu' },
  es: { bread: '🍞 pan', milk: '🥛 leche', potatoes: '🥔 papas', meat: '🥩 carne', apples: '🍎 manzanas', juice: '🧃 jugo' },
  kk: { bread: '🍞 нан', milk: '🥛 сүт', potatoes: '🥔 картоп', meat: '🥩 ет', apples: '🍎 алма', juice: '🧃 шырын' },
  uz: { bread: '🍞 non', milk: '🥛 sut', potatoes: '🥔 kartoshka', meat: '🥩 goʻsht', apples: '🍎 olma', juice: '🧃 sharbat' },
  pt: { bread: '🍞 pão', milk: '🥛 leite', potatoes: '🥔 batatas', meat: '🥩 carne', apples: '🍎 maçãs', juice: '🧃 suco' },
};
/** Товар без названия (метка из игры, которой нет в ITEMS). */
const GOODS: Record<Lang, string> = { ru: 'товар', en: 'goods', tr: 'ürün', es: 'mercancía', kk: 'тауар', uz: 'mahsulot', pt: 'mercadoria' };
/** Своё поле словаря (не «constructor» из прототипа): метки приходят от игры. */
const own = <T>(table: Record<string, T>, key: string): T | undefined => (Object.hasOwn(table, key) ? table[key] : undefined);
/** Сундучок меньше этого — не повод писать (кассир едва начал торговать). */
export const CHEST_MIN = 100;

/**
 * Сумма с разрядами: «1 200» (неразрывный пробел) или «1,200» (en). По-турецки и по-испански
 * «1,200» читается как дробь — у них разряды пробелом, как у нас.
 */
export const money = (n: number, lang: Lang): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'en' ? ',' : '\u00a0');

/** Что ждёт в магазине — по отдельности: повод, текст, и короткая строка для приписки «Ещё ждут». */
function waiting(p: Player): { reason: Reason; face: Face; text: string; short: string }[] {
  const lang = p.lang;
  const t = TEXTS[lang];
  const out: { reason: Reason; face: Face; text: string; short: string }[] = [];
  const [whoId, pid] = (p.order ?? '').split(':');
  const who = own(PEOPLE[lang], whoId ?? '');
  if (who && pid && (p.qty ?? 0) > 0) {
    const item = own(ITEMS[lang], pid) ?? GOODS[lang];
    out.push({ reason: 'order', face: 'valya', text: fill(t.order, { who: who.who, item, qty: p.qty ?? 0 }), short: fill(t['also.order'], { who: who.from }) });
  }
  const from = p.letter ? own(PEOPLE[lang], p.letter) : undefined;
  if (from) {
    const key = p.letter === 'grandma' ? 'letter.grandma' : p.letter === 'sonya' ? 'letter.sonya' : 'letter';
    out.push({ reason: 'letter', face: p.letter === 'sonya' ? 'sonya' : 'grandma', text: fill(t[key], { from: from.from }), short: fill(t['also.letter'], { from: from.from }) });
  }
  if ((p.chest ?? 0) >= CHEST_MIN) {
    const sum = money(p.chest ?? 0, lang);
    out.push({ reason: 'chest', face: 'grandma', text: fill(t.chest, { sum }), short: fill(t['also.chest'], { sum }) });
  }
  return out;
}

/** Сколько дней до Нового года — словами (дата — в декабре). */
function daysLeft(date: string, lang: Lang): string {
  const n = daysBetween(date, `${Number(date.slice(0, 4)) + 1}-01-01`);
  if (lang === 'en') return `${n} day${n === 1 ? '' : 's'}`;
  // По-турецки и по-узбекски после числа — единственное число: «5 gün», «5 kun».
  if (lang === 'tr') return `${n} gün`;
  if (lang === 'uz') return `${n} kun`;
  if (lang === 'es') return `${n} día${n === 1 ? '' : 's'}`;
  // По-казахски тоже: «5 күн».
  if (lang === 'kk') return `${n} күн`;
  if (lang === 'pt') return `${n} dia${n === 1 ? '' : 's'}`;
  const tail = n % 10 === 1 && n % 100 !== 11 ? 'день' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'дня' : 'дней';
  return `${n} ${tail}`;
}

/**
 * Все поводы написать игроку — по важности: Соня, подмога друга, праздничный гость, открытка,
 * серия гостинцев, заказ соседа, письмо, сундучок выручки, порча, выходные, кассир; последний — просто «день N».
 */
export function reasons(p: Player, now: number, events: LiveEvent[]): Reminder[] {
  const lang = p.lang;
  const t = TEXTS[lang];
  const out: Reminder[] = [];
  const date = dateAt(now, p.tz);
  if (p.sonya) out.push({ reason: 'sonya', face: 'sonya', text: t.sonya });
  if (p.helper) out.push({ reason: 'helped', face: 'grandma', text: fill(t.helped, { name: p.helper }) });
  const e = activeEvent(events, date);
  const guest = guestOn(e, date);
  if (guest) out.push({ reason: 'guest', face: guest, text: t[`guest.${guest}`] });
  const card = e ? cardOf(e, date) : null;
  if (e && card) {
    const face: Face = e.theme === 'newyear' ? 'snegurochka' : e.theme === 'march8' ? 'valya' : 'grandma';
    // Новогодняя открытка: в декабре — сколько осталось до праздника, 31-го — канун, в январе — поздравление.
    const month = date.slice(5, 7);
    const key = e.theme !== 'newyear' ? `card.${e.theme}` : date.slice(5) === '12-31' ? 'card.newyear.eve' : month === '12' ? 'card.newyear' : 'card.newyear.jan';
    out.push({ reason: 'card', face, text: fill(t[key], { date: dayName(date, lang), left: month === '12' ? daysLeft(date, lang) : '' }) });
  }
  // Серия гостинцев продолжится, только если зайти сегодня: последний был вчера.
  if (p.gift && p.gift === addDays(date, -1) && p.streak >= 1 && p.streak < GIFT_DAYS) {
    out.push({ reason: 'gift', face: 'grandma', text: p.streak === GIFT_DAYS - 1 ? t['gift.big'] : fill(t.gift, { n: p.streak + 1 }) });
  }
  for (const w of waiting(p)) out.push({ reason: w.reason, face: w.face, text: w.text });
  if (p.spoil > 0) out.push({ reason: 'spoil', face: 'valya', text: fill(t.spoil, { n: p.spoil }) });
  if (isWeekend(now)) out.push({ reason: 'weekend', face: 'anchor', text: t.weekend });
  if (p.cashier) out.push({ reason: 'cashier', face: 'grandma', text: t.cashier });
  out.push({ reason: 'day', face: 'grandma', text: p.day > 1 ? fill(t.day, { day: p.day }) : t['day.0'] });
  return out;
}

/**
 * Повод для напоминания: самый важный, но не тот же, что в прошлый раз (если есть другой).
 * Что ещё ждёт в магазине (заказ, письмо, сундучок) и не стало главным поводом — припиской ниже.
 */
export function pickReminder(p: Player, now: number, events: LiveEvent[]): Reminder {
  const all = reasons(p, now, events);
  const main = all.find((r) => r.reason !== p.reason) ?? all[0];
  const rest = waiting(p).filter((w) => w.reason !== main.reason);
  if (!rest.length) return main;
  return { ...main, text: `${main.text}\n\n${fill(TEXTS[p.lang].also, { list: rest.map((w) => w.short).join(' · ') })}` };
}

/** Картинки уже загружены в Telegram: дальше шлём по file_id — быстро и без лишних скачиваний. */
const photoIds = new Map<string, string>();
export const resetReminderPhotos = (): void => photoIds.clear();

/** Адрес картинки героя на сайте игры (абсолютный: Telegram скачивает её сам). */
export const faceUrl = (app: string, face: Face): string => new URL(`promo/remind_${face}.png`, app).href;

/** Отправить напоминание: картинка с подписью и кнопкой «Играть»; картинка не прошла — просто текстом. */
async function deliver(token: string, app: string, chat: number, r: Reminder, lang: Lang): Promise<void> {
  const reply_markup = app ? { inline_keyboard: [[{ text: TEXTS[lang].play, web_app: { url: app } }]] } : undefined;
  if (app) {
    const url = faceUrl(app, r.face);
    try {
      const sent = await bot<{ photo?: { file_id: string }[] }>(token, 'sendPhoto', { chat_id: chat, photo: photoIds.get(url) ?? url, caption: r.text, reply_markup });
      const id = sent?.photo?.[sent.photo.length - 1]?.file_id;
      if (id) photoIds.set(url, id);
      return;
    } catch (error) {
      // Бот заблокирован — дальше не пробуем; иначе (картинка не скачалась) — текстом.
      if (/blocked|deactivated|chat not found|Forbidden/i.test(String(error))) throw error;
      photoIds.delete(url);
    }
  }
  await bot(token, 'sendMessage', { chat_id: chat, text: r.text, ...(reply_markup ? { reply_markup } : {}) });
}

/** Раз в час (cron): кто давно не заходил и у кого сейчас день — бот пишет одно напоминание. */
export async function sendReminders(env: Env, now = Date.now()): Promise<number> {
  const token = env.BOT_TOKEN ?? '';
  const db = env.DB;
  if (!token || !db) return 0;
  await ready(db);
  // Местное время — прямо в запросе: в пачку попадают только те, у кого сейчас день.
  const minute = (Math.floor(now / 60_000) % 1440) + 1440;
  const { results } = await db
    .prepare(
      `SELECT p.id AS id, p.lang AS lang, p.misses AS misses, h.tz AS tz, h.sonya AS sonya, h.spoil AS spoil, h.streak AS streak, h.gift AS gift,
         h.cashier AS cashier, COALESCE(h.day, pr.day) AS day, h.reason AS reason,
         (SELECT g.name FROM helps hp JOIN progress g ON g.id = hp.helper WHERE hp.receiver = p.id AND hp.claimed = 0 LIMIT 1) AS helper,
         w.chest AS chest, w.letter AS letter, w.ord AS ord, w.qty AS qty
       FROM players p LEFT JOIN hooks h ON h.id = p.id LEFT JOIN progress pr ON pr.id = p.id LEFT JOIN waiting w ON w.id = p.id
       WHERE p.last_seen < ?1 AND (p.reminded_at IS NULL OR p.reminded_at < ?2) AND p.misses < ?3
         AND (?4 + COALESCE(h.tz, ?5)) % 1440 >= ?6 AND (?4 + COALESCE(h.tz, ?5)) % 1440 < ?7
       LIMIT ?8`,
    )
    .bind(now - IDLE_AFTER, now - REMIND_EVERY, MAX_MISSES, minute, DEFAULT_TZ, QUIET.from * 60, QUIET.to * 60, BATCH)
    .all<{ id: number; lang: string; misses: number; tz: number | null; sonya: number | null; spoil: number | null; streak: number | null; gift: string | null; cashier: number | null; day: number | null; reason: string | null; helper: string | null; chest: number | null; letter: string | null; ord: string | null; qty: number | null }>();
  if (!results.length) return 0;
  const app = env.APP_URL ?? '';
  const events = await liveEventsFor(env);
  let sent = 0;
  for (const row of results) {
    // Язык из players (social.ts); старые записи без языка — ru.
    const lang = langOf(row.lang);
    const player: Player = {
      id: row.id,
      lang,
      tz: row.tz ?? DEFAULT_TZ,
      sonya: row.sonya ?? 0,
      spoil: row.spoil ?? 0,
      streak: row.streak ?? 0,
      gift: row.gift ?? '',
      cashier: row.cashier ?? 0,
      day: row.day ?? 0,
      reason: row.reason,
      helper: row.helper && row.helper !== '—' ? row.helper : null,
      chest: row.chest ?? 0,
      letter: row.letter ?? '',
      order: row.ord ?? '',
      qty: row.qty ?? 0,
    };
    // Запрос уже отобрал тех, у кого день; проверка ещё раз — тем же правилом, что в тестах.
    if (!daytime(now, player.tz)) continue;
    const reminder = pickReminder(player, now, events);
    try {
      await deliver(token, app, row.id, reminder, lang);
      await db.prepare('UPDATE players SET reminded_at = ?, misses = misses + 1 WHERE id = ?').bind(now, row.id).run();
      await db.prepare('INSERT INTO hooks (id, reason, updated) VALUES (?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET reason = excluded.reason').bind(row.id, reminder.reason, now).run();
      sent++;
    } catch {
      // Бот заблокирован или чата нет — больше не пишем.
      await db.prepare('UPDATE players SET reminded_at = ?, misses = 99 WHERE id = ?').bind(now, row.id).run();
    }
  }
  return sent;
}
