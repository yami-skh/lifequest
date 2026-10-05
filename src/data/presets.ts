// Готовые навыки при ручном добавлении (мастер-план §12): навыки шаблонов, сгруппированные по направлениям,
// плюс дополнительные для направлений, где в шаблонах меньше трёх навыков. Макет: холст, «Пресеты и первый запуск».
import type { TplBranch, TplGoal, TplSkill } from '../engine/templates';
import { TEMPLATES } from './templates';

const T = (title: string): TplGoal => ({ title, kind: 'theory' });
const P = (title: string): TplGoal => ({ title, kind: 'practice' });
const sk = (key: string, title: string, stages: TplGoal[][], boss = false): TplSkill => ({
  key, title, stages: stages.map((goals, i) => ({ stage: i + 1, goals, ...(boss && i === stages.length - 1 ? { boss: true } : {}) })),
});

/** Направление → дополнительные навыки (только там, где шаблонов мало). */
const EXTRA: Record<string, TplSkill[]> = {
  Разум: [
    sk('x-breath', 'Дыхание и стресс', [[T('Дыхание 4-7-8 и квадратное дыхание'), P('Дышать по технике 5 минут 7 дней')], [P('Применить дыхание в стрессовой ситуации 3 раза'), P('Записать 5 своих триггеров стресса')]]),
    sk('x-detox', 'Цифровой детокс', [[T('Посмотреть своё экранное время за неделю'), P('Час без телефона после пробуждения 7 дней')], [P('Экранное время меньше 2 часов в день неделю'), P('Один день в неделю без соцсетей 4 недели')]]),
  ],
  Общение: [
    sk('x-speech', 'Публичные выступления', [[T('Структура выступления: начало, 3 мысли, вывод'), P('Записать на видео рассказ на 2 минуты')], [P('Выступить перед 3+ людьми'), P('Выступить 5 минут без бумажки')]]),
    sk('x-meet', 'Знакомства', [[P('Заговорить с новым человеком 3 раза'), P('Сходить на мероприятие по интересам')], [P('Познакомиться с 5 новыми людьми за месяц'), P('Позвать нового знакомого на встречу')]]),
  ],
  Практика: [
    sk('x-cook', 'Кулинария', [[T('Базовые техники: варка, жарка, запекание'), P('Приготовить 5 разных блюд')], [P('Готовить дома 4 раза в неделю месяц'), P('Накормить гостей своим ужином')]]),
    sk('x-repair', 'Ремонт дома', [[T('Какие инструменты нужны дома'), P('Починить 3 мелочи дома')], [P('Повесить полку ровно'), P('Заменить смеситель или дверную ручку')]]),
    sk('x-drive', 'Вождение', [[T('ПДД: 10 билетов без ошибок'), P('10 часов практики с инструктором')], [P('Проехать по городу без подсказок'), P('Сдать экзамен на права')]], true),
  ],
};

const norm = (s: string) => s.trim().toLowerCase().replace(/ё/g, 'е');

/** Готовые навыки для направления: сначала из шаблонов, потом дополнительные; без повторов по названию. */
export function presetsFor(areaTitle: string): TplSkill[] {
  const out: TplSkill[] = [];
  const seen = new Set<string>();
  const add = (s: TplSkill) => {
    if (seen.has(norm(s.title))) return;
    seen.add(norm(s.title));
    out.push(s);
  };
  const walk = (b: TplBranch) => {
    b.skills?.forEach(add);
    b.branches?.forEach(walk);
  };
  for (const t of TEMPLATES) for (const a of t.areas) if (norm(a.title) === norm(areaTitle)) a.branches.forEach(walk);
  (Object.entries(EXTRA).find(([k]) => norm(k) === norm(areaTitle))?.[1] ?? []).forEach(add);
  return out;
}
