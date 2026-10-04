// Замеры, рекорды, прогноз рубежа. ARCHITECTURE.md §8.
import { addDays, daysBetween } from './dates';

export const RECORD_XP = 50;
export const MILESTONE_XP = 200;

export interface ValueLike { date: string; value: number; reps?: number }

/** Лучшее значение: для «больше» — максимум (при равенстве больше повторов), для «меньше» — минимум. */
export function bestValue<V extends ValueLike>(values: V[], better: 'up' | 'down'): V | undefined {
  let best: V | undefined;
  for (const v of values) {
    if (!best) best = v;
    else if (better === 'up' ? v.value > best.value || (v.value === best.value && (v.reps ?? 0) > (best.reps ?? 0)) : v.value < best.value) best = v;
  }
  return best;
}

/** Рекорд — лучше всех прошлых. Первое значение — точка отсчёта, не рекорд. */
export function isRecord(prev: ValueLike[], next: { value: number; reps?: number }, better: 'up' | 'down') {
  const best = bestValue(prev, better);
  if (!best) return false;
  if (better === 'down') return next.value < best.value;
  return next.value > best.value || (next.value === best.value && (next.reps ?? 0) > (best.reps ?? 0));
}

export const reached = (value: number, target: number, better: 'up' | 'down') => (better === 'up' ? value >= target : value <= target);

/** Доля пути от старта к цели, 0..1. */
export function milestoneProgress(start: number, current: number, target: number) {
  if (target === start) return 1;
  return Math.max(0, Math.min(1, (current - start) / (target - start)));
}

/**
 * Прогноз даты рубежа по темпу за последние 6 недель (линейная регрессия).
 * null — мало данных (меньше 3 значений) или движение не в ту сторону.
 */
export function forecastDate(values: ValueLike[], target: number, today: string): string | null {
  const from = addDays(today, -42);
  const pts = values.filter((v) => v.date >= from).map((v) => ({ x: daysBetween(from, v.date), y: v.value }));
  if (pts.length < 3) return null;
  const n = pts.length;
  const mx = pts.reduce((a, p) => a + p.x, 0) / n;
  const my = pts.reduce((a, p) => a + p.y, 0) / n;
  const sxx = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  if (sxx === 0) return null;
  const slope = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / sxx;
  const last = [...values].sort((a, b) => a.date.localeCompare(b.date)).at(-1)!;
  const left = target - last.value;
  if (left === 0) return today;
  if (slope === 0 || Math.sign(left) !== Math.sign(slope)) return null;
  return addDays(last.date, Math.ceil(left / slope));
}
