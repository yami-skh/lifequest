// Стартовое содержимое. ARCHITECTURE.md §13. Дерево новичок выбирает сам (шаблоны, components/Onboarding.tsx);
// прежний стартовый набор (дерево брата) — в истории git, до 0.10.0-beta.6.
import { db, nowIso, uid } from './db';
import { localDate } from '../engine/dates';

export const AREA_COLORS = ['#7AA7FF', '#FF8A5B', '#4CC9A0', '#E08AE8', '#B9A4FF', '#F2C94C', '#5BC0EB', '#FF7A9C'];

/** Какой стартовый набор (замеры, квест) уже добавлен: profile.starterVersion. */
const STARTER_VERSION = 1;

/** Новая установка: только профиль. Путь человек выбирает сам на экране «Кем хочешь стать?» (components/Onboarding.tsx). */
export async function seedIfEmpty() {
  if (await db.profile.get('me')) return;
  // Стартовые замеры v0.4 новичку не нужны — замеры приходят из выбранных шаблонов, привязанные к навыкам.
  await db.profile.add({ id: 'me', name: 'Герой', createdAt: nowIso(), onboarding: true, starterVersion: STARTER_VERSION });
}

// --- стартовое содержимое v0.4: замеры и квест «Обустрой персонажа» ---

const STARTER_METRICS: { title: string; unit: string; better: 'up' | 'down'; skill?: string; hasReps?: boolean }[] = [
  { title: 'Жим лёжа', unit: 'кг', better: 'up', skill: 'Жим лёжа', hasReps: true },
  { title: 'Подтягивания', unit: 'раз', better: 'up', skill: 'Подтягивания' },
  { title: 'Отжимания', unit: 'раз', better: 'up' },
  { title: 'Вес', unit: 'кг', better: 'down' },
  { title: 'Сон', unit: 'ч', better: 'up', skill: 'Сон' },
];

/** Добавляет замеры и стартовый квест один раз — и новым, и уже существующим профилям. */
export async function ensureStarter() {
  const createdAt = nowIso();
  // Проверка флага внутри той же транзакции: два одновременных запуска не создадут дубль.
  await db.transaction('rw', [db.profile, db.nodes, db.metrics, db.quests], async () => {
    const profile = await db.profile.get('me');
    if (!profile || (profile.starterVersion ?? 0) >= STARTER_VERSION) return;
    const nodes = await db.nodes.toArray();
    const skillByTitle = new Map(nodes.filter((n) => n.kind === 'skill').map((n) => [n.title, n.id]));
    if ((await db.metrics.count()) === 0) {
      await db.metrics.bulkAdd(
        STARTER_METRICS.map((m, order) => ({
          id: uid(), title: m.title, unit: m.unit, better: m.better, order, createdAt,
          skillId: m.skill ? skillByTitle.get(m.skill) : undefined, hasReps: m.hasReps,
        })),
      );
    }
    await addStarterQuestIn(createdAt);
    await db.profile.update('me', { starterVersion: STARTER_VERSION });
  });
}

/** Квест «Обустрой персонажа», если его ещё нет. Вызывать внутри транзакции с db.quests. */
async function addStarterQuestIn(createdAt: string) {
  const starterExists = (await db.quests.toArray()).some((q) => q.title === 'Обустрой персонажа');
  if (!starterExists) await db.quests.add({
    id: uid(), title: 'Обустрой персонажа', kind: 'side', rewardXp: 200, since: localDate(), status: 'active', createdAt,
    steps: [
      { id: uid(), kind: 'count', title: 'Сделать запись', rule: { target: 1 } },
      { id: uid(), kind: 'auto', title: 'Отметить навык в фокус', key: 'focus' },
      { id: uid(), kind: 'auto', title: 'Закрыть первую цель', key: 'goal' },
      { id: uid(), kind: 'auto', title: 'Сохранить резервную копию', key: 'backup' },
    ],
  });
}

/** После выбора пути на первом запуске: стартовый квест. */
export const addStarterQuest = () => db.transaction('rw', db.quests, () => addStarterQuestIn(nowIso()));
