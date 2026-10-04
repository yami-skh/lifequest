// Все изменения данных.
import { db, nowIso, uid, type Entry, type Node, type NodeKind } from './db';
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
  return entries.filter((e): e is Entry => !!e).map((e) => ({ type: e.type, date: e.date }));
}

export async function saveEntry(d: EntryDraft) {
  const today = localDate();
  const createdAt = nowIso();
  return db.transaction('rw', [db.entries, db.entrySkills, db.goals, db.photos], async () => {
    const history = await primaryHistory(d.primaryId);
    const ctx = xpContextFromHistory(
      history,
      { type: d.type, difficulty: d.difficulty, hasPhoto: d.photos.length > 0, fixesError: !!d.fixesEntryId },
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
  if (!g) return;
  await db.goals.update(id, g.done ? { done: false, doneAt: undefined } : { done: true, doneAt: nowIso() });
}

export async function addGoal(skillId: string, kind: GoalKind, title: string) {
  const count = await db.goals.where('skillId').equals(skillId).count();
  await db.goals.add({ id: uid(), skillId, kind, title: title.trim(), done: false, order: count });
}

export const deleteGoal = (id: string) => db.goals.delete(id);

// --- дерево ---

export async function addNode(parentId: string | null, kind: NodeKind, title: string, color?: string) {
  // null не попадает в индекс Dexie, поэтому направления считаем по kind.
  const count = parentId
    ? await db.nodes.where('parentId').equals(parentId).count()
    : await db.nodes.where('kind').equals('area').count();
  const node: Node = { id: uid(), parentId, kind, title: title.trim(), order: count, createdAt: nowIso() };
  if (color) node.color = color;
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
