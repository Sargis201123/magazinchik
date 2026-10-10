// Кто заходит в магазин: 32 узнаваемых образа из гардероба (wardrobe.ts) — пенсионер с тростью,
// бабушка с авоськой, студент в наушниках, повар, пожарный, рыбак с удочкой, турист с фотоаппаратом…
// Образ накладывается поверх случайной внешности: цвет кожи, волосы и штаны у всех разные,
// а цвета вещей выбираются из своих наборов. Зимние образы (ушанка, шуба) — в холода и в мороз,
// летние (гавайка, панама) — летом и в жару.

import { bigDayFor } from '../game/bigday';
import { monthInYear, yearTime } from '../game/calendar';
import type { BackId, FaceId, HatId, OutfitId, PropId } from './wardrobe';

export type HairStyle = 'short' | 'long' | 'bun' | 'cap' | 'bald' | 'ponytail' | 'curly' | 'beanie';

/** Что надето — накладывается поверх случайной внешности. */
export interface Wear {
  shirt?: number;
  pants?: number;
  hair?: number;
  style?: HairStyle;
  kid?: boolean;
  glasses?: boolean;
  bag?: 'bag' | 'backpack';
  bagTint?: number;
  acc?: 'apron' | 'vest' | 'badge' | 'tie';
  accTint?: number;
  hat?: HatId;
  hatTint?: number;
  outfit?: OutfitId;
  outfitTint?: number;
  prop?: PropId;
  propTint?: number;
  face?: FaceId;
  /** Цвет бороды и усов; по умолчанию — как волосы. */
  faceTint?: number;
  back?: BackId;
  backTint?: number;
}

type Season = 'cold' | 'warm';

interface Archetype {
  id: string;
  weight: number;
  /** Только в холода (зима, предзимье, мороз) или только в тепло (лето, жара). */
  season?: Season;
  wear: (pick: <T>(items: readonly T[]) => T, chance: (p: number) => boolean) => Wear;
}

const GREY = [0xd8d8e0, 0xc0cbdc, 0x8b9bb4];
const BRIGHT = [0xe43b44, 0x0099db, 0x63c74d, 0xfeae34, 0xb55088, 0x2ce8f5, 0xf6757a];
const CALM = [0x8f563b, 0x5a6988, 0x3e8948, 0x733e39, 0x68386c, 0xc28569];
const DARK = [0x262b44, 0x3a4466, 0x181425, 0x4a3b52];
const WHITE = 0xffffff;

export const ARCHETYPES: Archetype[] = [
  {
    id: 'pensioner',
    weight: 3,
    wear: (pick, chance) => ({
      hat: 'flatcap',
      hatTint: pick([0x8f563b, 0x5a6988, 0x4a3b52]),
      outfit: 'cardigan',
      outfitTint: pick(CALM),
      prop: 'cane',
      hair: pick(GREY),
      style: pick(['bald', 'short'] as const),
      glasses: chance(0.5),
      face: chance(0.4) ? 'mustache' : undefined,
    }),
  },
  {
    id: 'babushka',
    weight: 3,
    wear: (pick) => ({
      hat: 'headscarf',
      hatTint: pick([0xe43b44, 0x0099db, 0x63c74d, 0xb55088, 0xfeae34]),
      outfit: 'cardigan',
      outfitTint: pick(CALM),
      prop: 'stringbag',
      hair: pick(GREY),
      style: 'bun',
    }),
  },
  {
    id: 'student',
    weight: 3,
    wear: (pick, chance) => ({
      outfit: 'hoodie',
      outfitTint: pick([...BRIGHT, ...DARK]),
      hat: 'headphones',
      hatTint: pick([0x262b44, WHITE, 0xe43b44]),
      bag: chance(0.6) ? 'backpack' : undefined,
      bagTint: pick(CALM),
    }),
  },
  {
    id: 'jogger',
    weight: 2,
    wear: (pick) => ({
      outfit: 'tracksuit',
      outfitTint: pick([0xe43b44, 0x0099db, 0x3e8948, 0x262b44, 0xb55088]),
      shirt: WHITE,
      hat: 'headband',
      hatTint: pick([WHITE, 0xfee761, 0xe43b44]),
      prop: 'bottle',
      style: pick(['short', 'ponytail'] as const),
    }),
  },
  {
    id: 'businessman',
    weight: 2,
    wear: (pick) => ({ outfit: 'suit', shirt: WHITE, prop: 'briefcase', propTint: pick([0x733e39, 0x262b44, 0x181425]), style: 'short' }),
  },
  {
    id: 'nurse',
    weight: 1.5,
    wear: (pick) => ({ outfit: 'labcoat', shirt: 0x8fd7f5, hat: 'nursecap', style: pick(['bun', 'ponytail'] as const) }),
  },
  { id: 'chef', weight: 1, wear: () => ({ outfit: 'chefcoat', hat: 'toque', pants: 0x262b44 }) },
  { id: 'police', weight: 1, wear: () => ({ outfit: 'police', hat: 'policecap', pants: 0x262b44 }) },
  { id: 'firefighter', weight: 0.8, wear: () => ({ outfit: 'firecoat', hat: 'firehelmet', pants: 0x5a6988 }) },
  {
    id: 'builder',
    weight: 1.5,
    wear: (pick) => ({ hat: 'hardhat', hatTint: pick([0xfee761, WHITE, 0xf77622]), acc: 'vest', shirt: pick(CALM) }),
  },
  {
    id: 'fisherman',
    weight: 1.5,
    wear: (pick, chance) => {
      const khaki = pick([0x8a8f55, 0x9a8a6a, 0x5f7a4a]);
      return { hat: 'bucket', hatTint: khaki, outfit: 'fishvest', outfitTint: khaki, prop: 'rod', face: chance(0.4) ? 'beard' : undefined };
    },
  },
  {
    id: 'tourist',
    weight: 1.5,
    season: 'warm',
    wear: (pick) => ({ hat: 'sunhat', hatTint: pick([WHITE, 0xead4aa, 0xfee761]), outfit: 'hawaii', prop: 'camera', bag: 'backpack', bagTint: pick(CALM) }),
  },
  {
    id: 'dachnik',
    weight: 2,
    wear: (pick, chance) => ({ hat: 'straw', prop: 'basket', shirt: pick([WHITE, 0x8fd7f5, 0xead4aa]), face: chance(0.3) ? 'beard' : undefined }),
  },
  {
    id: 'musician',
    weight: 1.2,
    wear: (pick, chance) => ({
      back: 'guitar',
      outfit: chance(0.5) ? 'leather' : 'hoodie',
      outfitTint: pick(DARK),
      style: pick(['long', 'curly', 'beanie'] as const),
    }),
  },
  {
    id: 'biker',
    weight: 1,
    wear: (pick, chance) => ({
      outfit: 'leather',
      hat: 'bandana',
      hatTint: pick([0x181425, 0xe43b44, 0x124e89]),
      face: chance(0.5) ? 'sunglasses' : 'beard',
    }),
  },
  {
    id: 'hipster',
    weight: 1.5,
    wear: (pick) => ({ face: 'beard', style: 'beanie', hair: pick(BRIGHT), outfit: 'cardigan', outfitTint: pick(CALM), prop: 'coffee' }),
  },
  {
    id: 'punk',
    weight: 0.8,
    wear: (pick) => {
      const dye = pick([0xf6757a, 0x63c74d, 0x2ce8f5, 0xb55088]);
      return { hat: 'mohawk', hatTint: dye, hair: dye, style: 'bald', outfit: 'leather' };
    },
  },
  {
    id: 'artist',
    weight: 1,
    wear: (pick, chance) => ({ hat: 'beret', hatTint: pick([0xe43b44, 0x181425, 0x124e89]), prop: 'palette', face: chance(0.3) ? 'mustache' : undefined }),
  },
  { id: 'sailor', weight: 1, wear: () => ({ hat: 'sailor', outfit: 'telnyashka', pants: 0x262b44 }) },
  {
    id: 'cowboy',
    weight: 0.7,
    wear: (pick, chance) => ({
      hat: 'cowboy',
      hatTint: pick([0xc28569, 0x8f563b, 0xead4aa]),
      outfit: 'fishvest',
      outfitTint: 0x8f563b,
      face: chance(0.5) ? 'mustache' : undefined,
    }),
  },
  {
    id: 'reader',
    weight: 1.5,
    wear: (pick, chance) => ({
      hat: 'flatcap',
      hatTint: pick([0x5a6988, 0x733e39]),
      prop: 'newspaper',
      glasses: true,
      hair: pick(GREY),
      face: chance(0.5) ? 'mustache' : undefined,
    }),
  },
  {
    id: 'florist',
    weight: 1.5,
    wear: (pick) => ({ outfit: 'dress', outfitTint: pick([0xf6757a, 0xe43b44, 0xfee761, 0xb55088, 0x8fd7f5]), prop: 'bouquet', style: pick(['long', 'bun', 'curly'] as const) }),
  },
  {
    id: 'teacher',
    weight: 1.2,
    wear: (pick) => ({ outfit: 'cardigan', outfitTint: pick(CALM), shirt: WHITE, glasses: true, prop: 'books', style: pick(['bun', 'short'] as const) }),
  },
  {
    id: 'courier',
    weight: 1.5,
    wear: (pick) => {
      const brand = pick([0xfee761, 0x63c74d, 0xf77622, 0xe43b44]);
      return { hat: 'bikehelmet', hatTint: brand, back: 'cube', backTint: brand, shirt: brand };
    },
  },
  {
    id: 'yogi',
    weight: 1,
    wear: (pick) => {
      const color = pick([0xb55088, 0x2ce8f5, 0x63c74d, 0xf6757a]);
      return { outfit: 'tracksuit', outfitTint: color, shirt: WHITE, back: 'yogamat', backTint: color, style: 'ponytail' };
    },
  },
  {
    id: 'office',
    weight: 2,
    wear: (pick, chance) => ({ outfit: 'cardigan', outfitTint: pick([0x262b44, 0x8b9bb4, 0xead4aa]), shirt: WHITE, prop: 'coffee', style: pick(['ponytail', 'long', 'short'] as const), glasses: chance(0.3) }),
  },
  {
    id: 'schoolgirl',
    weight: 1.5,
    wear: (pick) => ({ kid: true, style: 'ponytail', hat: 'bow', hatTint: pick(BRIGHT), bag: 'backpack', bagTint: pick(BRIGHT) }),
  },
  {
    id: 'gamer',
    weight: 1.2,
    wear: (pick) => ({ kid: true, outfit: 'hoodie', outfitTint: pick(BRIGHT), hat: 'headphones', hatTint: pick([0x262b44, 0xe43b44]) }),
  },
  { id: 'scientist', weight: 0.8, wear: () => ({ outfit: 'labcoat', shirt: 0x8b9bb4, prop: 'flask', glasses: true, style: 'curly' }) },
  {
    id: 'winter_man',
    weight: 3,
    season: 'cold',
    wear: (pick, chance) => ({
      hat: 'ushanka',
      hatTint: pick([0x8f563b, 0x5a6988, 0x4a3b52]),
      outfit: chance(0.5) ? 'leather' : 'hoodie',
      outfitTint: pick(DARK),
      face: chance(0.3) ? 'beard' : undefined,
    }),
  },
  { id: 'fur_lady', weight: 2.5, season: 'cold', wear: (pick) => ({ hat: 'furhat', outfit: 'furcoat', style: pick(['long', 'bun'] as const) }) },
  {
    id: 'beach',
    weight: 2.5,
    season: 'warm',
    wear: (pick) => ({ outfit: 'hawaii', face: 'sunglasses', hat: pick(['bucket', 'sunhat'] as const), hatTint: pick([WHITE, 0xfee761, 0x8fd7f5]) }),
  },
];

/** Какой сезон для гардероба: холода (зима, предзимье, мороз) или тепло (лето, жара). */
export function wearSeason(day: number): Season | null {
  const big = bigDayFor(day);
  if (big === 'frost' || yearTime(day) === 'winter' || monthInYear(day) === 2) return 'cold';
  if (big === 'heatwave' || yearTime(day) === 'summer') return 'warm';
  return null;
}

/** Случайный образ под время года. */
export function pickWear(day: number, random: () => number): { id: string; wear: Wear } {
  const season = wearSeason(day);
  const pool = ARCHETYPES.filter((a) => !a.season || a.season === season);
  const total = pool.reduce((sum, a) => sum + a.weight, 0);
  let roll = random() * total;
  let chosen = pool[pool.length - 1];
  for (const a of pool) {
    roll -= a.weight;
    if (roll < 0) {
      chosen = a;
      break;
    }
  }
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
  return { id: chosen.id, wear: chosen.wear(pick, (p) => random() < p) };
}
