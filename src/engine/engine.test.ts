import { describe, expect, it } from 'vitest';
import { calcXp, secondaryXp, xpContextFromHistory } from './xp';
import { characterLevel, skillLevel } from './levels';
import { computeProgress, skillProgress } from './progress';
import { bestStreak, currentStreak } from './dates';
import { assignStages, currentStage, stagesOf } from './stages';
import { bestRepsAt, bestSet, bestValue, forecastDate, isRecord, milestoneProgress, reached, valueFromSets } from './metrics';
import { countProgress, weekStart } from './quests';
import { cmpVersion, unseenReleases } from './version';
import { EXPERIMENTS, hasExp, toggleExp } from './experiments';
import { SNAPSHOT_KEEP, snapshotsToPrune } from './snapshots';

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

describe('фокус, возвращение, ступени', () => {
  const base = { type: 'practice' as const, difficulty: 1 as const, firstOfTypeForSkill: false, sameSkillEntriesToday: 0, hasPhoto: false, fixesError: false };
  it('фокус ×1.2', () => {
    expect(calcXp({ ...base, isFocus: true }).xp).toBe(48);
  });
  it('возвращение после 60 дней ×1.5, раньше — нет', () => {
    expect(calcXp({ ...base, daysSinceLast: 60 }).xp).toBe(60);
    expect(calcXp({ ...base, daysSinceLast: 59 }).xp).toBe(40);
  });
  it('дни с последней записи берутся из истории', () => {
    const c = xpContextFromHistory([{ type: 'learn', date: '2026-08-01' }], { type: 'learn', difficulty: 1, hasPhoto: false, fixesError: false }, '2026-10-04');
    expect(c.daysSinceLast).toBe(64);
  });
  it('следующая ступень открывается после предыдущей', () => {
    const s = stagesOf([
      { stage: 1, done: true }, { stage: 1, done: true },
      { stage: 2, done: true }, { stage: 2, done: false },
      { stage: 3, done: false },
    ]);
    expect(s.map((x) => [x.stage, x.complete, x.unlocked])).toEqual([[1, true, true], [2, false, true], [3, false, false]]);
    expect(currentStage(s)?.name).toBe('Базовый');
  });
  it('раскладка целей по ступеням: теория — 1, практика пополам на 2 и 3', () => {
    const k = (kind: 'theory' | 'practice') => ({ kind });
    expect(assignStages([k('theory'), k('theory'), k('practice'), k('practice'), k('practice')])).toEqual([1, 1, 2, 2, 3]);
    expect(assignStages([k('practice'), k('practice')])).toEqual([1, 2]);
  });
});

describe('замеры', () => {
  const v = (date: string, value: number, reps?: number) => ({ date, value, reps });
  it('первое значение — не рекорд; дальше рекорд по весу, а при равном весе — по повторам', () => {
    expect(isRecord([], { value: 60 }, 'up')).toBe(false);
    expect(isRecord([v('2026-10-01', 60, 6)], { value: 62, reps: 5 }, 'up')).toBe(true);
    expect(isRecord([v('2026-10-01', 60, 6)], { value: 60, reps: 8 }, 'up')).toBe(true);
    expect(isRecord([v('2026-10-01', 60, 6)], { value: 60, reps: 6 }, 'up')).toBe(false);
  });
  it('для «лучше меньше» рекорд — новое минимальное', () => {
    expect(isRecord([v('2026-10-01', 75)], { value: 74.2 }, 'down')).toBe(true);
    expect(bestValue([v('a', 75), v('b', 74), v('c', 76)], 'down')?.value).toBe(74);
  });
  it('рубеж: достигнут и доля пути', () => {
    expect(reached(80, 80, 'up')).toBe(true);
    expect(reached(74, 73, 'down')).toBe(false);
    expect(milestoneProgress(50, 62, 80)).toBeCloseTo(0.4);
    expect(milestoneProgress(76, 74, 72)).toBeCloseTo(0.5);
  });
  it('прогноз: +2 кг в неделю от 62 до 80 — через 9 недель', () => {
    const vals = [v('2026-09-06', 56), v('2026-09-13', 58), v('2026-09-20', 60), v('2026-09-27', 62)];
    expect(forecastDate(vals, 80, '2026-10-04')).toBe('2026-11-29');
    expect(forecastDate(vals.slice(0, 2), 80, '2026-10-04')).toBeNull();
    expect(forecastDate(vals, 40, '2026-10-04')).toBeNull();
  });
});

describe('подходы', () => {
  it('лучший подход: тяжелее, при равном весе — больше повторов', () => {
    expect(bestSet([{ w: 60, r: 8 }, { w: 62.5, r: 6 }, { w: 62.5, r: 5 }])).toEqual({ w: 62.5, r: 6 });
    expect(bestSet([{ r: 8 }, { r: 10 }, { r: 9 }])).toEqual({ r: 10 });
    expect(bestSet([{ w: 60, r: 0 }])).toBeUndefined();
  });
  it('значение из подходов', () => {
    expect(valueFromSets([{ w: 60, r: 8 }, { w: 62.5, r: 6 }], true)).toEqual({ value: 62.5, reps: 6 });
    expect(valueFromSets([{ r: 8 }, { r: 10 }], false)).toEqual({ value: 10 });
  });
  it('рубеж «60 кг на 10 раз»: лучшие повторы с весом не меньше 60', () => {
    const vals = [{ value: 62.5, reps: 6, sets: [{ w: 60, r: 8 }, { w: 62.5, r: 6 }] }, { value: 55, reps: 12 }];
    expect(bestRepsAt(vals, 60)).toBe(8);
  });
});

describe('квесты', () => {
  it('понедельник недели', () => {
    expect(weekStart('2026-10-04')).toBe('2026-09-28'); // воскресенье
    expect(weekStart('2026-10-05')).toBe('2026-10-05'); // понедельник
  });
  it('счётчики записей', () => {
    const e = (date: string, type: string, areas: string[], photo = false) => ({ date, type, hasPhoto: photo, skillIds: ['s'], areaIds: areas });
    const list = [e('2026-09-30', 'workout', ['body']), e('2026-10-01', 'workout', ['body']), e('2026-09-20', 'workout', ['body']), e('2026-10-02', 'practice', ['prac'], true), e('2026-10-02', 'bonus', ['x'])];
    expect(countProgress({ target: 3, type: 'workout' }, list, '2026-09-28')).toMatchObject({ have: 2, done: false });
    expect(countProgress({ target: 1, type: 'practice', withPhoto: true }, list, '2026-09-28').done).toBe(true);
    expect(countProgress({ target: 3, distinctAreas: true }, list, '2026-09-28').have).toBe(2);
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

describe('версии', () => {
  it('сравнение', () => {
    expect(cmpVersion('0.5.1', '0.5.0')).toBeGreaterThan(0);
    expect(cmpVersion('0.10.0', '0.9.9')).toBeGreaterThan(0);
    expect(cmpVersion('1.0.0', '1.0.0')).toBe(0);
  });
  it('что показать после обновления', () => {
    const list = [{ version: '0.7.0' }, { version: '0.6.0' }, { version: '0.5.1' }, { version: '0.5.0' }];
    expect(unseenReleases(list, '0.5.0', '0.6.0').map((r) => r.version)).toEqual(['0.6.0', '0.5.1']);
    expect(unseenReleases(list, '0.6.0', '0.6.0')).toEqual([]);
  });
});

describe('эксперименты', () => {
  it('по умолчанию всё выключено', () => {
    expect(hasExp(undefined, 'next-action')).toBe(false);
    expect(hasExp([], 'next-action')).toBe(false);
  });
  it('включается только названный', () => {
    expect(hasExp(['next-action'], 'next-action')).toBe(true);
    expect(hasExp(['next-action'], 'other')).toBe(false);
  });
  it('переключение без повторов', () => {
    expect(toggleExp(undefined, 'a')).toEqual(['a']);
    expect(toggleExp(['a', 'b'], 'a')).toEqual(['b']);
    expect(toggleExp(toggleExp(['b'], 'a'), 'a')).toEqual(['b']);
  });
  it('у известных экспериментов уникальные id', () => {
    expect(new Set(EXPERIMENTS.map((e) => e.id)).size).toBe(EXPERIMENTS.length);
  });
});

describe('снимки перед восстановлением', () => {
  const s = (id: string, day: number) => ({ id, createdAt: `2026-10-${String(day).padStart(2, '0')}T10:00:00Z` });
  it('хранятся 3 последних', () => {
    expect(SNAPSHOT_KEEP).toBe(3);
    expect(snapshotsToPrune([s('a', 1), s('b', 2), s('c', 3)])).toEqual([]);
    expect(snapshotsToPrune([s('a', 1), s('d', 4), s('b', 2), s('c', 3)])).toEqual(['a']);
  });
  it('удаляются самые старые, порядок входа не важен', () => {
    expect(snapshotsToPrune([s('e', 5), s('a', 1), s('c', 3), s('b', 2), s('d', 4)]).sort()).toEqual(['a', 'b']);
  });
});
