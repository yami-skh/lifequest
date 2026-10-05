import { describe, expect, it } from 'vitest';
import { buildWeekCard, type CardInput } from './friends';

// 2026-10-06 — вторник; неделя с понедельника 2026-10-05.
const base: CardInput = {
  name: ' Yami ', level: 7, streak: 3, today: '2026-10-06',
  entries: [
    { id: 'e1', date: '2026-10-05', type: 'workout' },
    { id: 'e2', date: '2026-10-05', type: 'learn' },
    { id: 'e3', date: '2026-10-06', type: 'practice' },
    { id: 'e4', date: '2026-10-04', type: 'workout' }, // прошлая неделя
    { id: 'b1', date: '2026-10-06', type: 'bonus', rewardXp: 100 },
  ],
  entrySkills: [
    { entryId: 'e1', skillId: 'push', role: 'primary', xp: 30 },
    { entryId: 'e1', skillId: 'run', role: 'secondary', xp: 10 },
    { entryId: 'e2', skillId: 'py', role: 'primary', xp: 20 },
    { entryId: 'e3', skillId: 'push', role: 'primary', xp: 40 },
    { entryId: 'e4', skillId: 'push', role: 'primary', xp: 999 },
  ],
  goals: [
    { done: true, doneAt: new Date(2026, 9, 5, 12).toISOString() },
    { done: true, doneAt: new Date(2026, 9, 1, 12).toISOString() },
    { done: false },
  ],
  areaOf: (id) => (id === 'py' ? { title: 'Технологии', color: '#B9A4FF' } : { title: 'Тело', color: '#FF8A5B' }),
  skillTitle: (id) => ({ push: 'Отжимания', py: 'Python' })[id],
};

describe('карточка недели для друзей', () => {
  it('считает только эту неделю: дни с действием, закрытые цели, XP (основной навык + бонусы)', () => {
    const c = buildWeekCard(base);
    expect(c).toMatchObject({ name: 'Yami', level: 7, streak: 3, week: '2026-10-05', days: 2, goalsDone: 1, xp: 190 });
  });
  it('направления — по числу действий; названия навыков по умолчанию скрыты', () => {
    const c = buildWeekCard(base);
    expect(c.areas).toEqual([
      { title: 'Тело', color: '#FF8A5B', note: '2 действия' },
      { title: 'Технологии', color: '#B9A4FF', note: '1 действие' },
    ]);
    expect(c.skills).toBeUndefined();
  });
  it('выключенные настройки не уходят: только имя, уровень, серия', () => {
    const c = buildWeekCard(base, { week: false, areas: true, skills: true });
    expect(c).toEqual({ name: 'Yami', level: 7, streak: 3, week: '2026-10-05', days: 0, goalsDone: 0, xp: 0 });
    expect(buildWeekCard(base, { week: true, areas: false, skills: true })).toMatchObject({ skills: ['Отжимания', 'Python'] });
    expect(buildWeekCard(base, { week: true, areas: false, skills: false }).areas).toBeUndefined();
  });
  it('пустое имя — «Герой»', () => {
    expect(buildWeekCard({ ...base, name: '  ' }).name).toBe('Герой');
  });
});
