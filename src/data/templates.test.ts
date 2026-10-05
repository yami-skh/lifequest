import { describe, expect, it } from 'vitest';
import { TEMPLATES } from './templates';
import { planImport, validateTemplate, type TplBranch, type TplGoal } from '../engine/templates';

const goalsOf = (b: TplBranch): TplGoal[] => [...(b.skills ?? []).flatMap((s) => s.stages.flatMap((st) => st.goals)), ...(b.branches ?? []).flatMap(goalsOf)];

describe('готовые шаблоны', () => {
  it('все проходят проверку формата', () => {
    for (const t of TEMPLATES) {
      const r = validateTemplate(t);
      expect(r.ok ? [] : r.errors, t.id).toEqual([]);
    }
  });
  it('уникальные id', () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
  });
  it('практики не меньше теории (мастер-план §3: около 30/70)', () => {
    for (const t of TEMPLATES) {
      const goals = t.areas.flatMap((a) => a.branches.flatMap(goalsOf));
      const practice = goals.filter((g) => g.kind === 'practice').length;
      expect(practice / goals.length, t.id).toBeGreaterThanOrEqual(0.6);
    }
  });
  it('в пустое дерево каждый шаблон импортируется без пропусков', () => {
    let n = 0;
    for (const t of TEMPLATES) {
      const p = planImport(t, { nodes: [], goals: [], metrics: [] }, () => `id${++n}`);
      expect(p.skipped.goals, t.id).toBe(0);
      expect(p.goals.length, t.id).toBeGreaterThan(0);
    }
  });
});
