// Уровни персонажа и навыков. ARCHITECTURE.md §4.3–4.4.

export const xpToNext = (level: number) => 100 + 50 * level;

export function characterLevel(totalXp: number) {
  let level = 1;
  let floor = 0;
  while (totalXp >= floor + xpToNext(level)) {
    floor += xpToNext(level);
    level++;
  }
  const needed = xpToNext(level);
  const into = totalXp - floor;
  return { level, into, needed, left: needed - into, pct: (into / needed) * 100 };
}

export const SKILL_LEVELS = [
  { min: 0, name: 'Незнаком' },
  { min: 50, name: 'Знакомство' },
  { min: 150, name: 'Новичок' },
  { min: 300, name: 'Базовый' },
  { min: 500, name: 'Уверенный' },
  { min: 800, name: 'Продвинутый' },
  { min: 1200, name: 'Компетентный' },
  { min: 1700, name: 'Сильный' },
  { min: 2300, name: 'Эксперт' },
  { min: 3000, name: 'Мастер' },
  { min: 4000, name: 'Выдающийся' },
];

export function skillLevel(xp: number) {
  let level = 0;
  while (level + 1 < SKILL_LEVELS.length && xp >= SKILL_LEVELS[level + 1].min) level++;
  const cur = SKILL_LEVELS[level];
  const next = SKILL_LEVELS[level + 1];
  return {
    level,
    name: cur.name,
    xp,
    left: next ? next.min - xp : 0,
    pct: next ? ((xp - cur.min) / (next.min - cur.min)) * 100 : 100,
  };
}
