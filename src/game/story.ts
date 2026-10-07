// Сюжет: пять глав от бабушкиного ларька до универмага. У каждой главы — вступление,
// цель (видна каждое утро) и концовка с наградой. После пятой главы игра бесконечная.

import type { TextKey } from '../i18n/ru';
import type { EventChances } from './events';
import type { StoreState } from './economy';

export type CharacterId = 'grandma' | 'valya' | 'marat' | 'eduard' | 'inspector';

export const CHARACTERS: Record<CharacterId, { nameKey: TextKey; icon: string }> = {
  grandma: { nameKey: 'who.grandma', icon: '👵' },
  valya: { nameKey: 'who.valya', icon: '🧓' },
  marat: { nameKey: 'who.marat', icon: '🧑‍🍳' },
  eduard: { nameKey: 'who.eduard', icon: '🕴️' },
  inspector: { nameKey: 'who.inspector', icon: '📋' },
};

export interface Line {
  who: CharacterId;
  key: TextKey;
}

export interface StoryState {
  chapter: number;
  introSeen: boolean;
  /** Выполнено заказов в текущей главе. */
  ordersDone: number;
  /** Пройдено проверок в текущей главе. */
  inspectionsPassed: number;
}

export interface Chapter {
  titleKey: TextKey;
  goalKey: TextKey;
  intro: Line[];
  outro: Line[];
  done: (s: StoreState) => boolean;
  /** Параметры для текста цели (прогресс). */
  progress: (s: StoreState) => Record<string, number | string>;
  reward: { money?: number; rating?: number };
  /** Множитель потока гостей, пока идёт глава. */
  guests?: number;
  chances?: Partial<EventChances>;
}

const line = (who: CharacterId, key: TextKey): Line => ({ who, key });

export const CHAPTERS: Chapter[] = [
  {
    titleKey: 'story.ch1.title',
    goalKey: 'story.ch1.goal',
    intro: [line('grandma', 'story.ch1.intro1'), line('grandma', 'story.ch1.intro2'), line('valya', 'story.ch1.intro3')],
    outro: [line('valya', 'story.ch1.outro1'), line('valya', 'story.ch1.outro2')],
    done: (s) => s.debt === 0,
    progress: (s) => ({ n: s.debt }),
    reward: { rating: 0.3 },
  },
  {
    titleKey: 'story.ch2.title',
    goalKey: 'story.ch2.goal',
    intro: [line('marat', 'story.ch2.intro1'), line('marat', 'story.ch2.intro2')],
    outro: [line('marat', 'story.ch2.outro1')],
    done: (s) => s.story.ordersDone >= 2 && s.staff.length >= 1,
    progress: (s) => ({ n: Math.min(2, s.story.ordersDone), staff: s.staff.length ? '✓' : '✗' }),
    reward: { money: 300 },
    chances: { order: 0.35 },
  },
  {
    titleKey: 'story.ch3.title',
    goalKey: 'story.ch3.goal',
    intro: [line('eduard', 'story.ch3.intro1'), line('eduard', 'story.ch3.intro2'), line('valya', 'story.ch3.intro3')],
    outro: [line('eduard', 'story.ch3.outro1')],
    done: (s) => s.level >= 2 && s.rating >= 4,
    progress: (s) => ({ r: s.rating.toFixed(1) }),
    reward: { rating: 0.3 },
    guests: 0.85,
  },
  {
    titleKey: 'story.ch4.title',
    goalKey: 'story.ch4.goal',
    intro: [line('inspector', 'story.ch4.intro1'), line('inspector', 'story.ch4.intro2'), line('valya', 'story.ch4.intro3')],
    outro: [line('inspector', 'story.ch4.outro1'), line('valya', 'story.ch4.outro2')],
    done: (s) => s.story.inspectionsPassed >= 2,
    progress: (s) => ({ n: Math.min(2, s.story.inspectionsPassed) }),
    reward: { money: 1000 },
    chances: { inspection: 0.35 },
  },
  {
    titleKey: 'story.ch5.title',
    goalKey: 'story.ch5.goal',
    intro: [line('eduard', 'story.ch5.intro1'), line('eduard', 'story.ch5.intro2')],
    outro: [line('grandma', 'story.ch5.outro1'), line('valya', 'story.ch5.outro2'), line('grandma', 'story.ch5.outro3')],
    done: (s) => s.level >= 4,
    progress: () => ({}),
    reward: { rating: 0.5 },
  },
];

/** Сюжет пройден: свободная игра, «МегаМарта» больше нет — гостей чуть больше. */
export const FREE_PLAY_GUESTS = 1.1;

export const currentChapter = (s: StoreState): Chapter | undefined => CHAPTERS[s.story.chapter];

/** Множитель гостей от сюжета (конкурент уводит часть покупателей). */
export function storyGuests(s: StoreState): number {
  const chapter = currentChapter(s);
  return chapter ? (chapter.guests ?? 1) : FREE_PLAY_GUESTS;
}

export function storyChances(s: StoreState): EventChances {
  return { order: 0.15, inspection: 0.1, ...currentChapter(s)?.chances };
}

/** Что показать утром: вступление новой главы или концовку выполненной. */
export function pendingStory(s: StoreState): { kind: 'intro' | 'outro'; chapter: Chapter } | null {
  const chapter = currentChapter(s);
  if (!chapter) return null;
  if (!s.story.introSeen) return { kind: 'intro', chapter };
  if (chapter.done(s)) return { kind: 'outro', chapter };
  return null;
}

export function finishIntro(s: StoreState): StoreState {
  return { ...s, story: { ...s.story, introSeen: true } };
}

/** Глава выполнена: награда и переход к следующей. */
export function finishChapter(s: StoreState): StoreState {
  const chapter = currentChapter(s);
  if (!chapter) return s;
  return {
    ...s,
    money: s.money + (chapter.reward.money ?? 0),
    rating: Math.min(5, s.rating + (chapter.reward.rating ?? 0)),
    story: { chapter: s.story.chapter + 1, introSeen: false, ordersDone: 0, inspectionsPassed: 0 },
  };
}
