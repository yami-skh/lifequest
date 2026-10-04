// Квесты: шаблоны недельных, прогресс шагов. ARCHITECTURE.md §6.
import { addDays } from './dates';

export const QUEST_STEP_XP = 100;

/** Понедельник недели, в которую попадает дата (YYYY-MM-DD). */
export function weekStart(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7; // 0 = понедельник
  return addDays(date, -dow);
}

export interface WeeklyTemplate {
  id: string;
  title: string;
  hint: string;
  reward: number;
  rule: { target: number; type?: 'workout' | 'practice'; withPhoto?: boolean; distinctAreas?: boolean };
}

export const WEEKLY_TEMPLATES: WeeklyTemplate[] = [
  { id: 'w_workouts', title: '3 тренировки', hint: 'считается само по журналу', reward: 150, rule: { target: 3, type: 'workout' } },
  { id: 'w_photo', title: 'Практика с фото', hint: 'одна запись «Практика» с фото', reward: 100, rule: { target: 1, type: 'practice', withPhoto: true } },
  { id: 'w_areas', title: 'Три разных направления', hint: 'записи в трёх направлениях', reward: 150, rule: { target: 3, distinctAreas: true } },
];

export interface EntryFacts { date: string; type: string; hasPhoto: boolean; skillIds: string[]; primaryId?: string; areaIds: string[] }

/** Сколько набрано по правилу-счётчику среди записей с даты since. */
export function countProgress(
  rule: { target: number; type?: string; skillId?: string; areaId?: string; withPhoto?: boolean; distinctAreas?: boolean },
  entries: EntryFacts[],
  since: string,
) {
  const list = entries.filter(
    (e) =>
      e.date >= since &&
      e.type !== 'bonus' &&
      (!rule.type || e.type === rule.type) &&
      (!rule.withPhoto || e.hasPhoto) &&
      (!rule.skillId || e.skillIds.includes(rule.skillId)) &&
      (!rule.areaId || e.areaIds.includes(rule.areaId)),
  );
  const have = rule.distinctAreas ? new Set(list.flatMap((e) => e.areaIds)).size : list.length;
  return { have: Math.min(have, rule.target), target: rule.target, done: have >= rule.target, areas: [...new Set(list.flatMap((e) => e.areaIds))] };
}
