import { describe, expect, it } from 'vitest';
import { BIN_SMELL_SECONDS, binSmell, ROT_RIPE_SECONDS, ROT_SECONDS, rotStage, simSmellComplaint, SMELL_MAX, smellChance, smellLevel } from '../src/game/rot';
import { DAY_SECONDS, emptyDayStats } from '../src/game/economy';
import { reviewsFor } from '../src/game/reviews';
import { ru } from '../src/i18n/ru';
import { en } from '../src/i18n/en';

describe('гниющий мусор', () => {
  it('свежий не пахнет, потом сгнивает, ещё позже — гниёт вовсю', () => {
    expect(rotStage(0)).toBe(0);
    expect(rotStage(ROT_SECONDS - 0.1)).toBe(0);
    expect(rotStage(ROT_SECONDS)).toBe(1);
    expect(rotStage(ROT_RIPE_SECONDS)).toBe(2);
    // Есть время убрать самому: гниёт не раньше, чем через четверть смены.
    expect(ROT_SECONDS).toBeGreaterThanOrEqual(DAY_SECONDS / 4);
  });

  it('запах растёт с гнилым мусором и переполненным ведром', () => {
    expect(smellLevel([0, 5, 10], 0)).toBe(0);
    expect(smellLevel([ROT_SECONDS, 0], 0)).toBe(1);
    expect(smellLevel([ROT_RIPE_SECONDS, ROT_SECONDS], 0)).toBe(3);
    expect(binSmell(BIN_SMELL_SECONDS - 1)).toBe(0);
    expect(binSmell(BIN_SMELL_SECONDS)).toBe(1);
    expect(binSmell(BIN_SMELL_SECONDS * 2)).toBe(2);
    expect(smellLevel([], BIN_SMELL_SECONDS)).toBe(1);
  });

  it('морщатся тем чаще, чем сильнее пахнет, но не больше SMELL_MAX', () => {
    expect(smellChance(0)).toBe(0);
    expect(smellChance(1)).toBeGreaterThan(0);
    expect(smellChance(2)).toBeGreaterThan(smellChance(1));
    expect(smellChance(100)).toBe(SMELL_MAX);
    expect(SMELL_MAX).toBeLessThan(0.5);
  });

  it('в симуляторе: с уборщиком не пахнет, в первом помещении — тоже, дальше чуть-чуть', () => {
    expect(simSmellComplaint(4, true)).toBe(0);
    expect(simSmellComplaint(0, false)).toBe(0);
    expect(simSmellComplaint(3, false)).toBeGreaterThan(0);
    expect(simSmellComplaint(5, false)).toBeLessThan(0.05);
  });

  it('про запах пишут отзыв, тексты есть на обоих языках', () => {
    const stats = { ...emptyDayStats(), notes: { smell: 1 } };
    expect(reviewsFor(stats, 3).some((r) => r.topic === 'smell')).toBe(true);
    for (const key of ['review.smell.0', 'review.smell.1', 'popup.smell', 'popup.rotFirst', 'hint.rot'] as const) {
      expect(ru[key]).toBeTruthy();
      expect(en[key]).toBeTruthy();
    }
  });
});
