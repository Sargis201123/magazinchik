// Звук зала по размеру магазина: ларёк звучит не так, как гипермаркет. Ларёк — тихо, маленькое радио
// потрескивает в углу, улица слышна через окошко; магазинчик и минимаркет — гомон погромче и гудят
// холодильники; супермаркет и универмаг — людный зал, тележки, «пик» сканеров с дальних касс;
// гипермаркет — большой гулкий зал, редкие объявления по громкой связи и много касс. Плотность
// следует за тем, сколько людей в зале и сколько касс работает; ночью и в закрытом магазине тише.
// Чистые функции без WebAudio — их проверяют тесты (tests/hallLayers.test.ts), а играет hallScape.ts.

import type { Gap } from './ambienceLayers';

/** Что сейчас в зале — всё, от чего зависит его звук. */
export interface HallScene {
  /** Помещение: индекс в STORE_LEVELS (0 — ларёк, 5 — гипермаркет). */
  level: number;
  /** Людей в зале (покупатели). */
  people: number;
  /** Работающих касс (за которыми кто-то стоит). */
  tills: number;
  /** Магазин открыт (идёт рабочий день). */
  open: boolean;
  /** Ночная смена. */
  night: boolean;
  /** Облегчённый режим (слабый телефон). */
  lite: boolean;
}

/** Звук зала: множители к уже существующим слоям и промежутки между разовыми звуками. */
export interface HallMix {
  /** Гомон покупателей — множитель к murmurGains. */
  murmur: number;
  /** Гул холодильников — множитель. */
  hum: number;
  /** Маленькое радио в ларьке: тихий треск эфира (0…1). */
  radio: number;
  /** Отзвук комнаты — множитель к отправке зала в отзвук. */
  room: number;
  /** Длинный хвост большого зала (0…1): только гипермаркет. */
  hall: number;
  /** Улица ближе: «приоткрытая дверь» всегда (0…1) — в ларьке улица за окошком, а не за витриной. */
  street: number;
  /** Тележки. */
  trolley: Gap;
  /** «Пик» сканеров с других касс. */
  beep: Gap;
  /** Объявление по громкой связи. */
  pa: Gap;
  /** Громкость разовых звуков (тележки, сканеры, объявления): ночью тише. */
  gain: number;
}

interface Profile {
  murmur: number;
  hum: number;
  radio: number;
  room: number;
  hall: number;
  street: number;
  /** Тележки при полном зале (null — тележек нет). */
  trolley: Gap;
  /** Сканеры: «пик» с одной кассы — так часто; касс больше — чаще (null — только своя касса). */
  beep: Gap;
  pa: Gap;
  /** Сколько людей — «полный зал» для этого помещения. */
  crowd: number;
}

/**
 * Помещения по порядку STORE_LEVELS. Всё тихо: гомон даже в гипермаркете лишь на ~2.5 дБ громче,
 * чем в магазинчике (автор не любит громкое), холодильники — на пороге слышимости.
 */
export const HALL_PROFILES: Profile[] = [
  // Ларёк: тишина, радио, улица за окошком.
  { murmur: 0.8, hum: 0.6, radio: 1, room: 0.6, hall: 0, street: 0.3, trolley: null, beep: null, pa: null, crowd: 4 },
  // Магазинчик: чуть больше разговоров, холодильники.
  { murmur: 1, hum: 1, radio: 0, room: 0.85, hall: 0, street: 0.1, trolley: null, beep: null, pa: null, crowd: 6 },
  // Минимаркет: изредка корзинка-тележка.
  { murmur: 1.05, hum: 1.25, radio: 0, room: 1, hall: 0, street: 0.05, trolley: [30, 60], beep: null, pa: null, crowd: 8 },
  // Супермаркет: людный зал, тележки, сканеры с других касс.
  { murmur: 1.15, hum: 1.35, radio: 0, room: 1.15, hall: 0, street: 0, trolley: [12, 26], beep: [7, 15], pa: null, crowd: 10 },
  // Универмаг.
  { murmur: 1.25, hum: 1.45, radio: 0, room: 1.3, hall: 0, street: 0, trolley: [9, 20], beep: [6, 13], pa: null, crowd: 12 },
  // Гипермаркет: большой гулкий зал, объявления, много касс.
  { murmur: 1.35, hum: 1.55, radio: 0, room: 1.5, hall: 1, street: 0, trolley: [6, 14], beep: [5, 11], pa: [100, 200], crowd: 18 },
];

/** Ночью разовые звуки реже и тише. */
export const NIGHT = { gap: 1.8, gain: 0.6 };
/** На слабом телефоне — реже и без длинного хвоста большого зала. */
const LITE_GAP = 1.5;

const scale = (gap: Gap, k: number): Gap => (gap ? [gap[0] * k, gap[1] * k] : null);

export const hallProfile = (level: number): Profile => HALL_PROFILES[Math.min(HALL_PROFILES.length - 1, Math.max(0, Math.floor(level) || 0))];

/** Звук зала сейчас. */
export function hallMix(s: HallScene): HallMix {
  const p = hallProfile(s.level);
  // Насколько зал полон (0…1): пустой — тележки почти не ездят, сканеры молчат.
  const full = Math.min(1, Math.max(0, s.people) / p.crowd);
  const slow = (s.night ? NIGHT.gap : 1) * (s.lite ? LITE_GAP : 1);
  const busy = s.open && s.people > 0;
  // Тележки: в полном зале — по профилю, в почти пустом — втрое реже.
  const trolley = busy ? scale(p.trolley, slow / (0.33 + 0.67 * full)) : null;
  // Сканеры: своя касса звучит сама (sound.scan) — здесь только другие, и чем их больше, тем чаще.
  const others = Math.max(0, Math.floor(s.tills) - 1);
  const beep = busy && others > 0 ? scale(p.beep, slow / others / (0.4 + 0.6 * full)) : null;
  // Объявления — только в открытом магазине (людей может и не быть: «Уважаемые покупатели…»).
  const pa = s.open ? scale(p.pa, slow) : null;
  return {
    murmur: p.murmur,
    hum: p.hum,
    // Радио в ларьке играет и в закрытом — тише.
    radio: p.radio * (s.open ? 1 : 0.5) * (s.night ? NIGHT.gain : 1),
    room: p.room,
    hall: s.lite ? 0 : p.hall,
    street: p.street,
    trolley,
    beep,
    pa,
    gain: s.night ? NIGHT.gain : 1,
  };
}
