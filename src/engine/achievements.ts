// Достижения. ARCHITECTURE.md §7.

export interface Stats {
  entries: number;
  photoEntries: number;
  bestStreak: number;
  areasWithEntries: number;
  totalAreas: number;
  practiceXp: number;
  goalsDone: number;
  skills: number;
  questsDone: number;
  maxSkillLevel: number;
  records: number;
  level: number;
  fixedErrors: number;
  milestonesDone: number;
  teachEntries: number;
  nightEntries: number;
  earlyEntries: number;
  /** 3 неудачи подряд по навыку, затем успех. */
  stubborn: boolean;
  /** Одна запись прокачала 5 навыков из 3 направлений. */
  wide: boolean;
}

export type AchievementIcon =
  | 'sprout' | 'camera' | 'calendar' | 'flame' | 'compass' | 'hammer' | 'book' | 'tree'
  | 'sword' | 'medal' | 'crown' | 'chart' | 'star' | 'wrench' | 'target' | 'voice'
  | 'moon' | 'sun' | 'repeat' | 'dice';

export interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  icon: AchievementIcon;
  hidden?: boolean;
  target: number;
  value: (s: Stats) => number;
  /** Подпись прогресса, например «620 / 1000 XP». */
  unit?: string;
}

const flag = (b: boolean) => (b ? 1 : 0);

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_step', title: 'Первый шаг', desc: 'Первое действие в журнале', icon: 'sprout', target: 1, value: (s) => s.entries },
  { id: 'photo', title: 'Фотоотчёт', desc: 'Первое действие с фото', icon: 'camera', target: 1, value: (s) => s.photoEntries },
  { id: 'week', title: 'Неделя дисциплины', desc: '7 дней подряд с действием', icon: 'calendar', target: 7, value: (s) => s.bestStreak, unit: 'дн.' },
  { id: 'month', title: 'Месяц дисциплины', desc: '30 дней подряд с действием', icon: 'flame', target: 30, value: (s) => s.bestStreak, unit: 'дн.' },
  { id: 'versatile', title: 'Разносторонний', desc: 'Действия во всех направлениях', icon: 'compass', target: 5, value: (s) => s.areasWithEntries },
  { id: 'practitioner', title: 'Практик', desc: '1000 XP из действий «Практика»', icon: 'hammer', target: 1000, value: (s) => s.practiceXp, unit: 'XP' },
  { id: 'erudite', title: 'Эрудит', desc: 'Закрыто 100 целей', icon: 'book', target: 100, value: (s) => s.goalsDone },
  { id: 'gardener', title: 'Садовник', desc: 'Создано 25 навыков', icon: 'tree', target: 25, value: (s) => s.skills },
  { id: 'first_quest', title: 'Первый квест', desc: 'Завершён первый квест', icon: 'sword', target: 1, value: (s) => s.questsDone },
  { id: 'specialist', title: 'Специалист', desc: 'Любой навык на уровне 5', icon: 'medal', target: 5, value: (s) => s.maxSkillLevel, unit: 'ур.' },
  { id: 'master', title: 'Мастер', desc: 'Любой навык на уровне 10', icon: 'crown', target: 10, value: (s) => s.maxSkillLevel, unit: 'ур.' },
  { id: 'record', title: 'Личный рекорд', desc: 'Первый рекорд в замерах', icon: 'chart', target: 1, value: (s) => s.records },
  { id: 'level10', title: 'Уровень 10', desc: 'Персонаж 10 уровня', icon: 'star', target: 10, value: (s) => s.level, unit: 'ур.' },
  { id: 'level25', title: 'Уровень 25', desc: 'Персонаж 25 уровня', icon: 'star', target: 25, value: (s) => s.level, unit: 'ур.' },
  { id: 'level50', title: 'Уровень 50', desc: 'Персонаж 50 уровня', icon: 'star', target: 50, value: (s) => s.level, unit: 'ур.' },
  { id: 'fixer', title: 'Работа над ошибками', desc: 'Исправить 5 своих ошибок', icon: 'wrench', target: 5, value: (s) => s.fixedErrors },
  { id: 'milestone', title: 'Рубеж взят', desc: 'Достигнут первый рубеж', icon: 'target', target: 1, value: (s) => s.milestonesDone },
  { id: 'mentor', title: 'Наставник', desc: '10 действий «Объяснил другому»', icon: 'voice', target: 10, value: (s) => s.teachEntries },
  { id: 'owl', title: 'Сова', desc: '10 действий после полуночи', icon: 'moon', hidden: true, target: 10, value: (s) => s.nightEntries },
  { id: 'early', title: 'Ранняя пташка', desc: '10 действий до 7 утра', icon: 'sun', hidden: true, target: 10, value: (s) => s.earlyEntries },
  { id: 'stubborn', title: 'Упрямый', desc: '3 неудачи подряд, потом успех', icon: 'repeat', hidden: true, target: 1, value: (s) => flag(s.stubborn) },
  { id: 'wide', title: 'Всё и сразу', desc: '5 навыков из 3 направлений одним действием', icon: 'dice', hidden: true, target: 1, value: (s) => flag(s.wide) },
];

export function evaluateAchievements(stats: Stats) {
  return ACHIEVEMENTS.map((def) => {
    const value = def.value(stats);
    return { def, value: Math.min(value, def.target), done: value >= def.target };
  });
}
