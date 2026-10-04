import { describe, expect, it } from 'vitest';
import { calcXp, secondaryXp, xpContextFromHistory } from './xp';
import { characterLevel, skillLevel } from './levels';
import { computeProgress, skillProgress } from './progress';
import { bestStreak, currentStreak } from './dates';

describe('xp', () => {
  it('рамен из документа: практика, тяжело, впервые, с фото = 132', () => {
    const r = calcXp({ type: 'practice', difficulty: 3, firstOfTypeForSkill: true, sameSkillEntriesToday: 0, hasPhoto: true, fixesError: false });
    expect(r.xp).toBe(132);
  });
  it('4-я запись за день по навыку режется вдвое', () => {
    const r = calcXp({ type: 'learn', difficulty: 1, firstOfTypeForSkill: false, sameSkillEntriesToday: 3, hasPhoto: false, fixesError: false });
    expect(r.xp).toBe(10);
  });
  it('исправление ошибки ×1.5', () => {
    expect(calcXp({ type: 'practice', difficulty: 1, firstOfTypeForSkill: false, sameSkillEntriesToday: 0, hasPhoto: false, fixesError: true }).xp).toBe(60);
  });
  it('сопутствующие навыки получают половину', () => {
    expect(secondaryXp(132)).toBe(66);
  });
  it('контекст из истории', () => {
    const c = xpContextFromHistory(
      [{ type: 'learn', date: '2026-10-04' }, { type: 'practice', date: '2026-10-01' }],
      { type: 'practice', difficulty: 1, hasPhoto: false, fixesError: false },
      '2026-10-04',
    );
    expect(c.firstOfTypeForSkill).toBe(false);
    expect(c.sameSkillEntriesToday).toBe(1);
  });
});

describe('levels', () => {
  it('таблица уровней из документа', () => {
    expect(characterLevel(0)).toMatchObject({ level: 1, needed: 150 });
    expect(characterLevel(900).level).toBe(5);
    expect(characterLevel(899).level).toBe(4);
    expect(characterLevel(3150).level).toBe(10);
    expect(characterLevel(11400).level).toBe(20);
    expect(characterLevel(1830)).toMatchObject({ level: 7, into: 180, needed: 450 });
  });
  it('уровни навыка', () => {
    expect(skillLevel(0)).toMatchObject({ level: 0, name: 'Незнаком' });
    expect(skillLevel(340)).toMatchObject({ level: 3, name: 'Базовый', left: 160 });
    expect(skillLevel(5000)).toMatchObject({ level: 10, pct: 100 });
  });
});

describe('progress', () => {
  it('теория ×1, практика ×2', () => {
    const goals = [
      ...Array.from({ length: 5 }, (_, i) => ({ kind: 'theory' as const, done: i < 4 })),
      ...Array.from({ length: 4 }, (_, i) => ({ kind: 'practice' as const, done: i < 1 })),
    ];
    const p = skillProgress(goals)!;
    expect(Math.round(p.pct)).toBe(46);
    expect(p.done).toBe(5);
  });
  it('пустые узлы не тянут вниз', () => {
    const nodes = [
      { id: 'a', parentId: null, kind: 'area' as const },
      { id: 'b', parentId: 'a', kind: 'branch' as const },
      { id: 's1', parentId: 'b', kind: 'skill' as const },
      { id: 's2', parentId: 'b', kind: 'skill' as const },
      { id: 's3', parentId: 'a', kind: 'skill' as const },
    ];
    const goals = new Map([
      ['s1', [{ kind: 'theory' as const, done: true }]],
      ['s3', [{ kind: 'theory' as const, done: false }]],
    ]);
    const p = computeProgress(nodes, goals);
    expect(p.get('s2')).toBeNull();
    expect(p.get('b')).toBe(100);
    expect(p.get('a')).toBe(50);
  });
});

describe('streak', () => {
  it('серия засчитывается, если сегодня ещё не было записи', () => {
    expect(currentStreak(['2026-10-01', '2026-10-02', '2026-10-03'], '2026-10-04')).toBe(3);
    expect(currentStreak(['2026-10-01', '2026-10-02'], '2026-10-04')).toBe(0);
  });
  it('лучшая серия', () => {
    expect(bestStreak(['2026-09-30', '2026-10-01', '2026-10-03', '2026-10-04', '2026-10-05'])).toBe(3);
  });
});
