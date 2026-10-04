// Ступени целей навыка. ARCHITECTURE.md §16, идея 2.
import type { GoalKind } from './progress';

export const STAGE_NAMES = ['Новичок', 'Базовый', 'Уверенный', 'Продвинутый', 'Мастер'];
export const stageName = (n: number) => STAGE_NAMES[n - 1] ?? `Ступень ${n}`;
/** XP за полностью пройденную ступень. */
export const STAGE_BONUS = 100;

export interface StagedGoal { stage: number; done: boolean }

export interface StageInfo<G extends StagedGoal> {
  stage: number;
  name: string;
  goals: G[];
  done: number;
  complete: boolean;
  /** Ступень открыта, когда пройдены все предыдущие. */
  unlocked: boolean;
}

export function stagesOf<G extends StagedGoal>(goals: G[]): StageInfo<G>[] {
  const nums = [...new Set(goals.map((g) => g.stage))].sort((a, b) => a - b);
  let prevComplete = true;
  return nums.map((stage) => {
    const list = goals.filter((g) => g.stage === stage);
    const done = list.filter((g) => g.done).length;
    const info = { stage, name: stageName(stage), goals: list, done, complete: done === list.length, unlocked: prevComplete };
    prevComplete = prevComplete && info.complete;
    return info;
  });
}

/** Текущая ступень: первая открытая и не пройденная. */
export const currentStage = <G extends StagedGoal>(stages: StageInfo<G>[]) => stages.find((s) => s.unlocked && !s.complete);

/**
 * Раскладка целей без ступеней: теория — первая ступень,
 * практика делится пополам на следующие две.
 */
export function assignStages<G extends { kind: GoalKind }>(goals: G[]): number[] {
  const theory = goals.filter((g) => g.kind === 'theory').length;
  const practice = goals.filter((g) => g.kind === 'practice');
  const first = theory > 0 ? 2 : 1;
  const half = practice.length >= 2 ? Math.ceil(practice.length / 2) : practice.length;
  let i = 0;
  return goals.map((g) => {
    if (g.kind === 'theory') return 1;
    return i++ < half ? first : first + 1;
  });
}
