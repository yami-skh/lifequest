// Всё состояние разом и производные значения. Данных у одного человека немного,
// поэтому проще держать их в памяти целиком и считать на лету (ARCHITECTURE.md §11).
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { db, type Entry, type EntrySkill, type Goal, type Node, type Note, type Profile, type Unlocked } from './db';
import { computeProgress, skillProgress } from '../engine/progress';
import { currentStage, stagesOf } from '../engine/stages';
import { RUST_DAYS } from '../engine/xp';
import { daysBetween } from '../engine/dates';
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

export interface LockReason {
  node: Node;
  /** Позиция в node.requires — для удаления. */
  index: number;
  need: string;
  have: string;
  /** 0..1 — насколько выполнено. */
  ratio: number;
  met: boolean;
}

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

  /** Все требования узла с текущим состоянием. */
  const requirementsOf = (n: Node): LockReason[] =>
    (n.requires ?? []).flatMap((r, index) => {
      const req = nodeById.get(r.nodeId);
      if (!req) return [];
      if (r.minLevel !== undefined) {
        const lv = req.kind === 'skill' ? skillLevelOf(req.id).level : 0;
        return [{ node: req, index, need: `ур. ${r.minLevel}`, have: `ур. ${lv}`, ratio: Math.min(1, lv / r.minLevel), met: lv >= r.minLevel }];
      }
      const pr = progress.get(req.id) ?? 0;
      const need = r.minProgress ?? 0;
      return [{ node: req, index, need: `${need}%`, have: `${Math.round(pr)}%`, ratio: need ? Math.min(1, pr / need) : 1, met: pr >= need }];
    });

  const lockReasons = (n: Node): LockReason[] => requirementsOf(n).filter((r) => !r.met);

  const skills = w.nodes.filter((n) => n.kind === 'skill').sort((a, b) => a.title.localeCompare(b.title));

  const recentSkills: Node[] = [];
  for (const e of w.entries) {
    const id = primaryOf(e.id);
    const n = id ? nodeById.get(id) : undefined;
    if (n && !recentSkills.includes(n)) recentSkills.push(n);
    if (recentSkills.length >= 6) break;
  }

  // Серию и даты считаем только по настоящим записям, без бонусов за ступени.
  const dates = w.entries.filter((e) => e.type !== 'bonus').map((e) => e.date);
  const today = localDate();

  // --- ступени, фокус, ржавчина, туман, подсказки (§16) ---

  const stagesOfSkill = (id: string) => stagesOf(goalsBySkill.get(id) ?? []);

  /** Цели, которые сейчас можно закрывать: из открытых ступеней. */
  const openGoalsOf = (id: string) =>
    stagesOfSkill(id).filter((s) => s.unlocked).flatMap((s) => s.goals.filter((g) => !g.done));

  const lastDateBySkill = new Map<string, string>();
  for (const e of w.entries) {
    if (e.type === 'bonus') continue;
    for (const es of skillsOfEntry.get(e.id) ?? []) {
      const prev = lastDateBySkill.get(es.skillId);
      if (!prev || e.date > prev) lastDateBySkill.set(es.skillId, e.date);
    }
  }
  /** Дней без записей, если навык «заржавел»; иначе null. */
  const rustDays = (id: string) => {
    const last = lastDateBySkill.get(id);
    if (!last) return null;
    const d = daysBetween(last, today);
    return d >= RUST_DAYS ? d : null;
  };
  const explored = (id: string) => (xpBySkill.get(id) ?? 0) > 0;

  const focusSkills = skills.filter((s) => s.focus);

  /** Какие навыки открывает данный узел своим прогрессом. */
  const unlocksOf = (id: string) => w.nodes.filter((n) => n.requires?.some((r) => r.nodeId === id));

  type Hint =
    | { kind: 'level'; node: Node; left: number; next: number }
    | { kind: 'goal'; node: Node; goal: Goal; area: Node; delta: number }
    | { kind: 'unlock'; node: Node; reason: LockReason }
    | { kind: 'rust'; node: Node; days: number };

  const hints = (): Hint[] => {
    const out: Hint[] = [];

    const near = skills
      .map((n) => ({ n, lv: skillLevelOf(n.id) }))
      .filter(({ lv }) => lv.xp > 0 && lv.level < 10 && lv.left <= 60)
      .sort((a, b) => a.lv.left - b.lv.left)[0];
    if (near) out.push({ kind: 'level', node: near.n, left: near.lv.left, next: near.lv.level + 1 });

    // Цель, которая сильнее всего двинет полоску направления.
    let best: Extract<Hint, { kind: 'goal' }> | null = null;
    for (const s of skills) {
      if (lockReasons(s).length) continue;
      const area = areaOf(s.id);
      if (!area) continue;
      const before = progress.get(area.id) ?? 0;
      for (const g of openGoalsOf(s.id)) {
        const map = new Map(goalsBySkill);
        map.set(s.id, (goalsBySkill.get(s.id) ?? []).map((x) => (x.id === g.id ? { ...x, done: true } : x)));
        const delta = (computeProgress(w.nodes, map).get(area.id) ?? 0) - before;
        if (!best || delta > best.delta) best = { kind: 'goal', node: s, goal: g, area, delta };
      }
    }
    if (best && best.delta >= 0.5) out.push(best);

    const unlock = skills
      .flatMap((n) => lockReasons(n).filter((r) => r.ratio < 1).map((reason) => ({ n, reason })))
      .sort((a, b) => b.reason.ratio - a.reason.ratio)[0];
    if (unlock) out.push({ kind: 'unlock', node: unlock.n, reason: unlock.reason });

    const rusty = skills
      .map((n) => ({ n, d: rustDays(n.id) }))
      .filter((x): x is { n: Node; d: number } => x.d !== null)
      .sort((a, b) => b.d - a.d)[0];
    if (rusty) out.push({ kind: 'rust', node: rusty.n, days: rusty.d });

    return out;
  };
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
    requirementsOf,
    skills,
    recentSkills,
    streak: currentStreak(dates, today),
    stagesOfSkill,
    currentStageOf: (id: string) => currentStage(stagesOfSkill(id)),
    openGoalsOf,
    rustDays,
    explored,
    focusSkills,
    unlocksOf,
    hints,
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
