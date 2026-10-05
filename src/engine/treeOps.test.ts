import { describe, expect, it } from 'vitest';
import { matchesFilter, moveTargets, reorder, subtreeIds, type TNode } from './treeOps';

const N = (id: string, parentId: string | null, kind: TNode['kind'], order = 0): TNode => ({ id, parentId, kind, title: id, order });
const nodes: TNode[] = [
  N('Тело', null, 'area', 0), N('Ум', null, 'area', 1),
  N('Сила', 'Тело', 'branch', 0), N('Зал', 'Тело', 'branch', 1), N('Жимы', 'Зал', 'branch', 0),
  N('Отжимания', 'Сила', 'skill', 0), N('Жим', 'Сила', 'skill', 1), N('Присед', 'Сила', 'skill', 2),
  N('Языки', 'Ум', 'branch', 0),
];

describe('перенос: куда можно', () => {
  it('навык — в любое направление или ветку, текущий родитель помечен, путь для подписи', () => {
    const t = moveTargets(nodes, 'Жим');
    expect(t.map((x) => x.path)).toEqual(['Тело', 'Тело › Сила', 'Тело › Зал', 'Тело › Зал › Жимы', 'Ум', 'Ум › Языки']);
    expect(t.find((x) => x.current)?.path).toBe('Тело › Сила');
    expect(t.find((x) => x.path === 'Тело › Зал › Жимы')?.depth).toBe(2);
  });
  it('ветку нельзя перенести в саму себя или в своих потомков', () => {
    const t = moveTargets(nodes, 'Зал').map((x) => x.path);
    expect(t).not.toContain('Тело › Зал');
    expect(t).not.toContain('Тело › Зал › Жимы');
    expect(t).toContain('Ум › Языки');
    expect([...subtreeIds(nodes, 'Тело')].sort()).toEqual(['Жим', 'Жимы', 'Зал', 'Отжимания', 'Присед', 'Сила', 'Тело'].sort());
  });
  it('направление не переносится', () => {
    expect(moveTargets(nodes, 'Тело')).toEqual([]);
  });
});

describe('порядок: выше / ниже', () => {
  const sib = nodes.filter((n) => n.parentId === 'Сила');
  it('меняет соседей местами и нормализует порядок', () => {
    expect(reorder(sib, 'Жим', -1)).toEqual([{ id: 'Жим', order: 0 }, { id: 'Отжимания', order: 1 }, { id: 'Присед', order: 2 }]);
    expect(reorder(sib, 'Жим', 1)).toEqual([{ id: 'Отжимания', order: 0 }, { id: 'Присед', order: 1 }, { id: 'Жим', order: 2 }]);
  });
  it('у края — двигать некуда', () => {
    expect(reorder(sib, 'Отжимания', -1)).toBeNull();
    expect(reorder(sib, 'Присед', 1)).toBeNull();
  });
  it('одинаковый order (старые данные) — сначала по названию, без потери узлов', () => {
    const same = sib.map((n) => ({ ...n, order: 0 }));
    expect(reorder(same, 'Отжимания', 1)!.map((x) => x.id)).toEqual(['Жим', 'Присед', 'Отжимания']);
  });
});

describe('фильтры', () => {
  it('«В работе» включает активные и давно не тронутые, но не новые и освоенные', () => {
    expect(['active', 'normal', 'final', 'rust'].every((s) => matchesFilter('work', s as never))).toBe(true);
    expect(matchesFilter('work', 'new')).toBe(false);
    expect(matchesFilter('work', 'mastered')).toBe(false);
    expect(matchesFilter('focus', 'active')).toBe(true);
  });
});
