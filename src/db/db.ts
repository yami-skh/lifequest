// Хранилище на устройстве. ARCHITECTURE.md §11.
import Dexie, { type Table } from 'dexie';
import type { Difficulty, EntryType } from '../engine/xp';
import type { GoalKind } from '../engine/progress';
import { assignStages } from '../engine/stages';

export type NodeKind = 'area' | 'branch' | 'skill';

export interface Profile {
  id: 'me';
  name: string;
  createdAt: string;
  /** Когда последний раз сохраняли резервную копию (ISO). */
  lastBackupAt?: string;
  /** Напоминать о копии раз в неделю; по умолчанию да. */
  backupReminder?: boolean;
}

export interface Requirement { nodeId: string; minProgress?: number; minLevel?: number }

export interface Node {
  id: string;
  parentId: string | null;
  kind: NodeKind;
  title: string;
  /** Цвет направления (только у area). */
  color?: string;
  /** Иконка направления (только у area), имя из Icon.tsx. */
  icon?: string;
  order: number;
  requires?: Requirement[];
  /** В фокусе: ×1.2 XP, показывается на главном (§16, идея 1). Не больше 3. */
  focus?: boolean;
  /** Ступени, за которые уже начислен бонус. */
  stagesAwarded?: number[];
  createdAt: string;
}

export interface Goal {
  id: string;
  skillId: string;
  kind: GoalKind;
  title: string;
  done: boolean;
  doneAt?: string;
  /** Номер ступени, с 1 (§16, идея 2). */
  stage: number;
  order: number;
}

export interface Entry {
  id: string;
  /** Локальная дата YYYY-MM-DD. */
  date: string;
  type: EntryType;
  text: string;
  difficulty: Difficulty;
  closedGoalIds: string[];
  outcome: 'ok' | 'fail';
  failNote?: string;
  fixesEntryId?: string;
  photoIds: string[];
  createdAt: string;
}

export interface EntrySkill { entryId: string; skillId: string; role: 'primary' | 'secondary'; xp: number }

export interface Photo { id: string; blob: Blob; thumb: Blob; width: number; height: number; createdAt: string }

export interface Unlocked { achievementId: string; unlockedAt: string }

export interface Note {
  id: string;
  skillId: string;
  kind: 'text' | 'link';
  body: string;
  url?: string;
  studied?: boolean;
  createdAt: string;
}

export const AREA_ICON_BY_TITLE: Record<string, string> = {
  Интеллект: 'bulb', Тело: 'dumbbell', Практика: 'tools', Творчество: 'brush', Технологии: 'monitor',
};

export const AREA_ICONS = ['bulb', 'dumbbell', 'tools', 'brush', 'monitor', 'heart', 'music', 'globe', 'leaf', 'code', 'chef', 'coin', 'book', 'compass', 'star'];

class LifeQuestDB extends Dexie {
  profile!: Table<Profile, string>;
  nodes!: Table<Node, string>;
  goals!: Table<Goal, string>;
  entries!: Table<Entry, string>;
  entrySkills!: Table<EntrySkill, [string, string]>;
  photos!: Table<Photo, string>;
  unlocked!: Table<Unlocked, string>;
  notes!: Table<Note, string>;

  constructor() {
    super('lifequest');
    this.version(1).stores({
      profile: 'id',
      nodes: 'id, parentId, kind',
      goals: 'id, skillId',
      entries: 'id, date, createdAt',
      entrySkills: '[entryId+skillId], entryId, skillId',
      photos: 'id',
      unlocked: 'achievementId',
      notes: 'id, skillId',
    });
    // v2: иконки у стартовых направлений, созданных до их появления.
    this.version(2).stores({}).upgrade((tx) =>
      tx.table<Node, string>('nodes').where('kind').equals('area').modify((n) => {
        if (!n.icon && AREA_ICON_BY_TITLE[n.title]) n.icon = AREA_ICON_BY_TITLE[n.title];
      }),
    );
    // v3: ступени у целей, созданных до их появления.
    this.version(3).stores({}).upgrade(async (tx) => {
      const goals = await tx.table<Goal, string>('goals').toArray();
      const bySkill = new Map<string, Goal[]>();
      for (const g of goals) bySkill.set(g.skillId, [...(bySkill.get(g.skillId) ?? []), g]);
      for (const list of bySkill.values()) {
        list.sort((a, b) => a.order - b.order);
        const stages = assignStages(list);
        await Promise.all(list.map((g, i) => (g.stage ? null : tx.table('goals').update(g.id, { stage: stages[i] }))));
      }
    });
  }
}

export const db = new LifeQuestDB();

/** crypto.randomUUID есть только в защищённом контексте; по http в локальной сети его нет. */
export function uid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export const nowIso = () => new Date().toISOString();
