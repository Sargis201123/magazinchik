import { describe, expect, it } from 'vitest';
import { cleanName, lastSeen, litToday, STREET_NAME, STREET_SIZE, streetFriends, streetKey } from '../src/game/street';
import { STORE_LEVELS } from '../src/game/economy';

// «Улица друзей»: список приходит от других игроков — проверяем всё, прежде чем рисовать.
describe('улица друзей: проверка списка с сервера', () => {
  it('не массив и мусор — пустая улица', () => {
    expect(streetFriends(null)).toEqual([]);
    expect(streetFriends({ friends: [] })).toEqual([]);
    expect(streetFriends([null, 1, 'x', {}, { id: 'abc', name: 'А' }, { id: -5, name: 'Б' }, { id: 3 }, { id: 4, name: '   ' }])).toEqual([]);
  });

  it('имена обрезаны и очищены, уровни и числа в пределах', () => {
    const [f] = streetFriends([{ id: 7, name: `  Маша‮\u0000  Иванова-Петрова-Сидорова  `, level: 99, day: -3, rating: 12, ago: -1, shop: 'Х'.repeat(40), sign: 'sign_gold' }]);
    expect(f.name).toBe('Маша Иванова-Пет');
    expect([...f.name].length).toBeLessThanOrEqual(STREET_NAME);
    expect(f.level).toBe(STORE_LEVELS.length - 1);
    expect(f.day).toBe(1);
    expect(f.rating).toBe(5);
    expect(f.ago).toBe(0);
    expect(f.shop).toHaveLength(STREET_NAME);
    expect(f.sign).toBe('sign_gold');
  });

  it('эмодзи не режется пополам; NaN и строки — по умолчанию', () => {
    expect(cleanName('🏪'.repeat(20))).toBe('🏪'.repeat(STREET_NAME));
    const [f] = streetFriends([{ id: 1, name: 'Оля', level: 'abc', rating: 'NaN', ago: undefined }]);
    expect(f).toMatchObject({ level: 0, rating: 3, ago: 365 });
  });

  it('чужая вывеска: только настоящая доска из «Оформления»', () => {
    const list = streetFriends([
      { id: 1, name: 'А', sign: 'nope' },
      { id: 2, name: 'Б', sign: 'floor_wood' },
      { id: 3, name: 'В', sign: { evil: true } },
    ]);
    expect(list.map((f) => f.sign)).toEqual([undefined, undefined, undefined]);
  });

  it('один друг — один домик; сначала недавние; не больше STREET_SIZE', () => {
    const raw = [5, 0, 3, 0, 1, 2, 6].map((ago, i) => ({ id: i + 1, name: `Друг ${i + 1}`, ago }));
    raw.push({ id: 2, name: 'Двойник', ago: 0 });
    const list = streetFriends(raw);
    expect(list).toHaveLength(STREET_SIZE);
    expect(list.map((f) => f.id)).toEqual([2, 4, 5, 6, 3]);
  });

  it('свет в окне и «заходил»', () => {
    const [today, yesterday, later] = streetFriends([0, 1, 4].map((ago, i) => ({ id: i + 1, name: 'Х', ago })));
    expect(litToday(today)).toBe(true);
    expect(litToday(yesterday)).toBe(false);
    expect(lastSeen(today)).toEqual({ key: 'street.seen.today', n: 0 });
    expect(lastSeen(yesterday)).toEqual({ key: 'street.seen.yesterday', n: 1 });
    expect(lastSeen(later)).toEqual({ key: 'street.seen.days', n: 4 });
  });

  it('ключ улицы: выключена, пустой участок, домики', () => {
    expect(streetKey(null)).toBe('');
    expect(streetKey([])).toBe('lot');
    const a = streetFriends([{ id: 1, name: 'А', level: 2, ago: 0 }]);
    const b = streetFriends([{ id: 1, name: 'А', level: 2, ago: 1 }]);
    expect(streetKey(a)).not.toBe(streetKey(b));
    expect(streetKey(a)).toBe(streetKey(streetFriends([{ id: 1, name: 'А', level: 2, ago: 0, day: 99 }])));
  });
});
