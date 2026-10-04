// Хранилище на устройстве. ARCHITECTURE.md §11.
import Dexie, { type Table } from 'dexie';
import type { Difficulty, EntryType } from '../engine/xp';
import type { GoalKind } from '../engine/progress';

export type NodeKind = 'area' | 'branch' | 'skill';

export interface Profile { id: 'me'; name: string; createdAt: string; lastBackupAt?: string }

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
  createdAt: string;
}

export interface Goal {
  id: string;
  skillId: string;
  kind: GoalKind;
  title: string;
  done: boolean;
  doneAt?: string;
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
  }
}

export const db = new LifeQuestDB();

/** crypto.randomUUID есть только в защищённом контексте; по http в локальной сети его нет. */
export function uid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export const nowIso = () => new Date().toISOString();
