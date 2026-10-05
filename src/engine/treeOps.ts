// Операции с деревом: куда можно перенести узел, порядок «выше/ниже», фильтры списка.
// Чистые функции (тесты — treeOps.test.ts); запись в базу — db/actions.ts (moveNode, moveOrder, setArchived).
import type { RowState } from './treeRow';

export interface TNode { id: string; parentId: string | null; kind: 'area' | 'branch' | 'skill'; title: string; order: number; archived?: boolean }

/** Узел и все его потомки. */
export function subtreeIds(nodes: TNode[], id: string): Set<string> {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of nodes) if (n.parentId && out.has(n.parentId) && !out.has(n.id)) { out.add(n.id); grew = true; }
  }
  return out;
}

/**
 * Куда можно перенести узел: направления и ветки, кроме него самого, его потомков и текущего родителя.
 * Направление не переносится (оно верхний уровень). Возвращает путь для подписи: «Тело › Сила».
 */
export function moveTargets(nodes: TNode[], id: string): { id: string; path: string; depth: number; current: boolean }[] {
  const node = nodes.find((n) => n.id === id);
  if (!node || node.kind === 'area') return [];
  const banned = subtreeIds(nodes, id);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const pathOf = (n: TNode): string[] => (n.parentId && byId.get(n.parentId) ? [...pathOf(byId.get(n.parentId)!), n.title] : [n.title]);
  const out: { id: string; path: string; depth: number; current: boolean }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    const kids = nodes.filter((n) => n.parentId === parentId && n.kind !== 'skill' && !banned.has(n.id)).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
    for (const k of kids) {
      out.push({ id: k.id, path: pathOf(k).join(' › '), depth, current: k.id === node.parentId });
      walk(k.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** Новый порядок соседей после «выше» (-1) или «ниже» (+1). null — двигать некуда. Порядок нормализуется 0..n-1. */
export function reorder(siblings: TNode[], id: string, dir: -1 | 1): { id: string; order: number }[] | null {
  const list = [...siblings].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  const i = list.findIndex((n) => n.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return null;
  [list[i], list[j]] = [list[j], list[i]];
  return list.map((n, order) => ({ id: n.id, order }));
}

export type TreeFilter = 'focus' | 'work' | 'new' | 'rust' | 'mastered';
export const FILTERS: { id: TreeFilter; label: string; states: RowState[] }[] = [
  { id: 'focus', label: 'Активные', states: ['active'] },
  { id: 'work', label: 'В работе', states: ['active', 'normal', 'final', 'rust'] },
  { id: 'rust', label: 'Давно не трогал', states: ['rust'] },
  { id: 'new', label: 'Не начаты', states: ['new'] },
  { id: 'mastered', label: 'Освоены', states: ['mastered'] },
];
export const matchesFilter = (f: TreeFilter, state: RowState) => FILTERS.find((x) => x.id === f)!.states.includes(state);
