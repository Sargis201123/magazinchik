// Мусор гниёт: бумажки, огрызки и лужи, которые долго лежат на полу, темнеют, над ними кружат
// мухи и поднимается вонь. Запах растёт — покупатели морщатся и жалуются, это бьёт по рейтингу.
// Убрал — запаха нет. Переполненное ведро, если его долго не выносят, тоже пахнет.
// Мягко: свежий мусор не пахнет, первые полминуты есть время убрать самому; уборщик снимает вопрос.

/** Через столько секунд смены мусор на полу сгнивает (смена — DAY_SECONDS = 90). */
export const ROT_SECONDS = 24;
/** Ещё дольше — гниёт вовсю, пахнет вдвое сильнее. */
export const ROT_RIPE_SECONDS = 48;
/** Ведро переполнено столько секунд — начинает пахнуть (вдвое дольше — вдвое сильнее). */
export const BIN_SMELL_SECONDS = 15;
/** Вероятность, что покупатель у кассы поморщится, — за каждую единицу запаха… */
export const SMELL_CHANCE = 0.08;
/** …но не больше этой: даже в очень грязном зале большинство всё равно платит спокойно. */
export const SMELL_MAX = 0.35;
/** Какой мусор гниёт: бумажки и огрызки, пролитое; грязные следы с улицы — нет. */
export const ROTS = ['trash', 'spill'] as const;

/** 0 — свежий, 1 — сгнил, 2 — гниёт вовсю. */
export type RotStage = 0 | 1 | 2;

export const rotStage = (age: number): RotStage => (age >= ROT_RIPE_SECONDS ? 2 : age >= ROT_SECONDS ? 1 : 0);

/** Запах переполненного ведра по тому, сколько секунд оно стоит полным. */
export const binSmell = (fullFor: number): number => (fullFor >= BIN_SMELL_SECONDS * 2 ? 2 : fullFor >= BIN_SMELL_SECONDS ? 1 : 0);

/** Сколько всего пахнет в зале: стадии гнилого мусора плюс ведро. */
export const smellLevel = (ages: number[], binFullFor: number): number => ages.reduce((sum, age) => sum + rotStage(age), 0) + binSmell(binFullFor);

/** С какой вероятностью покупатель у кассы морщится от запаха. */
export const smellChance = (smell: number): number => Math.min(SMELL_MAX, Math.max(0, smell) * SMELL_CHANCE);

/**
 * Симулятор (simulate.ts): как часто покупатель жалуется на запах. Без уборщика мусор лежит тем
 * дольше, чем больше зал и покупателей; в первом помещении хозяин успевает убрать сам. С уборщиком — 0.
 */
export const simSmellComplaint = (level: number, cleaner: boolean): number => (cleaner ? 0 : 0.006 * Math.max(0, level));
