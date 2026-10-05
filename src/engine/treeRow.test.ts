import { describe, expect, it } from 'vitest';
import { areaSummary, skillRow, type RowInput } from './treeRow';

const base: RowInput = { lockedBy: [], explored: true, rustDays: null, focus: false, stages: [{ done: 2, total: 2 }, { done: 3, total: 5 }, { done: 0, total: 3 }, { done: 0, total: 1 }], nextGoal: '30 отжиманий подряд' };

describe('строка навыка в дереве: главный счёт — этап', () => {
  it('в работе: этап из N, полоска целей этапа, «дальше»', () => {
    expect(skillRow(base)).toEqual({ state: 'normal', stage: 2, right: 'этап 2 из 4', bar: { done: 3, total: 5 }, line: 'дальше: 30 отжиманий подряд' });
    expect(skillRow({ ...base, focus: true }).state).toBe('active');
  });
  it('закрыт важнее всего; несколько навыков — через «и»', () => {
    expect(skillRow({ ...base, lockedBy: ['Отжимания'] })).toMatchObject({ state: 'locked', stage: null, right: '', line: 'закрыт · откроется, когда подкачаешь Отжимания' });
    expect(skillRow({ ...base, lockedBy: ['A', 'B', 'C'] }).line).toBe('закрыт · откроется, когда подкачаешь A, B и C');
  });
  it('не начат: сколько этапов и с чего начать', () => {
    expect(skillRow({ ...base, explored: false, firstGoal: 'Техника жима' })).toMatchObject({ state: 'new', right: '', line: 'не начат · 4 этапа · начни с «Техника жима»' });
    expect(skillRow({ ...base, explored: false, stages: [] }).line).toBe('не начат · целей пока нет');
  });
  it('освоен — все этапы закрыты (даже если давно не занимался)', () => {
    expect(skillRow({ ...base, rustDays: 90, stages: [{ done: 2, total: 2 }] })).toMatchObject({ state: 'mastered', right: 'освоен' });
  });
  it('финальный этап — последний из нескольких', () => {
    expect(skillRow({ ...base, stages: [{ done: 2, total: 2 }, { done: 4, total: 5 }], nextGoal: '5 км быстрее 30 минут' }))
      .toMatchObject({ state: 'final', right: 'этап 2 из 2', line: 'финальный этап: 5 км быстрее 30 минут' });
    expect(skillRow({ ...base, stages: [{ done: 1, total: 3 }] }).state).toBe('normal');
  });
  it('давно не занимался: этап виден, подпись про возвращение', () => {
    expect(skillRow({ ...base, rustDays: 63 })).toMatchObject({ state: 'rust', right: 'этап 2 из 4', line: 'давно не занимался (63 дня) — вернись' });
  });
  it('без целей — подсказка добавить цели', () => {
    expect(skillRow({ ...base, stages: [] })).toMatchObject({ stage: null, line: 'добавь цели, чтобы появились этапы' });
  });
});

describe('итог направления', () => {
  it('в работе, освоено, ближе всего', () => {
    const rows = [
      { title: 'Отжимания', view: skillRow(base) },
      { title: 'Бег', view: skillRow({ ...base, stages: [{ done: 4, total: 5 }] }) },
      { title: 'Сон', view: skillRow({ ...base, stages: [{ done: 1, total: 1 }] }) },
      { title: 'Жим', view: skillRow({ ...base, explored: false }) },
    ];
    expect(areaSummary(rows)).toBe('2 в работе · 1 освоен · ближе всего: Бег');
  });
  it('ничего не начато — честно так и пишем', () => {
    expect(areaSummary([{ title: 'A', view: skillRow({ ...base, explored: false }) }, { title: 'B', view: skillRow({ ...base, explored: false }) }])).toBe('2 навыка · пока не начаты');
    expect(areaSummary([])).toBe('пусто');
  });
});
