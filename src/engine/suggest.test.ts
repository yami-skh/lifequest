import { describe, expect, it } from 'vitest';
import { items, suggest } from './suggest';
import { actionIdeas, allPathGoals, goalIdeas, skillIdeas, AREA_IDEAS, METRIC_IDEAS } from '../data/suggest';

const pool = items({
  mine: ['Отжимания 3×20', 'Бег 3 км по парку'],
  goal: ['30 отжиманий подряд', '100 отжиманий за тренировку'],
  idea: ['Отжимания на брусьях 3×10', 'Ёлочка: растяжка', 'Отжимания 3×20'],
});
const texts = (q: string, o = {}) => suggest(q, pool, o).map((x) => x.text);

describe('подсказки при вводе', () => {
  it('начало строки выше середины, своё выше общего; повторы убираются', () => {
    expect(texts('отж')).toEqual(['Отжимания 3×20', 'Отжимания на брусьях 3×10', '30 отжиманий подряд', '100 отжиманий за тренировку']);
  });
  it('пустой запрос — сначала своё, потом цели, потом запас', () => {
    expect(texts('').slice(0, 3)).toEqual(['Отжимания 3×20', 'Бег 3 км по парку', '30 отжиманий подряд']);
  });
  it('ё = е, регистр не важен, слова в любом порядке', () => {
    expect(texts('елочка')).toEqual(['Ёлочка: растяжка']);
    expect(texts('3 км бег')).toEqual(['Бег 3 км по парку']);
  });
  it('уже существующее и точно введённое не предлагаем; лимит', () => {
    expect(texts('отж', { exclude: ['отжимания 3×20'] })).not.toContain('Отжимания 3×20');
    expect(texts('Отжимания 3×20')).not.toContain('Отжимания 3×20');
    expect(texts('', { limit: 2 })).toHaveLength(2);
  });
});

describe('запас подсказок «много вариантов»', () => {
  it('объёмы: навыков, действий и целей по 800+, направлений и замеров 25+', () => {
    expect(skillIdeas().length).toBeGreaterThanOrEqual(800);
    expect(actionIdeas('workout').length).toBeGreaterThanOrEqual(800);
    expect(allPathGoals().length).toBeGreaterThanOrEqual(800);
    expect(AREA_IDEAS.length).toBeGreaterThanOrEqual(25);
    expect(METRIC_IDEAS.length).toBeGreaterThanOrEqual(25);
  });
  it('цели: сначала из путей для известного навыка, плюс общие с названием', () => {
    const g = goalIdeas('Подтягивания');
    expect(g).toContain('5 подтягиваний подряд');
    expect(g.indexOf('5 подтягиваний подряд')).toBeLessThan(g.findIndex((x) => x.includes('«Подтягивания»')));
    expect(goalIdeas('Гитара').some((x) => x.includes('Гитара'))).toBe(true);
  });
});
