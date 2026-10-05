// «Следующее действие» (мастер-план §3, фаза 2): что делать сейчас — вычисляется, не хранится.
// Только активные пути (фокус); навыки, закрытые требованием, пропускаются. Цель — первая незакрытая на текущей ступени.
import { daysBetween } from './dates';
import { currentStage, stageName, stagesOf } from './stages';
import type { GoalKind } from './progress';

export interface NAGoal { id: string; title: string; kind: GoalKind; stage: number; done: boolean; order: number }
export interface NASkill { id: string; locked: boolean; goals: NAGoal[] }
export interface NAEntry { date: string; stepGoalIds?: string[] }

export type NextAction =
  | {
    kind: 'goal'; skillId: string; goal: NAGoal; stage: number; stageName: string;
    /** Сколько целей ступени ещё открыто, включая эту: 1 — последняя, закроет ступень. */
    left: number;
    /** «Сделал шаг» по этой цели: сколько раз и когда последний. */
    steps: number; lastDate?: string;
  }
  | { kind: 'done'; skillId: string; hasGoals: boolean };

export function nextActions(focus: NASkill[], entries: NAEntry[]): NextAction[] {
  const out: NextAction[] = [];
  for (const s of focus) {
    if (s.locked) continue;
    const cur = currentStage(stagesOf(s.goals));
    if (!cur) {
      out.push({ kind: 'done', skillId: s.id, hasGoals: s.goals.length > 0 });
      continue;
    }
    const open = cur.goals.filter((g) => !g.done).sort((a, b) => a.order - b.order);
    const goal = open[0];
    const worked = entries.filter((e) => e.stepGoalIds?.includes(goal.id));
    const lastDate = worked.reduce<string | undefined>((m, e) => (!m || e.date > m ? e.date : m), undefined);
    out.push({ kind: 'goal', skillId: s.id, goal, stage: cur.stage, stageName: stageName(cur.stage), left: open.length, steps: worked.length, lastDate });
  }
  return out;
}

/** Нет активных путей: навыки, где ближе всего к следующей ступени (доля закрытого на текущей ступени). */
export function suggestPaths(skills: NASkill[], limit = 3): { skillId: string; stage: number; ratio: number }[] {
  return skills
    .filter((s) => !s.locked)
    .flatMap((s) => {
      const cur = currentStage(stagesOf(s.goals));
      return cur ? [{ skillId: s.id, stage: cur.stage, ratio: cur.done / cur.goals.length }] : [];
    })
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, limit);
}

/** «сегодня», «вчера», «3 дн. назад». */
export function agoText(date: string, today: string) {
  const d = daysBetween(date, today);
  return d <= 0 ? 'сегодня' : d === 1 ? 'вчера' : `${d} дн. назад`;
}
