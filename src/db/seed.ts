// Стартовый набор. ARCHITECTURE.md §13.
import { db, nowIso, uid, type Goal, type Node } from './db';
import type { GoalKind } from '../engine/progress';

type G = [GoalKind, string];
interface SeedNode {
  title: string;
  color?: string;
  goals?: G[];
  /** Название навыка-требования и минимальный прогресс. */
  requires?: [string, number];
  children?: SeedNode[];
}

const t = (s: string): G => ['theory', s];
const p = (s: string): G => ['practice', s];

export const AREA_COLORS = ['#7AA7FF', '#FF8A5B', '#4CC9A0', '#E08AE8', '#B9A4FF', '#F2C94C', '#5BC0EB', '#FF7A9C'];

const TREE: SeedNode[] = [
  {
    title: 'Интеллект', color: '#7AA7FF', children: [
      { title: 'Языки', children: [{ title: 'Английский', goals: [t('Времена: present, past, future'), t('500 самых частых слов'), p('Прочитать короткий рассказ без словаря'), p('5 минут разговора с носителем')] }] },
      { title: 'Наука', children: [{ title: 'Основы электричества', goals: [t('Напряжение, ток, сопротивление'), t('Закон Ома'), t('Последовательное и параллельное соединение'), p('Решить 10 задач'), p('Собрать простую цепь')] }] },
      { title: 'Чтение', children: [{ title: 'Книги', goals: [p('Прочитать первую книгу'), p('Прочитать 5 книг'), t('Вести заметки по прочитанному')] }] },
    ],
  },
  {
    title: 'Тело', color: '#FF8A5B', children: [
      { title: 'Сила', children: [
        { title: 'Жим лёжа', goals: [t('Техника жима и страховка'), p('Жим 60 кг'), p('Жим 80 кг')] },
        { title: 'Подтягивания', goals: [p('5 подтягиваний подряд'), p('10 подтягиваний подряд'), p('15 подтягиваний подряд')] },
      ] },
      { title: 'Выносливость', children: [{ title: 'Бег', goals: [t('Пульсовые зоны'), p('3 км без остановки'), p('5 км без остановки')] }] },
      { title: 'Восстановление', children: [{ title: 'Сон', goals: [t('Как работает сон'), p('7 дней подряд спать 8 часов')] }] },
    ],
  },
  {
    title: 'Практика', color: '#4CC9A0', children: [
      { title: 'Кулинария', children: [
        { title: 'Японская кухня', children: [
          { title: 'Рамен', goals: [t('Устройство рамена'), t('Типы бульонов'), t('Тарэ и ароматическое масло'), t('Топпинги'), t('Виды лапши'), p('Приготовить шою-рамен'), p('Приготовить мисо-рамен'), p('Прозрачный бульон с нуля'), p('Сделать лапшу самому')] },
          { title: 'Суши', requires: ['Работа с ножом', 40], goals: [t('Рис для суши'), p('Приготовить маки'), p('Приготовить нигири')] },
        ] },
        { title: 'Техника приготовления', children: [
          { title: 'Работа с ножом', goals: [t('Виды ножей и заточка'), p('Нарезка жюльен'), p('Нарезка брюнуаз')] },
        ] },
      ] },
      { title: 'Ремонт и инструменты', children: [{ title: 'Базовые инструменты', goals: [t('Отвёртки, биты, дрель'), p('Повесить полку'), p('Заменить розетку с выключенным автоматом')] }] },
      { title: 'Финансовая грамотность', children: [{ title: 'Личный бюджет', goals: [t('Правило 50/30/20'), p('Месяц учёта расходов'), p('Отложить первую подушку')] }] },
    ],
  },
  {
    title: 'Творчество', color: '#E08AE8', children: [
      { title: 'Рисование и дизайн', children: [{ title: 'Скетчинг', goals: [t('Перспектива: 1 и 2 точки'), t('Светотень'), p('30 скетчей'), p('Нарисовать свою комнату')] }] },
      { title: 'Музыка', children: [] },
      { title: 'Письмо', children: [{ title: 'Дневник', goals: [p('Писать 7 дней подряд'), p('Писать 30 дней подряд')] }] },
    ],
  },
  {
    title: 'Технологии', color: '#B9A4FF', children: [
      { title: 'Компьютер и железо', children: [{ title: 'Сборка ПК', goals: [t('Комплектующие и совместимость'), t('BIOS и загрузка'), t('Охлаждение'), p('Собрать ПК самому')] }] },
      { title: 'Программирование', children: [{ title: 'Python', goals: [t('Переменные, условия, циклы'), t('Функции'), p('Написать первую программу'), p('Сделать маленький проект')] }] },
      { title: 'Интернет и безопасность', children: [{ title: 'Цифровая безопасность', goals: [t('Пароли и менеджер паролей'), t('Двухфакторная защита'), p('Включить 2FA на всех аккаунтах')] }] },
    ],
  },
];

export async function seedIfEmpty() {
  if (await db.profile.get('me')) return;
  const nodes: Node[] = [];
  const goals: Goal[] = [];
  const byTitle = new Map<string, string>();
  const pending: [Node, [string, number]][] = [];
  const createdAt = nowIso();

  const walk = (list: SeedNode[], parentId: string | null) => {
    list.forEach((s, order) => {
      const kind = parentId === null ? 'area' : s.goals ? 'skill' : 'branch';
      const node: Node = { id: uid(), parentId, kind, title: s.title, order, createdAt };
      if (s.color) node.color = s.color;
      nodes.push(node);
      byTitle.set(s.title, node.id);
      if (s.requires) pending.push([node, s.requires]);
      s.goals?.forEach(([gk, title], i) => goals.push({ id: uid(), skillId: node.id, kind: gk, title, done: false, order: i }));
      if (s.children) walk(s.children, node.id);
    });
  };
  walk(TREE, null);
  for (const [node, [title, minProgress]] of pending) {
    const id = byTitle.get(title);
    if (id) node.requires = [{ nodeId: id, minProgress }];
  }

  await db.transaction('rw', db.profile, db.nodes, db.goals, async () => {
    await db.nodes.bulkAdd(nodes);
    await db.goals.bulkAdd(goals);
    await db.profile.add({ id: 'me', name: 'mildyan', createdAt });
  });
}
