// Друзья: что уходит на сервер — карточка недели (docs/arch/11-friends.md). Чистая функция, без базы.
// Записи, цели, заметки и фото не уходят: только числа недели и, если человек включил, направления и названия навыков.
import { addDays, localDate } from './dates';
import { weekStart } from './quests';
import type { EntryType } from './xp';

export interface WeekCard {
  name: string;
  level: number;
  streak: number;
  /** Понедельник недели, YYYY-MM-DD. */
  week: string;
  days: number;
  goalsDone: number;
  xp: number;
  areas?: { title: string; color: string; note: string }[];
  skills?: string[];
}

/** Что видят друзья (экран «Что видят друзья»). Имя и уровень — всегда. */
export interface FriendsShare { week: boolean; areas: boolean; skills: boolean }
export const DEFAULT_SHARE: FriendsShare = { week: true, areas: true, skills: false };

export interface CardInput {
  name: string;
  level: number;
  streak: number;
  today: string;
  entries: { id: string; date: string; type: EntryType; rewardXp?: number }[];
  entrySkills: { entryId: string; skillId: string; role: 'primary' | 'secondary'; xp: number }[];
  goals: { done: boolean; doneAt?: string }[];
  areaOf: (skillId: string) => { title: string; color?: string } | undefined;
  skillTitle: (skillId: string) => string | undefined;
}

const plural = (n: number, one: string, few: string, many: string) =>
  n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many;

export function buildWeekCard(x: CardInput, share: FriendsShare = DEFAULT_SHARE): WeekCard {
  const week = weekStart(x.today);
  const end = addDays(week, 6);
  const inWeek = (d: string) => d >= week && d <= end;
  const card: WeekCard = { name: x.name.trim() || 'Герой', level: x.level, streak: x.streak, week, days: 0, goalsDone: 0, xp: 0 };
  if (!share.week) return card;

  const entries = x.entries.filter((e) => inWeek(e.date));
  const ids = new Set(entries.map((e) => e.id));
  card.days = new Set(entries.filter((e) => e.type !== 'bonus').map((e) => e.date)).size;
  card.goalsDone = x.goals.filter((g) => g.done && g.doneAt && inWeek(localDate(new Date(g.doneAt)))).length;
  const primary = x.entrySkills.filter((s) => s.role === 'primary' && ids.has(s.entryId));
  card.xp = primary.reduce((a, s) => a + s.xp, 0) + entries.reduce((a, e) => a + (e.rewardXp ?? 0), 0);

  if (share.areas) {
    const byArea = new Map<string, { title: string; color: string; n: number }>();
    for (const s of primary) {
      const a = x.areaOf(s.skillId);
      if (!a) continue;
      const cur = byArea.get(a.title) ?? { title: a.title, color: a.color ?? '', n: 0 };
      cur.n++;
      byArea.set(a.title, cur);
    }
    card.areas = [...byArea.values()].sort((a, b) => b.n - a.n).slice(0, 3)
      .map((a) => ({ title: a.title, color: a.color, note: `${a.n} ${plural(a.n, 'действие', 'действия', 'действий')}` }));
  }
  if (share.skills) {
    const n = new Map<string, number>();
    for (const s of primary) n.set(s.skillId, (n.get(s.skillId) ?? 0) + 1);
    card.skills = [...n.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => x.skillTitle(id)).filter((t): t is string => !!t).slice(0, 5);
  }
  return card;
}
