// Одна полоска прогресса. ARCHITECTURE.md §3.

export type GoalKind = 'theory' | 'practice';
export const GOAL_WEIGHT: Record<GoalKind, number> = { theory: 1, practice: 2 };

export interface GoalLike { kind: GoalKind; done: boolean }

export function skillProgress(goals: GoalLike[]) {
  if (goals.length === 0) return null;
  let doneW = 0;
  let totalW = 0;
  for (const g of goals) {
    totalW += GOAL_WEIGHT[g.kind];
    if (g.done) doneW += GOAL_WEIGHT[g.kind];
  }
  return { pct: (doneW / totalW) * 100, done: goals.filter((g) => g.done).length, total: goals.length };
}

export interface NodeLike { id: string; parentId: string | null; kind: 'area' | 'branch' | 'skill' }

/** Процент по каждому узлу; null — у узла нет ни одной цели. */
export function computeProgress(nodes: NodeLike[], goalsBySkill: Map<string, GoalLike[]>) {
  const children = new Map<string | null, NodeLike[]>();
  for (const n of nodes) {
    const list = children.get(n.parentId) ?? [];
    list.push(n);
    children.set(n.parentId, list);
  }
  const result = new Map<string, number | null>();
  const visit = (n: NodeLike): number | null => {
    let value: number | null;
    if (n.kind === 'skill') {
      value = skillProgress(goalsBySkill.get(n.id) ?? [])?.pct ?? null;
    } else {
      const vals = (children.get(n.id) ?? []).map(visit).filter((v): v is number => v !== null);
      value = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    }
    result.set(n.id, value);
    return value;
  };
  for (const root of children.get(null) ?? []) visit(root);
  return result;
}
