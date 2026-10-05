import { describe, expect, it } from 'vitest';
import { agoText, nextActions, suggestPaths, type NAGoal, type NASkill } from './nextAction';

const g = (id: string, stage: number, done = false, kind: NAGoal['kind'] = 'practice', order = 0): NAGoal => ({ id, title: id, kind, stage, done, order });
const sk = (id: string, goals: NAGoal[], locked = false): NASkill => ({ id, goals, locked });

describe('следующее действие', () => {
  it('первая незакрытая цель текущей ступени (по порядку), сколько осталось', () => {
    const [a] = nextActions([sk('py', [g('t1', 1, true), g('p2', 2, false, 'practice', 2), g('p1', 2, false, 'practice', 1), g('p3', 3)])], []);
    expect(a).toMatchObject({ kind: 'goal', skillId: 'py', stage: 2, stageName: 'Базовый', left: 2 });
    expect(a.kind === 'goal' && a.goal.id).toBe('p1');
  });
  it('последняя цель ступени — left 1', () => {
    const [a] = nextActions([sk('py', [g('a', 1, true), g('b', 1)])], []);
    expect(a.kind === 'goal' && a.left).toBe(1);
  });
  it('шаги по цели: сколько и когда последний', () => {
    const [a] = nextActions([sk('py', [g('a', 1)])], [{ date: '2026-10-03', stepGoalIds: ['a'] }, { date: '2026-10-04', stepGoalIds: ['a'] }, { date: '2026-10-05' }]);
    expect(a).toMatchObject({ steps: 2, lastDate: '2026-10-04' });
  });
  it('закрытые требованием пропускаются; все цели закрыты или целей нет — «done»', () => {
    const list = nextActions([sk('locked', [g('x', 1)], true), sk('all', [g('y', 1, true)]), sk('empty', [])], []);
    expect(list).toEqual([{ kind: 'done', skillId: 'all', hasGoals: true }, { kind: 'done', skillId: 'empty', hasGoals: false }]);
  });
});

describe('нет активных путей: что предложить', () => {
  it('ближе всего к ступени — первым; без целей и закрытые — не предлагаются', () => {
    const list = suggestPaths([
      sk('a', [g('1', 1, true), g('2', 1), g('3', 1)]),
      sk('b', [g('4', 1, true), g('5', 1)]),
      sk('c', [g('6', 1)]),
      sk('d', [g('7', 1, true), g('8', 1)], true),
      sk('e', []),
    ]);
    expect(list.map((x) => x.skillId)).toEqual(['b', 'a', 'c']);
  });
});

it('давность: сегодня, вчера, N дн. назад', () => {
  expect(agoText('2026-10-05', '2026-10-05')).toBe('сегодня');
  expect(agoText('2026-10-04', '2026-10-05')).toBe('вчера');
  expect(agoText('2026-10-01', '2026-10-05')).toBe('4 дн. назад');
});
