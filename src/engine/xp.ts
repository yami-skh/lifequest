// Начисление XP за запись журнала. ARCHITECTURE.md §4.1–4.2.
import { daysBetween } from './dates';

export type EntryType = 'learn' | 'practice' | 'workout' | 'project' | 'course' | 'teach' | 'bonus';
export type Difficulty = 1 | 2 | 3;

export const ENTRY_TYPES: { id: Exclude<EntryType, 'bonus'>; label: string; base: number }[] = [
  { id: 'learn', label: 'Изучил', base: 20 },
  { id: 'practice', label: 'Практика', base: 40 },
  { id: 'workout', label: 'Тренировка', base: 30 },
  { id: 'project', label: 'Проект', base: 120 },
  { id: 'course', label: 'Курс / книга', base: 150 },
  { id: 'teach', label: 'Объяснил', base: 60 },
];

export const ENTRY_TYPE_LABEL: Record<EntryType, string> = {
  learn: 'Изучил', practice: 'Практика', workout: 'Тренировка', project: 'Проект',
  course: 'Курс / книга', teach: 'Объяснил', bonus: 'Бонус',
};

export const BASE_XP: Record<EntryType, number> = {
  learn: 20, practice: 40, workout: 30, project: 120, course: 150, teach: 60, bonus: 0,
};

export const DIFFICULTIES: { id: Difficulty; label: string; mult: number }[] = [
  { id: 1, label: 'Легко', mult: 1 },
  { id: 2, label: 'Средне', mult: 1.5 },
  { id: 3, label: 'Тяжело', mult: 2 },
];

/** Сколько записей по одному навыку за день дают полный XP. */
export const REPEAT_FREE_PER_DAY = 3;
/** Доля XP для сопутствующих навыков. */
export const SECONDARY_SHARE = 0.5;

export interface XpContext {
  type: EntryType;
  difficulty: Difficulty;
  /** Первая запись этого типа по основному навыку. */
  firstOfTypeForSkill: boolean;
  /** Сколько записей по основному навыку уже есть сегодня. */
  sameSkillEntriesToday: number;
  hasPhoto: boolean;
  fixesError: boolean;
  /** Основной навык в фокусе (§16, идея 1). */
  isFocus?: boolean;
  /** Дней с последней записи по навыку; null — записей не было (§16, идея 6). */
  daysSinceLast?: number | null;
}

/** Через сколько дней без записей навык «ржавеет». */
export const RUST_DAYS = 60;

export interface XpFactor { label: string; mult: number }

export function calcXp(c: XpContext): { xp: number; base: number; factors: XpFactor[] } {
  const base = BASE_XP[c.type];
  const factors: XpFactor[] = [];
  const d = DIFFICULTIES.find((x) => x.id === c.difficulty)!;
  if (d.mult !== 1) factors.push({ label: d.label.toLowerCase(), mult: d.mult });
  if (c.firstOfTypeForSkill) factors.push({ label: 'впервые', mult: 1.5 });
  if (c.sameSkillEntriesToday >= REPEAT_FREE_PER_DAY) factors.push({ label: 'повтор', mult: 0.5 });
  if (c.hasPhoto) factors.push({ label: 'фото', mult: 1.1 });
  if (c.fixesError) factors.push({ label: 'исправление', mult: 1.5 });
  if (c.isFocus) factors.push({ label: 'фокус', mult: 1.2 });
  if (c.daysSinceLast != null && c.daysSinceLast >= RUST_DAYS) factors.push({ label: 'возвращение', mult: 1.5 });
  const xp = Math.round(factors.reduce((acc, f) => acc * f.mult, base));
  return { xp, base, factors };
}

export const secondaryXp = (primaryXp: number) => Math.round(primaryXp * SECONDARY_SHARE);

/** Контекст для расчёта по истории основного навыка. */
export function xpContextFromHistory(
  history: { type: EntryType; date: string }[],
  draft: Omit<XpContext, 'firstOfTypeForSkill' | 'sameSkillEntriesToday' | 'daysSinceLast'>,
  today: string,
): XpContext {
  const last = history.reduce<string | null>((m, h) => (m === null || h.date > m ? h.date : m), null);
  return {
    ...draft,
    firstOfTypeForSkill: !history.some((h) => h.type === draft.type),
    sameSkillEntriesToday: history.filter((h) => h.date === today).length,
    daysSinceLast: last ? daysBetween(last, today) : null,
  };
}
