// Тесты базы: действия (actions.ts) и производные значения (world.ts → derive) на настоящей Dexie
// поверх fake-indexeddb (мастер-план §8: покрыть до логики «Следующего действия»).
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import {
  addGoal, addNode, addPresetSkill, completeQuest, createQuest, deleteEntry, deleteNode, finishOnboarding,
  importTemplate, moveNode, moveOrder, previewTemplate, saveEntry, setArchived, toggleFocus, toggleGoal, type EntryDraft,
} from './actions';
import { ensureStarter, seedIfEmpty } from './seed';
import { derive, loadWorld } from './world';
import { STAGE_BONUS } from '../engine/stages';
import { secondaryXp } from '../engine/xp';
import { TEMPLATES } from '../data/templates';
import { presetsFor } from '../data/presets';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.profile.add({ id: 'me', name: 'Тест', createdAt: new Date().toISOString(), starterVersion: 1 });
});

const world = async () => derive(await loadWorld());

/** Тело › Сила › Отжимания с целями: ступень 1 — две, ступень 2 — одна. */
async function skillWithGoals() {
  const area = await addNode(null, 'area', 'Тело', '#FF8A5B');
  const branch = await addNode(area.id, 'branch', 'Сила');
  const skill = await addNode(branch.id, 'skill', 'Отжимания');
  await addGoal(skill.id, 'theory', 'Техника', 1);
  await addGoal(skill.id, 'practice', '20 подряд', 1);
  await addGoal(skill.id, 'practice', '50 подряд', 2);
  const goals = await db.goals.where('skillId').equals(skill.id).sortBy('order');
  return { area, branch, skill, goals };
}

const draft = (primaryId: string, extra: Partial<EntryDraft> = {}): EntryDraft => ({
  type: 'practice', text: 'тренировка', difficulty: 2, primaryId, secondaryIds: [], closeGoalIds: [], outcome: 'ok', photos: [], ...extra,
});

describe('запись (saveEntry)', () => {
  it('начисляет XP основному навыку и половину — сопутствующему, закрывает цели', async () => {
    const { skill, goals } = await skillWithGoals();
    const other = await addNode(null, 'skill', 'Бег');
    const r = await saveEntry(draft(skill.id, { secondaryIds: [other.id], closeGoalIds: [goals[1].id] }));
    expect(r.xp).toBeGreaterThan(0);
    const w = await world();
    expect(w.xpBySkill.get(other.id)).toBe(secondaryXp(r.xp));
    expect(w.totalXp).toBe(r.xp);
    expect(w.goalsBySkill.get(skill.id)!.find((g) => g.id === goals[1].id)!.done).toBe(true);
  });

  it('закрытая ступень даёт бонус один раз, даже если цель сняли и закрыли снова', async () => {
    const { skill, goals } = await skillWithGoals();
    const r = await saveEntry(draft(skill.id, { closeGoalIds: [goals[0].id, goals[1].id] }));
    expect(r.stages).toEqual(['Новичок']);
    await toggleGoal(goals[1].id);
    expect(await toggleGoal(goals[1].id)).toEqual([]);
    const bonuses = (await db.entries.toArray()).filter((e) => e.type === 'bonus');
    expect(bonuses).toHaveLength(1);
    const w = await world();
    expect(w.xpBySkill.get(skill.id)).toBe(r.xp + STAGE_BONUS);
  });

  it('удаление записи убирает её XP', async () => {
    const { skill } = await skillWithGoals();
    const r = await saveEntry(draft(skill.id));
    await deleteEntry(r.entry.id);
    expect((await world()).totalXp).toBe(0);
  });
});

describe('ступени и прогресс (derive)', () => {
  it('текущая ступень — первая открытая незакрытая; цели следующей не предлагаются', async () => {
    const { skill, goals } = await skillWithGoals();
    let w = await world();
    expect(w.currentStageOf(skill.id)?.stage).toBe(1);
    expect(w.openGoalsOf(skill.id).map((g) => g.title)).toEqual(['Техника', '20 подряд']);
    await toggleGoal(goals[0].id);
    await toggleGoal(goals[1].id);
    w = await world();
    expect(w.currentStageOf(skill.id)?.stage).toBe(2);
    expect(w.openGoalsOf(skill.id).map((g) => g.title)).toEqual(['50 подряд']);
  });

  it('XP навыка поднимается до ветки и направления', async () => {
    const { area, branch, skill } = await skillWithGoals();
    const r = await saveEntry(draft(skill.id));
    const w = await world();
    expect(w.xpByNode.get(branch.id)).toBe(r.xp);
    expect(w.xpByNode.get(area.id)).toBe(r.xp);
    expect(w.areaOf(skill.id)?.id).toBe(area.id);
    expect(w.pathOf(skill.id).map((n) => n.title)).toEqual(['Тело', 'Сила', 'Отжимания']);
  });

  it('требование по прогрессу: закрыто, пока другой навык не дорос', async () => {
    const { skill, goals } = await skillWithGoals();
    const pull = await addNode(null, 'skill', 'Подтягивания');
    await db.nodes.update(pull.id, { requires: [{ nodeId: skill.id, minProgress: 50 }] });
    let w = await world();
    expect(w.lockReasons(w.nodeById.get(pull.id)!)).toHaveLength(1);
    // Техника (×1) + 20 подряд (×2) = 3 из 5 весов = 60%.
    await toggleGoal(goals[0].id);
    await toggleGoal(goals[1].id);
    w = await world();
    expect(w.lockReasons(w.nodeById.get(pull.id)!)).toEqual([]);
  });

  it('серия считает сегодняшнюю запись, бонусы — нет', async () => {
    const { skill, goals } = await skillWithGoals();
    await toggleGoal(goals[0].id);
    await toggleGoal(goals[1].id); // бонус за ступень — не действие
    expect((await world()).streak).toBe(0);
    await saveEntry(draft(skill.id));
    expect((await world()).streak).toBe(1);
  });
});

describe('фокус, удаление, квесты', () => {
  it('в фокусе не больше трёх навыков', async () => {
    const ids = await Promise.all(['a', 'b', 'c', 'd'].map(async (t) => (await addNode(null, 'skill', t)).id));
    for (const id of ids.slice(0, 3)) expect(await toggleFocus(id)).toBe(true);
    expect(await toggleFocus(ids[3])).toBe(false);
    expect((await world()).focusSkills).toHaveLength(3);
  });

  it('удаление ветки убирает навыки и цели, но XP персонажа остаётся', async () => {
    const { branch, skill } = await skillWithGoals();
    const r = await saveEntry(draft(skill.id));
    await deleteNode(branch.id);
    expect(await db.nodes.get(skill.id)).toBeUndefined();
    expect(await db.goals.where('skillId').equals(skill.id).count()).toBe(0);
    expect((await world()).totalXp).toBe(r.xp);
  });

  it('квест без навыка: награда персонажу, один раз', async () => {
    const q = await createQuest({ title: 'Тест', kind: 'side', rewardXp: 150, steps: [{ id: 's', kind: 'custom', title: 'шаг', done: true }] });
    expect(await completeQuest(q.id)).not.toBeNull();
    expect(await completeQuest(q.id)).toBeNull();
    expect((await world()).totalXp).toBe(150);
  });
});

describe('шаблоны и первый запуск', () => {
  const tpl = (id: string) => TEMPLATES.find((t) => t.id === id)!;

  it('импорт дважды не дублирует ничего', async () => {
    await importTemplate(await previewTemplate(tpl('strong-body')));
    const counts = async () => [await db.nodes.count(), await db.goals.count(), await db.metrics.count(), await db.quests.count()];
    const once = await counts();
    const again = await previewTemplate(tpl('strong-body'));
    expect([again.nodes.length, again.goals.length, again.metrics.length, again.quest]).toEqual([0, 0, 0, undefined]);
    await importTemplate(again);
    expect(await counts()).toEqual(once);
  });

  it('требования и кампания шаблона ведут на созданные навыки', async () => {
    await importTemplate(await previewTemplate(tpl('strong-body')));
    const w = await world();
    const pull = w.skills.find((s) => s.title === 'Подтягивания')!;
    expect(w.nodeById.get(pull.requires![0].nodeId)?.title).toBe('Отжимания');
    const quest = (await db.quests.toArray()).find((q) => q.title === tpl('strong-body').campaign!.title)!;
    for (const s of quest.steps) expect('skillId' in s && w.nodeById.has(s.skillId)).toBe(true);
  });

  it('новая установка: экран выбора, без старых стартовых замеров; после выбора — пути и стартовый квест', async () => {
    await db.delete();
    await db.open();
    await seedIfEmpty();
    await ensureStarter();
    expect((await db.profile.get('me'))?.onboarding).toBe(true);
    expect(await db.metrics.count()).toBe(0);
    await finishOnboarding([tpl('start'), tpl('strong-body')], '  Yami ');
    const w = await world();
    expect(w.profile?.onboarding).toBe(false);
    expect(w.profile?.name).toBe('Yami');
    expect(w.skills).toHaveLength(11);
    expect(w.quests.map((q) => q.title)).toContain('Обустрой персонажа');
  });

  it('готовый навык: цели по ступеням и замер, замер не дублируется', async () => {
    const { branch } = await skillWithGoals();
    const pull = presetsFor('Тело').find((s) => s.title === 'Подтягивания')!;
    await addPresetSkill(branch.id, pull);
    await addPresetSkill(branch.id, pull);
    const w = await world();
    const added = w.skills.filter((s) => s.title === 'Подтягивания');
    expect(added).toHaveLength(2);
    expect(w.stagesOfSkill(added[0].id).map((s) => s.goals.length)).toEqual(pull.stages.map((s) => s.goals.length));
    expect(w.metrics.filter((m) => m.title === 'Подтягивания')).toHaveLength(1);
  });
});

describe('следующее действие (derive)', () => {
  it('«Сделал шаг» считается по цели, «Цель выполнена» закрывает её и двигает дальше', async () => {
    const { skill, goals } = await skillWithGoals();
    await toggleFocus(skill.id);
    let [a] = (await world()).nextActions();
    expect(a.kind === 'goal' && [a.goal.id, a.steps, a.left]).toEqual([goals[0].id, 0, 2]);
    await saveEntry(draft(skill.id, { stepGoalIds: [goals[0].id] }));
    [a] = (await world()).nextActions();
    expect(a.kind === 'goal' && a.steps).toBe(1);
    await saveEntry(draft(skill.id, { stepGoalIds: [goals[0].id], closeGoalIds: [goals[0].id] }));
    expect((await db.entries.toArray()).filter((e) => e.stepGoalIds).length).toBe(1);
    [a] = (await world()).nextActions();
    expect(a.kind === 'goal' && [a.goal.id, a.left]).toEqual([goals[1].id, 1]);
  });
  it('нет активных путей — предложения из навыков с целями', async () => {
    const { skill } = await skillWithGoals();
    const w = await world();
    expect(w.nextActions()).toEqual([]);
    expect(w.suggestPaths().map((x) => x.skillId)).toEqual([skill.id]);
  });
});

describe('дерево: перенос, порядок, архив', () => {
  it('перенос навыка в другую ветку: цели, XP и требования остаются с ним, ставится в конец', async () => {
    const { area, skill, goals } = await skillWithGoals();
    const zal = await addNode(area.id, 'branch', 'Зал');
    await addNode(zal.id, 'skill', 'Жим');
    const pull = await addNode(area.id, 'skill', 'Подтягивания');
    await db.nodes.update(pull.id, { requires: [{ nodeId: skill.id, minLevel: 1 }] });
    await saveEntry(draft(skill.id, { closeGoalIds: [goals[0].id] }));
    const xpBefore = (await world()).xpBySkill.get(skill.id);
    await moveNode(skill.id, zal.id);
    const w = await world();
    expect(w.nodeById.get(skill.id)!.parentId).toBe(zal.id);
    expect(w.children.get(zal.id)!.map((n) => n.title)).toEqual(['Жим', 'Отжимания']);
    expect(w.xpBySkill.get(skill.id)).toBe(xpBefore);
    expect(w.goalsBySkill.get(skill.id)).toHaveLength(3);
    expect(w.requirementsOf(w.nodeById.get(pull.id)!)[0].node.id).toBe(skill.id);
  });
  it('ветку нельзя перенести внутрь самой себя; в навык — нельзя', async () => {
    const { area, branch, skill } = await skillWithGoals();
    const inner = await addNode(branch.id, 'branch', 'Внутри');
    await expect(moveNode(branch.id, inner.id)).rejects.toThrow();
    await expect(moveNode(branch.id, skill.id)).rejects.toThrow();
    await moveNode(branch.id, area.id); // уже там — ничего не меняется
    expect((await db.nodes.get(branch.id))!.parentId).toBe(area.id);
  });
  it('выше / ниже меняет порядок соседей; у края — false', async () => {
    const { branch } = await skillWithGoals();
    await addNode(branch.id, 'skill', 'Жим');
    await addNode(branch.id, 'skill', 'Присед');
    const kids = await db.nodes.where('parentId').equals(branch.id).toArray();
    const zhim = kids.find((n) => n.title === 'Жим')!;
    expect(await moveOrder(zhim.id, -1)).toBe(true);
    expect((await world()).children.get(branch.id)!.map((n) => n.title)).toEqual(['Жим', 'Отжимания', 'Присед']);
    expect(await moveOrder(zhim.id, -1)).toBe(false);
  });
  it('архив: навык пропадает из дерева и списков, перестаёт быть активным; XP персонажа сохраняется; возврат', async () => {
    const { branch, skill } = await skillWithGoals();
    await saveEntry(draft(skill.id));
    await toggleFocus(skill.id);
    const total = (await world()).totalXp;
    await setArchived(skill.id, true);
    let w = await world();
    expect(w.skills.map((n) => n.id)).not.toContain(skill.id);
    expect(w.children.get(branch.id) ?? []).toEqual([]);
    expect(w.archived.map((n) => n.id)).toEqual([skill.id]);
    expect(w.focusSkills).toEqual([]);
    expect(w.recentSkills.map((n) => n.id)).not.toContain(skill.id);
    expect(w.totalXp).toBe(total);
    await setArchived(skill.id, false);
    w = await world();
    expect(w.children.get(branch.id)!.map((n) => n.id)).toEqual([skill.id]);
    expect(w.archived).toEqual([]);
  });
});