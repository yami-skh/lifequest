import { describe, expect, it } from 'vitest';
import { planImport, validateTemplate, type Template } from './templates';

const tpl: Template = {
  format: 1,
  id: 'test',
  title: 'Тест',
  areas: [{
    title: 'Тело',
    branches: [{
      title: 'Сила',
      skills: [
        { key: 'push', title: 'Отжимания', stages: [{ stage: 1, goals: [{ title: '20 отжиманий подряд', kind: 'practice' }, { title: 'Техника отжиманий', kind: 'theory' }] }], metric: { title: 'Отжимания', unit: 'раз', better: 'up' } },
        { key: 'pull', title: 'Подтягивания', requires: [{ skill: 'push', minLevel: 2 }], stages: [{ stage: 1, goals: [{ title: '5 подтягиваний', kind: 'practice' }] }, { stage: 2, goals: [{ title: '10 подтягиваний', kind: 'practice' }], boss: true }] },
      ],
    }],
  }],
  campaign: { title: 'Сильное тело', steps: [{ skill: 'push', stage: 1 }, { skill: 'pull', stage: 2 }] },
};

let n = 0;
const id = () => `id${++n}`;
const empty = { nodes: [], goals: [], metrics: [] };

describe('шаблоны: проверка', () => {
  it('правильный шаблон проходит', () => {
    expect(validateTemplate(tpl).ok).toBe(true);
  });
  it('ошибки понятны: неизвестный навык, пустая ступень, плохой kind', () => {
    const bad = JSON.parse(JSON.stringify(tpl));
    bad.areas[0].branches[0].skills[1].requires = [{ skill: 'nope' }];
    bad.areas[0].branches[0].skills[0].stages[0].goals[0].kind = 'other';
    bad.campaign.steps.push({ skill: 'ghost', stage: 1 });
    const r = validateTemplate(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.join('\n')).toMatch(/неизвестный навык «nope»/);
      expect(r.errors.join('\n')).toMatch(/kind theory\/practice/);
      expect(r.errors.join('\n')).toMatch(/Кампания: неизвестный навык «ghost»/);
    }
  });
  it('не объект и пустые направления', () => {
    expect(validateTemplate(null).ok).toBe(false);
    expect(validateTemplate({ ...tpl, areas: [] }).ok).toBe(false);
  });
});

describe('шаблоны: план импорта', () => {
  it('в пустое дерево — всё новое, требования и кампания связаны', () => {
    n = 0;
    const p = planImport(tpl, empty, id);
    expect(p.nodes.map((x) => `${x.kind}:${x.title}`)).toEqual(['area:Тело', 'branch:Сила', 'skill:Отжимания', 'skill:Подтягивания']);
    expect(p.goals).toHaveLength(4);
    expect(p.metrics).toHaveLength(1);
    const push = p.nodes.find((x) => x.title === 'Отжимания')!;
    expect(p.nodes.find((x) => x.title === 'Подтягивания')!.requires).toEqual([{ nodeId: push.id, minLevel: 2 }]);
    expect(p.quest?.steps.map((s) => s.title)).toEqual(['Отжимания: ступень 1', 'Подтягивания: ступень 2']);
  });
  it('повторный импорт ничего не дублирует', () => {
    n = 0;
    const first = planImport(tpl, empty, id);
    const have = {
      nodes: first.nodes.map(({ id, parentId, kind, title }) => ({ id, parentId, kind, title })),
      goals: first.goals.map(({ skillId, title }) => ({ skillId, title })),
      metrics: first.metrics.map(({ title }) => ({ title })),
    };
    const second = planImport(tpl, have, id);
    expect(second.nodes).toHaveLength(0);
    expect(second.goals).toHaveLength(0);
    expect(second.metrics).toHaveLength(0);
    expect(second.skipped).toEqual({ nodes: 4, goals: 4, metrics: 1, quest: false });
    const third = planImport(tpl, { ...have, quests: [{ title: 'сильное ТЕЛО' }] }, id);
    expect(third.quest).toBeUndefined();
    expect(third.skipped.quest).toBe(true);
  });
  it('совпадение по названию без учёта регистра и ё; у существующего навыка добавляются только новые цели', () => {
    n = 100;
    const have = {
      nodes: [
        { id: 'a', parentId: null, kind: 'area' as const, title: 'тело' },
        { id: 'b', parentId: 'a', kind: 'branch' as const, title: 'СИЛА' },
        { id: 's', parentId: 'b', kind: 'skill' as const, title: 'Отжимания' },
      ],
      goals: [{ skillId: 's', title: '20 отжиманий подряд' }],
      metrics: [],
    };
    const p = planImport(tpl, have, id);
    expect(p.nodes.map((x) => x.title)).toEqual(['Подтягивания']);
    expect(p.goals.filter((g) => g.skillId === 's').map((g) => g.title)).toEqual(['Техника отжиманий']);
    expect(p.skipped.goals).toBe(1);
  });
});
