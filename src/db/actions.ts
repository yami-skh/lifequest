// Все изменения данных.
import { db, nowIso, uid, type Entry, type Metric, type Milestone, type Node, type NodeKind, type Quest, type Requirement } from './db';
import { WEEKLY_TEMPLATES, weekStart } from '../engine/quests';
import { MILESTONE_XP, RECORD_XP, bestRepsAt, isRecord, reached, valueFromSets, type WorkSet } from '../engine/metrics';
import { STAGE_BONUS, stagesOf } from '../engine/stages';
import { calcXp, secondaryXp, xpContextFromHistory, type Difficulty, type EntryType } from '../engine/xp';
import { localDate } from '../engine/dates';
import type { GoalKind } from '../engine/progress';

export interface PhotoDraft { blob: Blob; thumb: Blob; width: number; height: number }

export interface EntryDraft {
  type: EntryType;
  text: string;
  difficulty: Difficulty;
  primaryId: string;
  secondaryIds: string[];
  closeGoalIds: string[];
  outcome: 'ok' | 'fail';
  failNote?: string;
  fixesEntryId?: string;
  photos: PhotoDraft[];
}

/** История основного навыка — нужна для «впервые» и «повтор». */
export async function primaryHistory(skillId: string) {
  const links = await db.entrySkills.where('skillId').equals(skillId).filter((s) => s.role === 'primary').toArray();
  const entries = await db.entries.bulkGet(links.map((l) => l.entryId));
  // Бонусы за ступени — не действия брата, в «впервые» и «повтор» их не считаем.
  return entries.filter((e): e is Entry => !!e && e.type !== 'bonus').map((e) => ({ type: e.type, date: e.date }));
}

export async function saveEntry(d: EntryDraft) {
  const today = localDate();
  const createdAt = nowIso();
  const result = await db.transaction('rw', [db.entries, db.entrySkills, db.goals, db.photos, db.nodes], async () => {
    const history = await primaryHistory(d.primaryId);
    const primary = await db.nodes.get(d.primaryId);
    const ctx = xpContextFromHistory(
      history,
      { type: d.type, difficulty: d.difficulty, hasPhoto: d.photos.length > 0, fixesError: !!d.fixesEntryId, isFocus: !!primary?.focus },
      today,
    );
    const { xp } = calcXp(ctx);

    const photoIds: string[] = [];
    for (const p of d.photos) {
      const id = uid();
      await db.photos.add({ id, ...p, createdAt });
      photoIds.push(id);
    }

    const entry: Entry = {
      id: uid(),
      date: today,
      type: d.type,
      text: d.text.trim(),
      difficulty: d.difficulty,
      closedGoalIds: d.closeGoalIds,
      outcome: d.outcome,
      photoIds,
      createdAt,
    };
    if (d.outcome === 'fail' && d.failNote?.trim()) entry.failNote = d.failNote.trim();
    if (d.fixesEntryId) entry.fixesEntryId = d.fixesEntryId;
    await db.entries.add(entry);

    await db.entrySkills.add({ entryId: entry.id, skillId: d.primaryId, role: 'primary', xp });
    const sec = secondaryXp(xp);
    for (const id of d.secondaryIds) {
      if (id !== d.primaryId) await db.entrySkills.add({ entryId: entry.id, skillId: id, role: 'secondary', xp: sec });
    }
    for (const id of d.closeGoalIds) await db.goals.update(id, { done: true, doneAt: createdAt });
    return { entry, xp };
  });
  const stages = await awardStages(d.primaryId);
  return { ...result, stages };
}

export async function deleteEntry(id: string) {
  await db.transaction('rw', [db.entries, db.entrySkills, db.photos], async () => {
    const e = await db.entries.get(id);
    if (!e) return;
    await db.photos.bulkDelete(e.photoIds);
    await db.entrySkills.where('entryId').equals(id).delete();
    await db.entries.delete(id);
  });
}

// --- цели ---

export async function toggleGoal(id: string) {
  const g = await db.goals.get(id);
  if (!g) return [];
  await db.goals.update(id, g.done ? { done: false, doneAt: undefined } : { done: true, doneAt: nowIso() });
  return g.done ? [] : awardStages(g.skillId);
}

export async function addGoal(skillId: string, kind: GoalKind, title: string, stage: number) {
  const count = await db.goals.where('skillId').equals(skillId).count();
  await db.goals.add({ id: uid(), skillId, kind, title: title.trim(), done: false, stage, order: count });
}

/**
 * Бонус за каждую впервые пройденную ступень: отдельная запись «Бонус»
 * на +STAGE_BONUS XP основному навыку. Возвращает названия пройденных ступеней.
 */
export async function awardStages(skillId: string): Promise<string[]> {
  return db.transaction('rw', [db.nodes, db.goals, db.entries, db.entrySkills], async () => {
    const node = await db.nodes.get(skillId);
    if (!node) return [];
    const goals = await db.goals.where('skillId').equals(skillId).toArray();
    const awarded = new Set(node.stagesAwarded ?? []);
    const fresh = stagesOf(goals).filter((s) => s.complete && s.unlocked && !awarded.has(s.stage));
    if (!fresh.length) return [];
    const createdAt = nowIso();
    for (const st of fresh) {
      const entry: Entry = {
        id: uid(), date: localDate(), type: 'bonus', text: `Ступень «${st.name}» пройдена · ${node.title}`,
        difficulty: 1, closedGoalIds: [], outcome: 'ok', photoIds: [], createdAt,
      };
      await db.entries.add(entry);
      await db.entrySkills.add({ entryId: entry.id, skillId, role: 'primary', xp: STAGE_BONUS });
      awarded.add(st.stage);
    }
    await db.nodes.update(skillId, { stagesAwarded: [...awarded] });
    return fresh.map((s) => s.name);
  });
}

/** Включает или выключает фокус. Не больше трёх навыков: при переполнении вернёт false. */
export async function toggleFocus(id: string) {
  const n = await db.nodes.get(id);
  if (!n) return false;
  if (!n.focus && (await db.nodes.filter((x) => !!x.focus).count()) >= 3) return false;
  await db.nodes.update(id, { focus: !n.focus });
  return true;
}

export const setRequirements = (id: string, requires: Requirement[]) => db.nodes.update(id, { requires });

export const deleteGoal = (id: string) => db.goals.delete(id);

// --- дерево ---

export async function addNode(parentId: string | null, kind: NodeKind, title: string, color?: string, icon?: string) {
  // null не попадает в индекс Dexie, поэтому направления считаем по kind.
  const count = parentId
    ? await db.nodes.where('parentId').equals(parentId).count()
    : await db.nodes.where('kind').equals('area').count();
  const node: Node = { id: uid(), parentId, kind, title: title.trim(), order: count, createdAt: nowIso() };
  if (color) node.color = color;
  if (icon) node.icon = icon;
  await db.nodes.add(node);
  return node;
}

export const renameNode = (id: string, title: string) => db.nodes.update(id, { title: title.trim() });

/** Удаляет узел с поддеревом и целями. Записи журнала и XP персонажа остаются. */
export async function deleteNode(id: string) {
  await db.transaction('rw', [db.nodes, db.goals, db.notes], async () => {
    const ids: string[] = [];
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      ids.push(cur);
      const kids = await db.nodes.where('parentId').equals(cur).primaryKeys();
      stack.push(...kids);
    }
    await db.goals.where('skillId').anyOf(ids).delete();
    await db.notes.where('skillId').anyOf(ids).delete();
    await db.nodes.bulkDelete(ids);
  });
}

// --- материалы ---

export async function addNote(skillId: string, body: string, url?: string) {
  await db.notes.add({ id: uid(), skillId, kind: url ? 'link' : 'text', body: body.trim(), url: url?.trim() || undefined, createdAt: nowIso() });
}

export async function toggleNoteStudied(id: string) {
  const n = await db.notes.get(id);
  if (n) await db.notes.update(id, { studied: !n.studied });
}

export const deleteNote = (id: string) => db.notes.delete(id);

// --- профиль ---

export const setName = (name: string) => db.profile.update('me', { name: name.trim() || 'mildyan' });

export async function unlockAchievements(ids: string[]) {
  const at = nowIso();
  await db.unlocked.bulkPut(ids.map((achievementId) => ({ achievementId, unlockedAt: at })));
}

export async function resetAll() {
  await db.delete();
  location.reload();
}

// --- квесты (§6) ---

export async function createQuest(q: Omit<Quest, 'id' | 'createdAt' | 'status' | 'since'> & { since?: string }) {
  const quest: Quest = { ...q, id: uid(), status: 'active', since: q.since ?? localDate(), createdAt: nowIso() };
  await db.quests.add(quest);
  return quest;
}

export async function toggleCustomStep(questId: string, stepId: string) {
  const q = await db.quests.get(questId);
  if (!q || q.status !== 'active') return;
  await db.quests.update(questId, {
    steps: q.steps.map((s) => (s.id === stepId && s.kind === 'custom' ? { ...s, done: !s.done } : s)),
  });
}

export const abandonQuest = (id: string) => db.quests.update(id, { status: 'abandoned', completedAt: nowIso() });
export const deleteQuest = (id: string) => db.quests.delete(id);

/** Закрывает квест и начисляет награду: навыку первого шага, иначе — персонажу напрямую. */
export async function completeQuest(id: string) {
  return db.transaction('rw', [db.quests, db.entries, db.entrySkills], async () => {
    const q = await db.quests.get(id);
    if (!q || q.status !== 'active') return null;
    const createdAt = nowIso();
    // Награда — навыку первого шага, где навык указан (в т.ч. в счётчике); иначе персонажу.
    const skillId = q.steps.map((s) => ('skillId' in s ? s.skillId : s.kind === 'count' ? s.rule.skillId : undefined)).find(Boolean);
    await bonus(skillId, `Квест «${q.title}» выполнен`, q.rewardXp, createdAt);
    await db.quests.update(id, { status: 'done', completedAt: createdAt });
    return q;
  });
}

/** Недельные квесты на текущую неделю; прошлые незавершённые и просроченные — в «провалены». */
export async function maintainQuests() {
  const today = localDate();
  const week = weekStart(today);
  const profile = await db.profile.get('me');
  const off = new Set(profile?.weeklyOff ?? []);
  await db.transaction('rw', [db.quests], async () => {
    const active = await db.quests.where('status').equals('active').toArray();
    for (const q of active) {
      if ((q.kind === 'weekly' && q.week !== week) || (q.deadline && q.deadline < today)) {
        await db.quests.update(q.id, { status: 'failed', completedAt: nowIso() });
      }
    }
    const thisWeek = await db.quests.where('week').equals(week).toArray();
    for (const t of WEEKLY_TEMPLATES) {
      if (off.has(t.id) || thisWeek.some((q) => q.template === t.id)) continue;
      await db.quests.add({
        id: uid(), title: t.title, kind: 'weekly', rewardXp: t.reward, since: week, week, template: t.id,
        status: 'active', createdAt: nowIso(),
        steps: [{ id: uid(), kind: 'count', title: t.hint, rule: t.rule }],
      });
    }
  });
}

/** Включает или выключает недельный шаблон; выключенный квест этой недели убирается. */
export async function toggleWeeklyTemplate(id: string) {
  const p = await db.profile.get('me');
  const off = new Set(p?.weeklyOff ?? []);
  if (off.has(id)) off.delete(id);
  else {
    off.add(id);
    const q = (await db.quests.where('week').equals(weekStart(localDate())).toArray()).find((x) => x.template === id && x.status === 'active');
    if (q) await db.quests.delete(q.id);
  }
  await db.profile.update('me', { weeklyOff: [...off] });
  await maintainQuests();
}

// --- замеры и рубежи (§8) ---

export async function addMetric(m: Omit<Metric, 'id' | 'createdAt' | 'order'>) {
  const order = await db.metrics.count();
  await db.metrics.add({ ...m, id: uid(), order, createdAt: nowIso() });
}

export async function deleteMetric(id: string) {
  await db.transaction('rw', [db.metrics, db.metricValues, db.milestones], async () => {
    await db.metricValues.where('metricId').equals(id).delete();
    await db.milestones.where('metricId').equals(id).delete();
    await db.metrics.delete(id);
  });
}

/** Бонусная запись: XP навыку или, если навыка нет, персонажу напрямую. */
async function bonus(skillId: string | undefined, text: string, xp: number, createdAt: string) {
  const entry: Entry = { id: uid(), date: localDate(), type: 'bonus', text, difficulty: 1, closedGoalIds: [], outcome: 'ok', photoIds: [], createdAt };
  if (!skillId) entry.rewardXp = xp;
  await db.entries.add(entry);
  if (skillId) await db.entrySkills.add({ entryId: entry.id, skillId, role: 'primary', xp });
}

/**
 * Новое значение замера. Рекорд → +50 XP навыку; взятый рубеж → +200 XP.
 * Возвращает, что произошло, для всплывашек.
 */
export async function addMetricValue(metricId: string, input: { value?: number; reps?: number; sets?: WorkSet[]; note?: string; date?: string; photos?: PhotoDraft[] }) {
  return db.transaction('rw', [db.metrics, db.metricValues, db.milestones, db.entries, db.entrySkills, db.photos], async () => {
    const m = await db.metrics.get(metricId);
    if (!m) return { record: false, milestone: null as Milestone | null };
    // Подходы → значение лучшего подхода (вес и его повторы, или повторы для «раз»).
    const sets = input.sets?.filter((s) => s.r > 0);
    const fromSets = sets?.length ? valueFromSets(sets, !!m.hasReps) : null;
    const v = { ...input, value: fromSets?.value ?? input.value ?? 0, reps: fromSets ? fromSets.reps : input.reps };
    const prev = await db.metricValues.where('metricId').equals(metricId).toArray();
    const createdAt = nowIso();
    const record = isRecord(prev, v, m.better);
    const photoIds: string[] = [];
    for (const p of v.photos ?? []) {
      const id = uid();
      await db.photos.add({ id, ...p, createdAt });
      photoIds.push(id);
    }
    await db.metricValues.add({
      id: uid(), metricId, date: v.date ?? localDate(), value: v.value, reps: v.reps, sets: sets?.length ? sets : undefined,
      note: v.note?.trim() || undefined, photoIds, record, createdAt,
    });
    const shown = `${fmtNum(v.value)} ${m.unit}${v.reps ? ` × ${v.reps}` : ''}`;
    if (record) await bonus(m.skillId, `Рекорд: ${m.title} ${shown}`, RECORD_XP, createdAt);
    let milestone: Milestone | null = null;
    const active = await db.milestones.where('metricId').equals(metricId).filter((x) => x.status === 'active').toArray();
    const all = [...prev, { value: v.value, reps: v.reps, sets }];
    for (const ms of active) {
      const current = ms.mode === 'repsAt' ? bestRepsAt(all, ms.atWeight ?? 0) : v.value;
      // Рубеж поставлен без значений — первое значение становится стартом.
      if (ms.start === undefined) await db.milestones.update(ms.id, { start: current });
      const done = ms.mode === 'repsAt' ? current >= ms.target : reached(v.value, ms.target, m.better);
      if (done) {
        await db.milestones.update(ms.id, { status: 'done', doneAt: createdAt });
        const what = ms.mode === 'repsAt' ? `${fmtNum(ms.atWeight ?? 0)} ${m.unit} × ${ms.target}` : `${fmtNum(ms.target)} ${m.unit}`;
        await bonus(m.skillId, `Рубеж взят: ${m.title} ${what}`, MILESTONE_XP, createdAt);
        milestone = ms;
      }
    }
    return { record, milestone };
  });
}

export async function deleteMetricValue(id: string) {
  await db.transaction('rw', [db.metricValues, db.photos], async () => {
    const v = await db.metricValues.get(id);
    if (!v) return;
    await db.photos.bulkDelete(v.photoIds);
    await db.metricValues.delete(id);
  });
}

/** Ставит рубеж (заменяет активный). start не задан — возьмётся из первого значения. */
export async function setMilestone(metricId: string, ms: { mode: 'value' | 'repsAt'; target: number; atWeight?: number; start?: number; deadline?: string }) {
  await db.transaction('rw', [db.milestones], async () => {
    await db.milestones.where('metricId').equals(metricId).filter((x) => x.status === 'active').delete();
    await db.milestones.add({ id: uid(), metricId, ...ms, status: 'active', createdAt: nowIso() });
  });
}

export const removeMilestone = (id: string) => db.milestones.delete(id);

/** 74.2 → «74,2», 62 → «62». */
export const fmtNum = (n: number) => (Math.round(n * 10) / 10).toString().replace('.', ',');
