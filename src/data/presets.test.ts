import { describe, expect, it } from 'vitest';
import { presetsFor } from './presets';
import { TEMPLATES } from './templates';
import { planImportMany, templateSkills } from '../engine/templates';

const AREAS = ['Тело', 'Интеллект', 'Разум', 'Общение', 'Деньги', 'Творчество', 'Технологии', 'Практика'];

describe('готовые навыки (пресеты)', () => {
  it('в каждом направлении не меньше трёх, без повторов по названию', () => {
    for (const a of AREAS) {
      const list = presetsFor(a);
      expect(list.length, a).toBeGreaterThanOrEqual(3);
      expect(new Set(list.map((s) => s.title.toLowerCase())).size, a).toBe(list.length);
    }
  });
  it('у каждого есть ступени с целями; регистр и ё в названии направления не важны', () => {
    for (const s of presetsFor('тело')) expect(s.stages.every((st) => st.goals.length > 0), s.title).toBe(true);
    expect(presetsFor('ТЕЛО').length).toBe(presetsFor('Тело').length);
  });
  it('незнакомое направление — пресетов нет, только свой навык', () => {
    expect(presetsFor('Работа')).toEqual([]);
  });
});

describe('первый запуск: несколько путей сразу', () => {
  it('совпадающие навыки не дублируются: «Старт» + «Сильное тело» = 11 навыков', () => {
    let n = 0;
    const ts = ['start', 'strong-body'].map((id) => TEMPLATES.find((t) => t.id === id)!);
    const plans = planImportMany(ts, { nodes: [], goals: [], metrics: [] }, () => `n${++n}`);
    const created = plans.reduce((s, p) => s + p.skills.filter((x) => x.isNew).length, 0);
    expect(created).toBe(templateSkills(ts[0]).length + templateSkills(ts[1]).length - 1);
    expect(plans[1].skipped.goals).toBeGreaterThanOrEqual(3);
  });
  it('все пути вместе — без ошибок и без двойных кампаний', () => {
    let n = 0;
    const plans = planImportMany(TEMPLATES, { nodes: [], goals: [], metrics: [] }, () => `n${++n}`);
    expect(plans.filter((p) => p.skipped.quest)).toEqual([]);
  });
});
