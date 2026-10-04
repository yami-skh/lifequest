// Всё состояние разом и производные значения. Данных у одного человека немного,
// поэтому проще держать их в памяти целиком и считать на лету (ARCHITECTURE.md §11).
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { db, type Entry, type EntrySkill, type Goal, type Node, type Note, type Profile, type Unlocked } from './db';
import { computeProgress, skillProgress } from '../engine/progress';
import { characterLevel, skillLevel } from '../engine/levels';
import { bestStreak, currentStreak, localDate } from '../engine/dates';
import type { Stats } from '../engine/achievements';

export interface World {
  profile: Profile | undefined;
  nodes: Node[];
  goals: Goal[];
  entries: Entry[];
  entrySkills: EntrySkill[];
  notes: Note[];
  unlocked: Unlocked[];
}

export async function loadWorld(): Promise<World> {
  const [profile, nodes, goals, entries, entrySkills, notes, unlocked] = await Promise.all([
    db.profile.get('me'),
    db.nodes.toArray(),
    db.goals.toArray(),
    db.entries.orderBy('createdAt').reverse().toArray(),
    db.entrySkills.toArray(),
    db.notes.toArray(),
    db.unlocked.toArray(),
  ]);
  return { profile, nodes, goals, entries, entrySkills, notes, unlocked };
}

export interface LockReason { node: Node; need: string; have: string }

export function derive(w: World) {
  const nodeById = new Map(w.nodes.map((n) => [n.id, n]));
  const children = new Map<string | null, Node[]>();
  for (const n of w.nodes) {
    const list = children.get(n.parentId) ?? [];
    list.push(n);
    children.set(n.parentId, list);
  }
  for (const list of children.values()) list.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

  const goalsBySkill = new Map<string, Goal[]>();
  for (const g of w.goals) {
    const list = goalsBySkill.get(g.skillId) ?? [];
    list.push(g);
    goalsBySkill.set(g.skillId, list);
  }
  for (const list of goalsBySkill.values()) list.sort((a, b) => a.order - b.order);

  const progress = computeProgress(w.nodes, goalsBySkill);

  const skillsOfEntry = new Map<string, EntrySkill[]>();
  const xpBySkill = new Map<string, number>();
  const entriesBySkill = new Map<string, Entry[]>();
  const entryById = new Map(w.entries.map((e) => [e.id, e]));
  let totalXp = 0;
  for (const es of w.entrySkills) {
    const list = skillsOfEntry.get(es.entryId) ?? [];
    list.push(es);
    skillsOfEntry.set(es.entryId, list);
    xpBySkill.set(es.skillId, (xpBySkill.get(es.skillId) ?? 0) + es.xp);
    if (es.role === 'primary') totalXp += es.xp;
    const e = entryById.get(es.entryId);
    if (e) {
      const el = entriesBySkill.get(es.skillId) ?? [];
      el.push(e);
      entriesBySkill.set(es.skillId, el);
    }
  }
  for (const list of entriesBySkill.values()) list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const list of skillsOfEntry.values()) list.sort((a, b) => (a.role === 'primary' ? -1 : 1) - (b.role === 'primary' ? -1 : 1));

  const primaryOf = (entryId: string) => skillsOfEntry.get(entryId)?.find((s) => s.role === 'primary')?.skillId;

  const xpByNode = new Map<string, number>();
  const subtreeXp = (n: Node): number => {
    const own = n.kind === 'skill' ? xpBySkill.get(n.id) ?? 0 : 0;
    const sum = (children.get(n.id) ?? []).reduce((acc, c) => acc + subtreeXp(c), own);
    xpByNode.set(n.id, sum);
    return sum;
  };
  const areas = children.get(null) ?? [];
  areas.forEach(subtreeXp);

  const areaOf = (id: string): Node | undefined => {
    let n = nodeById.get(id);
    while (n && n.parentId) n = nodeById.get(n.parentId);
    return n;
  };
  const pathOf = (id: string): Node[] => {
    const path: Node[] = [];
    let n = nodeById.get(id);
    while (n) {
      path.unshift(n);
      n = n.parentId ? nodeById.get(n.parentId) : undefined;
    }
    return path;
  };

  const fixedIds = new Set(w.entries.map((e) => e.fixesEntryId).filter(Boolean) as string[]);
  const openErrorsBySkill = new Map<string, Entry[]>();
  for (const e of w.entries) {
    if (e.outcome !== 'fail' || fixedIds.has(e.id)) continue;
    const sk = primaryOf(e.id);
    if (!sk) continue;
    const list = openErrorsBySkill.get(sk) ?? [];
    list.push(e);
    openErrorsBySkill.set(sk, list);
  }

  const skillLevelOf = (id: string) => skillLevel(xpBySkill.get(id) ?? 0);

  const lockReasons = (n: Node): LockReason[] =>
    (n.requires ?? []).flatMap((r) => {
      const req = nodeById.get(r.nodeId);
      if (!req) return [];
      const reasons: LockReason[] = [];
      const pr = progress.get(req.id) ?? 0;
      if (r.minProgress !== undefined && pr < r.minProgress) {
        reasons.push({ node: req, need: `${r.minProgress}%`, have: `${Math.round(pr)}%` });
      }
      const lv = skillLevelOf(req.id).level;
      if (r.minLevel !== undefined && lv < r.minLevel) {
        reasons.push({ node: req, need: `ур. ${r.minLevel}`, have: `ур. ${lv}` });
      }
      return reasons;
    });

  const skills = w.nodes.filter((n) => n.kind === 'skill').sort((a, b) => a.title.localeCompare(b.title));

  const recentSkills: Node[] = [];
  for (const e of w.entries) {
    const id = primaryOf(e.id);
    const n = id ? nodeById.get(id) : undefined;
    if (n && !recentSkills.includes(n)) recentSkills.push(n);
    if (recentSkills.length >= 6) break;
  }

  const dates = w.entries.map((e) => e.date);
  const level = characterLevel(totalXp);

  const stats = (): Stats => {
    const areasWithEntries = new Set<string>();
    let practiceXp = 0;
    let wide = false;
    for (const e of w.entries) {
      const ess = skillsOfEntry.get(e.id) ?? [];
      const entryAreas = new Set(ess.map((s) => areaOf(s.skillId)?.id).filter(Boolean));
      entryAreas.forEach((a) => areasWithEntries.add(a as string));
      if (ess.length >= 5 && entryAreas.size >= 3) wide = true;
      if (e.type === 'practice') practiceXp += ess.find((s) => s.role === 'primary')?.xp ?? 0;
    }
    let stubborn = false;
    for (const list of entriesBySkill.values()) {
      const chrono = [...list].reverse();
      let fails = 0;
      for (const e of chrono) {
        if (e.outcome === 'fail') fails++;
        else {
          if (fails >= 3) stubborn = true;
          fails = 0;
        }
      }
    }
    const hourOf = (e: Entry) => new Date(e.createdAt).getHours();
    return {
      entries: w.entries.length,
      photoEntries: w.entries.filter((e) => e.photoIds.length > 0).length,
      bestStreak: bestStreak(dates),
      areasWithEntries: areasWithEntries.size,
      totalAreas: areas.length,
      practiceXp,
      goalsDone: w.goals.filter((g) => g.done).length,
      skills: skills.length,
      questsDone: 0,
      maxSkillLevel: Math.max(0, ...skills.map((s) => skillLevelOf(s.id).level)),
      records: 0,
      level: level.level,
      fixedErrors: fixedIds.size,
      milestonesDone: 0,
      teachEntries: w.entries.filter((e) => e.type === 'teach').length,
      nightEntries: w.entries.filter((e) => hourOf(e) < 4).length,
      earlyEntries: w.entries.filter((e) => hourOf(e) >= 4 && hourOf(e) < 7).length,
      stubborn,
      wide,
    };
  };

  return {
    ...w,
    nodeById,
    children,
    areas,
    goalsBySkill,
    progress,
    skillProgressOf: (id: string) => skillProgress(goalsBySkill.get(id) ?? []),
    xpBySkill,
    xpByNode,
    totalXp,
    level,
    skillLevelOf,
    skillsOfEntry,
    entriesBySkill,
    primaryOf,
    areaOf,
    pathOf,
    openErrorsBySkill,
    lockReasons,
    skills,
    recentSkills,
    streak: currentStreak(dates, localDate()),
    stats,
  };
}

export type Derived = ReturnType<typeof derive>;

export const WorldContext = createContext<Derived | null>(null);

export function useWorld(): Derived {
  const w = useContext(WorldContext);
  if (!w) throw new Error('World is not loaded');
  return w;
}
